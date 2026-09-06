from fastapi import APIRouter, Depends, Query, HTTPException, Body
from sqlalchemy.orm import Session
from app.database.db import get_db
from app.core.security import get_current_user, require_roles
from app.models import models as m
from app.services import graph_data
from app.graph import engine as ge
from app.entity_resolution import resolver as er

router = APIRouter(prefix="/api/v2/entities", tags=["entities"])


@router.get("")
def list_entities(db: Session = Depends(get_db), user=Depends(get_current_user),
                   entity_type: str = Query("PERSON"), q: str = Query(None), limit: int = 200):
    if entity_type == "PERSON":
        query = db.query(m.Person)
        if q:
            query = query.filter(m.Person.full_name.ilike(f"%{q}%"))
        rows = query.limit(limit).all()
        return {"entities": [
            {"id": p.id, "name": p.full_name, "type": "PERSON", "role": p.person_role,
             "risk_band": p.risk_band, "data_source": p.data_source,
             "aliases": [a.alias_name for a in p.aliases]}
            for p in rows
        ]}
    if not entity_type or entity_type.upper() == "ALL":
        nodes = graph_data.load_all_nodes(db)
    else:
        nodes = [n for n in graph_data.load_all_nodes(db) if n["type"] == entity_type.upper()]
    if q:
        nodes = [n for n in nodes if q.lower() in n.get("name", "").lower()]
    return {"entities": nodes[:limit]}


@router.get("/global-search")
def global_search(
    q: str,
    limit: int = 15,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Global multi-entity search across persons, cases, phones, vehicles, locations, gangs."""
    if not q or len(q.strip()) < 1:
        return {"results": []}
    
    term = f"%{q.strip()}%"
    results = []
    
    # 1. Search Persons
    matching_persons = db.query(m.Person).filter(
        m.Person.full_name.ilike(term)
    ).limit(limit).all()
    
    for p in matching_persons:
        results.append({
            "id": p.id,
            "category": "ENTITY",
            "type": "PERSON",
            "title": p.full_name,
            "subtitle": f"{p.person_role.upper() if p.person_role else 'SUBJECT'} · Risk: {p.risk_band or 'unknown'}",
            "route": f"/entities",
            "entity_id": p.id,
        })

    # 2. Search Cases
    matching_cases = db.query(m.CrimeCase).filter(
        (m.CrimeCase.case_number.ilike(term)) | (m.CrimeCase.title.ilike(term)) | (m.CrimeCase.crime_type.ilike(term))
    ).limit(6).all()
    
    for c in matching_cases:
        results.append({
            "id": c.id,
            "category": "CASE",
            "type": "CASE",
            "title": f"{c.case_number}: {c.title}",
            "subtitle": f"{c.crime_type} · {(c.status or 'OPEN').upper()} · {c.district}",
            "route": f"/cases",
            "case_id": c.id,
        })
        
    return {"results": results[:limit]}


@router.get("/{entity_id}")
def entity_dossier(entity_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Dossier 360 — full intelligence overview for a single entity."""
    person = db.query(m.Person).filter(m.Person.id == entity_id).first()
    lookup = graph_data.node_lookup(db)
    if entity_id not in lookup:
        raise HTTPException(status_code=404, detail="Entity not found")

    nodes = graph_data.load_all_nodes(db)
    edges = graph_data.load_all_edges(db)
    g = ge.build_graph(nodes, edges)
    centrality = ge.compute_centrality(g)
    communities = ge.detect_communities(g)

    direct_edges = [e for e in edges if e["source_entity_id"] == entity_id or e["target_entity_id"] == entity_id]
    connections = []
    case_ids = set()
    for e in direct_edges:
        other_id = e["target_entity_id"] if e["source_entity_id"] == entity_id else e["source_entity_id"]
        other = lookup.get(other_id, {})
        if other.get("type") == "CASE":
            case_ids.add(other_id)
        connections.append({
            "id": other_id, "name": other.get("name", other_id), "type": other.get("type"),
            "relationship_type": e["relationship_type"], "confidence": e["confidence_score"],
            "evidence_id": e["evidence_id"], "first_seen": e["first_seen_at"], "last_seen": e["last_seen_at"],
        })

    my_centrality = centrality.get(entity_id, {"degree_centrality": 0, "betweenness_centrality": 0, "pagerank": 0})
    my_community = communities.get(entity_id)
    community_size = sum(1 for v in communities.values() if v == my_community) if my_community is not None else 0

    anomalies = db.query(m.Anomaly).filter(m.Anomaly.entity_id == entity_id).all()

    insights = []
    insights.append({
        "text": f"Connected to {len(connections)} entities across {len(case_ids)} case(s).",
        "type": "FACT",
    })
    if my_centrality["betweenness_centrality"] > 0.1:
        insights.append({"text": "Acts as a bridge between multiple detected communities.", "type": "INFERENCE"})
    if anomalies:
        insights.append({"text": f"{len(anomalies)} anomaly record(s) flagged for this entity.", "type": "ANOMALY"})
    locations = [c for c in connections if c["type"] == "LOCATION"]
    if locations:
        insights.append({"text": f"Appears at {len(locations)} distinct location(s) in the available records.", "type": "FACT"})

    entity_info = lookup[entity_id]
    aliases = [a.alias_name for a in person.aliases] if person else []

    return {
        "identity": {
            "id": entity_id, "name": entity_info["name"], "type": entity_info["type"],
            "aliases": aliases,
            "role": person.person_role if person else None,
            "risk_band": person.risk_band if person else None,
            "data_source": entity_info.get("data_source", "SYNTHETIC"),
        },
        "network_position": {
            "degree_centrality": my_centrality["degree_centrality"],
            "betweenness_centrality": my_centrality["betweenness_centrality"],
            "pagerank": my_centrality["pagerank"],
            "role_label": ge.label_entity_role(my_centrality),
            "community_id": my_community,
            "community_size": community_size,
        },
        "connections": sorted(connections, key=lambda c: c["confidence"], reverse=True),
        "related_cases": list(case_ids),
        "anomalies": [{"id": a.id, "reason": a.reason, "severity": a.severity, "type": a.anomaly_type} for a in anomalies],
        "intelligence_insights": insights,
    }


@router.post("/resolve")
def resolve_entity(payload: dict = Body(...), db: Session = Depends(get_db),
                    user=Depends(require_roles(["investigator", "crime_analyst"]))):
    candidate_name = payload["candidate_name"]
    people = db.query(m.Person).all()
    existing = [{"id": p.id, "full_name": p.full_name, "aliases": [a.alias_name for a in p.aliases]} for p in people]
    matches = er.resolve_person(
        candidate_name, existing,
        shared_phone=payload.get("shared_phone", False),
        shared_vehicle=payload.get("shared_vehicle", False),
        shared_location=payload.get("shared_location", False),
        same_case=payload.get("same_case", False),
    )
    for match in matches[:10]:
        db.add(m.EntityMatch(
            source_entity_id=payload.get("source_entity_id", "new"),
            candidate_entity_id=match.candidate_person_id,
            match_score=match.score, match_status=match.status,
            matching_method=match.method, supporting_evidence=match.supporting_evidence,
        ))
    db.commit()
    return {"candidate_name": candidate_name, "matches": [m_.__dict__ for m_ in matches[:10]]}


@router.post("/merge")
def merge_entities(payload: dict = Body(...), db: Session = Depends(get_db),
                    user=Depends(require_roles(["investigator", "admin"]))):
    keep_id, merge_id = payload["keep_entity_id"], payload["merge_entity_id"]
    keep = db.query(m.Person).filter(m.Person.id == keep_id).first()
    merged = db.query(m.Person).filter(m.Person.id == merge_id).first()
    if not keep or not merged:
        raise HTTPException(status_code=404, detail="One or both entities not found")

    db.add(m.Alias(person_id=keep.id, alias_name=merged.full_name))
    for rel in db.query(m.RelationshipRecord).filter(m.RelationshipRecord.source_entity_id == merge_id):
        rel.source_entity_id = keep_id
    for rel in db.query(m.RelationshipRecord).filter(m.RelationshipRecord.target_entity_id == merge_id):
        rel.target_entity_id = keep_id
    db.add(m.AuditLog(user_id=user["user_id"], action="ENTITY_MERGE",
                       details={"kept": keep_id, "merged": merge_id, "merged_name": merged.full_name}))
    db.delete(merged)
    db.commit()
    return {"status": "merged", "kept_entity_id": keep_id}

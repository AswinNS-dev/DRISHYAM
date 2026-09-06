from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database.db import get_db
from app.core.security import get_current_user
from app.models import models as m
from app.services import graph_data
from app.graph import engine as ge

router = APIRouter(prefix="/api/v2/network", tags=["network"])


@router.get("/graph")
def get_graph(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    entity_type: str = Query(None),
    district: str = Query(None),
    entity_id: str = Query(None),
    case_id: str = Query(None),
    depth: int = Query(1, ge=1, le=3),
    limit: int = Query(500)
):
    nodes = graph_data.load_all_nodes(db)
    edges = graph_data.load_all_edges(db)
    g = ge.build_graph(nodes, edges)

    # Scoping by Case
    if case_id:
        accused_rels = db.query(m.RelationshipRecord).filter(
            m.RelationshipRecord.relationship_type == "ACCUSED_IN",
            m.RelationshipRecord.target_entity_id == case_id,
        ).all()
        firs = db.query(m.FIR).filter(m.FIR.case_id == case_id).all()
        fir_ids = [f.id for f in firs]
        mentions = db.query(m.EntityMention).filter(m.EntityMention.source_record_id.in_(fir_ids)).all() if fir_ids else []
        seed_ids = {r.source_entity_id for r in accused_rels} | {m.resolved_entity_id for m in mentions if m.resolved_entity_id} | {case_id}
        
        expanded_ids = set(seed_ids)
        current_frontier = set(seed_ids)
        for _ in range(depth):
            next_frontier = set()
            for sid in current_frontier:
                if sid in g:
                    next_frontier.update(g.neighbors(sid))
            expanded_ids.update(next_frontier)
            current_frontier = next_frontier
            
        nodes = [n for n in nodes if n["id"] in expanded_ids]
        edges = [e for e in edges if e["source_entity_id"] in expanded_ids and e["target_entity_id"] in expanded_ids]
        g = ge.build_graph(nodes, edges)

    # Scoping by Entity (Ego-network expansion)
    elif entity_id:
        expanded_ids = {entity_id}
        current_frontier = {entity_id}
        for _ in range(depth):
            next_frontier = set()
            for sid in current_frontier:
                if sid in g:
                    next_frontier.update(g.neighbors(sid))
            expanded_ids.update(next_frontier)
            current_frontier = next_frontier

        nodes = [n for n in nodes if n["id"] in expanded_ids]
        edges = [e for e in edges if e["source_entity_id"] in expanded_ids and e["target_entity_id"] in expanded_ids]
        g = ge.build_graph(nodes, edges)

    # Entity Type filtering
    if entity_type:
        allowed_ids = {n["id"] for n in nodes if n["type"] == entity_type}
        edges = [e for e in edges if e["source_entity_id"] in allowed_ids or e["target_entity_id"] in allowed_ids]

    centrality = ge.compute_centrality(g)
    communities = ge.detect_communities(g)
    for n in nodes:
        c = centrality.get(n["id"], {"degree_centrality": 0, "betweenness_centrality": 0, "pagerank": 0})
        n["centrality"] = c
        n["role_label"] = ge.label_entity_role(c)
        n["community"] = communities.get(n["id"])
    return {
        "nodes": nodes[:limit],
        "edges": edges[:limit * 3],
        "links": edges[:limit * 3],
        "node_count": len(nodes),
        "edge_count": len(edges),
        "community_count": len(set(communities.values())) if communities else 0,
        "scoped_case_id": case_id,
        "scoped_entity_id": entity_id,
        "scoped_depth": depth,
    }


@router.get("/centrality")
def centrality(db: Session = Depends(get_db), user=Depends(get_current_user), top: int = 15):
    nodes = graph_data.load_all_nodes(db)
    edges = graph_data.load_all_edges(db)
    g = ge.build_graph(nodes, edges)
    scores = ge.compute_centrality(g)
    lookup = {n["id"]: n for n in nodes}
    rows = []
    for eid, s in scores.items():
        node = lookup.get(eid)
        if not node:
            continue
        rows.append({"id": eid, "name": node["name"], "type": node["type"], **s,
                      "role_label": ge.label_entity_role(s)})
    rows.sort(key=lambda r: r["pagerank"], reverse=True)
    return {"top_by_pagerank": rows[:top],
            "top_bridges": sorted(rows, key=lambda r: r["betweenness_centrality"], reverse=True)[:top]}


@router.get("/communities")
def communities(db: Session = Depends(get_db), user=Depends(get_current_user)):
    nodes = graph_data.load_all_nodes(db)
    edges = graph_data.load_all_edges(db)
    g = ge.build_graph(nodes, edges)
    mapping = ge.detect_communities(g)
    lookup = {n["id"]: n for n in nodes}
    grouped = {}
    for eid, cid in mapping.items():
        node = lookup.get(eid)
        if not node:
            continue
        grouped.setdefault(cid, []).append({"id": eid, "name": node["name"], "type": node["type"]})
    result = [{"community_id": cid, "size": len(members), "members": members[:25]}
              for cid, members in grouped.items()]
    result.sort(key=lambda c: c["size"], reverse=True)
    return {"communities": result, "community_count": len(result)}


@router.get("/path")
def path(source: str, target: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    nodes = graph_data.load_all_nodes(db)
    edges = graph_data.load_all_edges(db)
    g = ge.build_graph(nodes, edges)
    lookup = {n["id"]: n for n in nodes}
    result = ge.shortest_path(g, source, target)
    if not result:
        return {"found": False, "source": source, "target": target}
    result["path_names"] = [lookup.get(pid, {}).get("name", pid) for pid in result["path"]]
    if result["edges"]:
        result["confidence"] = round(sum(e.get("confidence", 0.8) for e in result["edges"]) / len(result["edges"]), 2)
    return {"found": True, **result}


@router.get("/hidden-links")
def hidden_links(source: str, max_hops: int = 5, min_hops: int = 3,
                  db: Session = Depends(get_db), user=Depends(get_current_user)):
    nodes = graph_data.load_all_nodes(db)
    edges = graph_data.load_all_edges(db)
    g = ge.build_graph(nodes, edges)
    lookup = {n["id"]: n for n in nodes}
    findings = ge.discover_hidden_links(g, source, max_hops=max_hops, min_hop_count=min_hops)
    for f in findings[:20]:
        f["target_name"] = lookup.get(f["target"], {}).get("name", f["target"])
        f["target_type"] = lookup.get(f["target"], {}).get("type")
        f["path_names"] = [lookup.get(pid, {}).get("name", pid) for pid in f["path"]]
    return {"source": source, "source_name": lookup.get(source, {}).get("name"), "findings": findings[:20]}


@router.get("/anomalies")
def anomalies(db: Session = Depends(get_db), user=Depends(get_current_user)):
    rows = db.query(m.Anomaly).order_by(m.Anomaly.created_at.desc()).all()
    lookup = graph_data.node_lookup(db)
    out = []
    for a in rows:
        out.append({
            "id": a.id, "entity_id": a.entity_id, "entity_name": lookup.get(a.entity_id, {}).get("name", "Unknown"),
            "anomaly_type": a.anomaly_type, "reason": a.reason, "severity": a.severity,
            "evidence_count": a.evidence_count, "created_at": a.created_at.isoformat(),
            "related_entities": [lookup.get(e, {}).get("name", e) for e in (a.related_entities or [])],
        })
    return {"anomalies": out}


@router.get("/insights")
def insights(db: Session = Depends(get_db), user=Depends(get_current_user)):
    nodes = graph_data.load_all_nodes(db)
    edges = graph_data.load_all_edges(db)
    g = ge.build_graph(nodes, edges)
    communities = ge.detect_communities(g)
    components = ge.connected_components(g)
    anomaly_count = db.query(m.Anomaly).count()
    alert_count = db.query(m.Alert).count()
    unresolved = db.query(m.EntityMatch).filter(m.EntityMatch.match_status.in_(["POSSIBLE", "UNRESOLVED"])).count()
    return {
        "entities": len(nodes),
        "relationships": len(edges),
        "communities": len(set(communities.values())) if communities else 0,
        "connected_components": len(components),
        "anomalies": anomaly_count,
        "alerts": alert_count,
        "unresolved_entity_matches": unresolved,
        "cross_case_links": db.query(m.RelationshipRecord).filter(m.RelationshipRecord.relationship_type == "ACCUSED_IN").count(),
    }

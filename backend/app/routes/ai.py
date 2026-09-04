import re
from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session
from app.database.db import get_db
from app.core.security import get_current_user
from app.models import models as m
from app.services import graph_data
from app.graph import engine as ge
from app.ai.assistant import answer_question

router = APIRouter(prefix="/api/v2/ai", tags=["ai"])


def _find_person_by_name(db: Session, name_fragment: str):
    return db.query(m.Person).filter(m.Person.full_name.ilike(f"%{name_fragment}%")).first()


def _retrieve(db: Session, question: str):
    q = question.lower()
    nodes = graph_data.load_all_nodes(db)
    edges = graph_data.load_all_edges(db)
    g = ge.build_graph(nodes, edges)
    lookup = {n["id"]: n for n in nodes}

    # crude but transparent intent detection — keeps retrieval fully auditable
    names_in_db = [n["name"] for n in nodes if n["type"] == "PERSON"]
    mentioned = [name for name in names_in_db if name.split()[0].lower() in q]

    if ("bridge" in q or "intermediar" in q) and "connect" in q:
        centrality = ge.compute_centrality(g)
        rows = []
        for eid, s in centrality.items():
            node = lookup.get(eid)
            if node and node["type"] == "PERSON" and s["betweenness_centrality"] > 0.05:
                rows.append({"id": eid, "name": node["name"], **s})
        rows.sort(key=lambda r: r["betweenness_centrality"], reverse=True)
        return {"kind": "bridge_entities", "rows": rows[:10]}

    if "why" in q and ("anomal" in q or "flag" in q) and mentioned:
        person = _find_person_by_name(db, mentioned[0])
        anomaly = db.query(m.Anomaly).filter(m.Anomaly.entity_id == person.id).first() if person else None
        return {"kind": "anomaly_reason", "entity_name": person.full_name if person else mentioned[0],
                "anomaly": {"reason": anomaly.reason, "severity": anomaly.severity} if anomaly else None}

    if len(mentioned) >= 2:
        a = _find_person_by_name(db, mentioned[0])
        b = _find_person_by_name(db, mentioned[1])
        if a and b:
            if "evidence" in q or "why" in q:
                direct = g.get_edge_data(a.id, b.id) or g.get_edge_data(b.id, a.id) or {}
                edge_list = []
                for e in direct.values():
                    edge_list.append({"relationship_type": e["relationship_type"], "confidence": e["confidence"],
                                        "source_record_id": None, "evidence_id": e.get("evidence_id")})
                return {"kind": "edge_evidence", "entity_a": a.full_name, "entity_b": b.full_name, "edges": edge_list}
            path_res = ge.shortest_path(g, a.id, b.id)
            if path_res:
                path_res["path_names"] = [lookup.get(pid, {}).get("name", pid) for pid in path_res["path"]]
                path_res["distinct_evidence"] = len({e.get("evidence_id") for e in path_res["edges"] if e.get("evidence_id")}) or path_res["hops"]
                path_res["confidence"] = round(sum(e.get("confidence", 0.8) for e in path_res["edges"]) / max(1, len(path_res["edges"])), 2)
            return {"kind": "path", "entity_a": a.full_name, "entity_b": b.full_name, "path_result": path_res}

    if mentioned:
        person = _find_person_by_name(db, mentioned[0])
        if person:
            if "summar" in q or "network around" in q:
                centrality = ge.compute_centrality(g)
                s = centrality.get(person.id, {"degree_centrality": 0, "betweenness_centrality": 0, "pagerank": 0})
                direct_edges = [e for e in edges if e["source_entity_id"] == person.id or e["target_entity_id"] == person.id]
                case_edges = [e for e in direct_edges if lookup.get(e["target_entity_id"], {}).get("type") == "CASE"]
                return {"kind": "network_summary", "entity_name": person.full_name, "summary": {
                    "connection_count": len(direct_edges), "case_count": len(case_edges),
                    "role_label": ge.label_entity_role(s), "degree_centrality": s["degree_centrality"],
                    "betweenness_centrality": s["betweenness_centrality"], "evidence": direct_edges[:10],
                }}
            # default: connections
            direct_edges = [e for e in edges if e["source_entity_id"] == person.id or e["target_entity_id"] == person.id]
            rows = []
            for e in direct_edges:
                other_id = e["target_entity_id"] if e["source_entity_id"] == person.id else e["source_entity_id"]
                other = lookup.get(other_id, {})
                rows.append({"id": other_id, "name": other.get("name", other_id),
                              "relationship_type": e["relationship_type"], "confidence": e["confidence_score"]})
            rows.sort(key=lambda r: r["confidence"], reverse=True)
            return {"kind": "connections", "entity_name": person.full_name, "connections": rows}

    return {"kind": "no_evidence"}


@router.post("/chat")
def chat(payload: dict = Body(...), db: Session = Depends(get_db), user=Depends(get_current_user)):
    question = payload.get("question", "")
    retrieved = _retrieve(db, question)
    result = answer_question(question, retrieved)
    db.add(m.AuditLog(user_id=user["user_id"], action="AI_QUERY", details={"question": question}))
    db.commit()
    return result

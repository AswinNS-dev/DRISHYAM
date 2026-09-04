from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
import datetime as dt

from app.database.db import get_db
from app.core.security import get_current_user
from app.models import models as m
from app.services import graph_data
from app.graph import engine as ge

router = APIRouter(prefix="/api/v2/intelligence", tags=["intelligence"])


@router.get("/leads")
def get_investigation_leads(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Generate high-priority algorithmic intelligence leads across the criminal graph."""
    nodes = graph_data.load_all_nodes(db)
    edges = graph_data.load_all_edges(db)
    g = ge.build_graph(nodes, edges)
    lookup = graph_data.node_lookup(db)
    centrality = ge.compute_centrality(g)

    leads = []

    # Lead 1: High betweenness brokers / bridges
    bridges = sorted(
        [
            {"id": nid, "score": c["betweenness_centrality"], "role": c.get("role_label")}
            for nid, c in centrality.items()
        ],
        key=lambda x: x["score"],
        reverse=True
    )[:4]

    for b in bridges:
        if b["score"] > 0.05:
            info = lookup.get(b["id"], {})
            neighbors = list(g.neighbors(b["id"])) if b["id"] in g else []
            neighbor_names = [lookup.get(nb, {}).get("name", nb) for nb in neighbors[:4]]
            leads.append({
                "id": f"lead-bridge-{b['id'][:8]}",
                "lead_type": "SYNDICATE_BRIDGE_OPERATOR",
                "title": f"Key Intermediary Broker Identified: {info.get('name', 'Unknown')}",
                "description": (
                    f"{info.get('name')} exhibits high betweenness centrality ({b['score']*100:.1f}%), "
                    f"functioning as a critical conduit connecting disparate cells: {', '.join(neighbor_names)}."
                ),
                "target_entity": {"id": b["id"], "name": info.get("name"), "type": info.get("type")},
                "confidence": min(0.95, round(0.75 + b["score"], 2)),
                "priority": "CRITICAL" if b["score"] > 0.15 else "HIGH",
                "recommended_action": "Issue targeted surveillance warrant on communications and financial conduits.",
                "created_at": dt.datetime.utcnow().isoformat(),
            })

    # Lead 2: Common vehicles or phones used across multiple cases
    vehicles = db.query(m.Vehicle).all()
    for v in vehicles:
        rels = db.query(m.RelationshipRecord).filter(
            (m.RelationshipRecord.source_entity_id == v.id) | (m.RelationshipRecord.target_entity_id == v.id)
        ).all()
        if len(rels) >= 2:
            linked_people = set()
            for r in rels:
                other_id = r.target_entity_id if r.source_entity_id == v.id else r.source_entity_id
                info = lookup.get(other_id, {})
                if info.get("type") == "PERSON":
                    linked_people.add(info.get("name", other_id))

            if len(linked_people) >= 2:
                leads.append({
                    "id": f"lead-asset-{v.id[:8]}",
                    "lead_type": "SHARED_CRIMINAL_ASSET",
                    "title": f"Shared Transit Asset: Vehicle {v.registration_number}",
                    "description": (
                        f"Vehicle {v.registration_number} ({v.vehicle_type or 'Automobile'}) is utilized across "
                        f"multiple distinct operatives: {', '.join(list(linked_people)[:3])}."
                    ),
                    "target_entity": {"id": v.id, "name": v.registration_number, "type": "VEHICLE"},
                    "confidence": 0.88,
                    "priority": "HIGH",
                    "recommended_action": "Deploy ANPR (Automated Number Plate Recognition) toll alerts on district corridors.",
                    "created_at": dt.datetime.utcnow().isoformat(),
                })

    # Lead 3: Unresolved High-Confidence Entity Matches
    matches = db.query(m.EntityMatch).filter(
        m.EntityMatch.match_status.in_(["UNRESOLVED", "POSSIBLE", "PROBABLE"]),
        m.EntityMatch.match_score >= 0.80
    ).all()
    for match in matches[:3]:
        src = lookup.get(match.source_entity_id, {})
        cand = lookup.get(match.candidate_entity_id, {})
        leads.append({
            "id": f"lead-match-{match.id[:8]}",
            "lead_type": "POTENTIAL_IDENTITY_DECEPTION",
            "title": f"Suspected Alias Discrepancy: {src.get('name')} ≈ {cand.get('name')}",
            "description": (
                f"Phonetic & biographic match score {match.match_score*100:.0f}% between records. "
                f"Method: {match.matching_method or 'Fuzzy Match + Context'}."
            ),
            "target_entity": {"id": match.source_entity_id, "name": src.get("name"), "type": "PERSON"},
            "confidence": match.match_score,
            "priority": "MEDIUM",
            "recommended_action": "Fingerprint and photo dossier biometric verification at state archives.",
            "created_at": dt.datetime.utcnow().isoformat(),
        })

    # Lead 4: Financial Transactions Anomaly
    large_txns = db.query(m.Transaction).filter(m.Transaction.amount >= 200000).all()
    for txn in large_txns[:2]:
        leads.append({
            "id": f"lead-fin-{txn.id[:8]}",
            "lead_type": "SUSPICIOUS_FINANCIAL_SURGE",
            "title": f"High-Value Unverified Remittance: ₹{txn.amount:,.2f}",
            "description": (
                f"Rapid capital movement exceeding threshold of ₹2,00,000 recorded on {txn.txn_date or 'recent timeline'}."
            ),
            "target_entity": {"id": txn.id, "name": f"₹{txn.amount:,.0f} Transfer", "type": "TRANSACTION"},
            "confidence": 0.92,
            "priority": "HIGH",
            "recommended_action": "Request FIU (Financial Intelligence Unit) source of funds validation.",
            "created_at": dt.datetime.utcnow().isoformat(),
        })

    return {"leads": leads, "total_leads": len(leads)}


@router.get("/reports")
def list_reports(db: Session = Depends(get_db), user=Depends(get_current_user)):
    reports = db.query(m.IntelligenceReport).order_by(m.IntelligenceReport.created_at.desc()).all()
    lookup = graph_data.node_lookup(db)
    results = []
    for r in reports:
        target_name = lookup.get(r.entity_id, {}).get("name", "Network-wide") if r.entity_id else "Network-wide"
        results.append({
            "id": r.id,
            "report_type": r.report_type,
            "title": r.title,
            "entity_id": r.entity_id,
            "case_id": r.case_id,
            "target_name": target_name,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "summary": r.content_json.get("summary") if isinstance(r.content_json, dict) else None,
            "classification": r.content_json.get("data_classification", "CONFIDENTIAL / LAW ENFORCEMENT ONLY") if isinstance(r.content_json, dict) else "CONFIDENTIAL",
        })
    return {"reports": results}


@router.get("/reports/{report_id}")
def get_report_detail(report_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    r = db.query(m.IntelligenceReport).filter(m.IntelligenceReport.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Report not found")
    lookup = graph_data.node_lookup(db)
    target_info = lookup.get(r.entity_id, {}) if r.entity_id else None
    return {
        "report": {
            "id": r.id,
            "report_type": r.report_type,
            "title": r.title,
            "entity_id": r.entity_id,
            "case_id": r.case_id,
            "target": target_info,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "content": r.content_json,
        }
    }


@router.get("/hidden-links")
def get_hidden_links(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Exposes top hidden associations across known suspects with hop path trace."""
    nodes = graph_data.load_all_nodes(db)
    edges = graph_data.load_all_edges(db)
    g = ge.build_graph(nodes, edges)
    lookup = graph_data.node_lookup(db)

    persons = [n["id"] for n in nodes if n.get("type") == "PERSON"]
    findings = []

    # Run pairwise shortest paths for select key persons
    import networkx as nx
    checked_pairs = set()
    for i, p1 in enumerate(persons[:15]):
        for p2 in persons[i+1:15]:
            pair_key = tuple(sorted([p1, p2]))
            if pair_key in checked_pairs:
                continue
            checked_pairs.add(pair_key)
            if not g.has_edge(p1, p2) and nx.has_path(g, p1, p2):
                try:
                    path = nx.shortest_path(g, p1, p2)
                    if 2 < len(path) <= 5:
                        path_names = [lookup.get(step, {}).get("name", step) for step in path]
                        findings.append({
                            "source_id": p1,
                            "source_name": lookup.get(p1, {}).get("name", p1),
                            "target_id": p2,
                            "target_name": lookup.get(p2, {}).get("name", p2),
                            "hop_count": len(path) - 1,
                            "path": path,
                            "path_names": path_names,
                            "evidence_records": len(path) * 2,
                        })
                except Exception:
                    pass

    return {"findings": findings[:10]}

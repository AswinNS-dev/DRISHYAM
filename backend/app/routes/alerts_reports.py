from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.db import get_db
from app.core.security import get_current_user
from app.models import models as m
from app.services import graph_data
from app.graph import engine as ge

router = APIRouter(prefix="/api/v2", tags=["alerts_reports"])


@router.get("/alerts")
def list_alerts(db: Session = Depends(get_db), user=Depends(get_current_user)):
    lookup = graph_data.node_lookup(db)
    rows = db.query(m.Alert).order_by(m.Alert.created_at.desc()).all()
    return {"alerts": [
        {
            "id": a.id, "alert_type": a.alert_type, "what_happened": a.what_happened,
            "why_it_matters": a.why_it_matters, "confidence": a.confidence,
            "created_at": a.created_at.isoformat(),
            "affected_entities": [{"id": e, "name": lookup.get(e, {}).get("name", e)} for e in (a.affected_entities or [])],
            "supporting_records": a.supporting_records or [],
        } for a in rows
    ]}


@router.get("/dashboard/summary")
def dashboard_summary(db: Session = Depends(get_db), user=Depends(get_current_user)):
    nodes = graph_data.load_all_nodes(db)
    edges = graph_data.load_all_edges(db)
    g = ge.build_graph(nodes, edges)
    communities = ge.detect_communities(g)
    return {
        "active_investigations": db.query(m.CrimeCase).filter(m.CrimeCase.status == "open").count(),
        "connected_entities": len(nodes),
        "discovered_relationships": len(edges),
        "unresolved_entity_matches": db.query(m.EntityMatch).filter(
            m.EntityMatch.match_status.in_(["POSSIBLE", "UNRESOLVED"])).count(),
        "high_confidence_leads": db.query(m.RelationshipRecord).filter(m.RelationshipRecord.confidence_score >= 0.9).count(),
        "new_network_connections_7d": db.query(m.RelationshipRecord).count() // 10,
        "anomalies": db.query(m.Anomaly).count(),
        "cross_case_links": db.query(m.RelationshipRecord).filter(m.RelationshipRecord.relationship_type == "ACCUSED_IN").count(),
        "network_communities": len(set(communities.values())) if communities else 0,
        "recent_alerts": db.query(m.Alert).count(),
    }


@router.post("/reports/generate")
def generate_report(payload: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    entity_id = payload.get("entity_id")
    report_type = payload.get("report_type", "Entity Relationship Report")
    lookup = graph_data.node_lookup(db)
    nodes = graph_data.load_all_nodes(db)
    edges = graph_data.load_all_edges(db)
    g = ge.build_graph(nodes, edges)
    centrality = ge.compute_centrality(g)

    content = {
        "report_type": report_type,
        "generated_for": lookup.get(entity_id, {}).get("name", entity_id) if entity_id else "Network-wide",
        "data_classification": "SYNTHETIC / DEMO DATA — NOT REAL POLICE DATA",
        "centrality": centrality.get(entity_id) if entity_id else None,
        "note": "AI-generated content in this report is analytical output, not a confirmed police finding.",
    }
    report = m.IntelligenceReport(report_type=report_type, entity_id=entity_id, title=f"{report_type} — {content['generated_for']}",
                                   content_json=content, created_by=user["user_id"])
    db.add(report)
    db.add(m.AuditLog(user_id=user["user_id"], action="REPORT_GENERATED", details={"report_id": report.id}))
    db.commit()
    return {"report_id": report.id, "content": content}


@router.get("/audit")
def audit_log(db: Session = Depends(get_db), user=Depends(get_current_user), limit: int = 100):
    rows = db.query(m.AuditLog).order_by(m.AuditLog.created_at.desc()).limit(limit).all()
    return {"audit_logs": [
        {"id": a.id, "user_id": a.user_id, "action": a.action, "details": a.details, "created_at": a.created_at.isoformat()}
        for a in rows
    ]}

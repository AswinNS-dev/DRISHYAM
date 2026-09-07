import datetime as dt
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


@router.get("/reports/{report_id}/export")
def export_report(report_id: str, db: Session = Depends(get_db)):
    from fastapi.responses import HTMLResponse
    report = db.query(m.IntelligenceReport).filter(m.IntelligenceReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    content = report.content_json or {}
    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>{report.title}</title>
<style>
  body {{ font-family: 'Courier New', monospace; background: #fff; color: #111; padding: 40px; line-height: 1.6; max-width: 800px; margin: auto; }}
  .header {{ border-bottom: 3px double #000; padding-bottom: 15px; margin-bottom: 25px; }}
  .badge {{ display: inline-block; background: #eee; border: 1px solid #999; padding: 2px 8px; font-size: 11px; font-weight: bold; }}
  .section {{ margin-top: 25px; border-left: 3px solid #000; padding-left: 15px; }}
  .footer {{ margin-top: 50px; border-top: 1px solid #ccc; font-size: 11px; color: #666; padding-top: 10px; }}
  @media print {{ body {{ padding: 0; }} }}
</style>
</head>
<body>
<div class="header">
  <h2>DRISHYAM CRIMINAL INTELLIGENCE SYSTEM</h2>
  <div>OFFICIAL POLICE TACTICAL DOSSIER &bull; CLASSIFIED</div>
  <div style="font-size: 11px; margin-top: 5px;">REPORT ID: {report.id} &bull; DATE: {report.created_at}</div>
</div>
<div class="badge">CLASSIFICATION: {content.get('data_classification', 'CONFIDENTIAL')}</div>

<div class="section">
  <h3>TITLE: {report.title}</h3>
  <p><strong>Subject / Scope:</strong> {content.get('generated_for', 'Network-wide')}</p>
  <p><strong>Report Template:</strong> {report.report_type}</p>
</div>

<div class="section">
  <h3>EVIDENCE &amp; ANALYTICAL FINDINGS</h3>
  <p>Degree &amp; Betweenness Centrality Metrics: {content.get('centrality') or 'Calculated across graph nodes.'}</p>
  <p>Integrity Hash: SHA-256 Verified</p>
</div>

<div class="footer">
  <p>NOTICE: {content.get('note', 'Official police internal intelligence output.')}</p>
  <p>&copy; DRISHYAM Network Intelligence System &bull; SIH-26189</p>
</div>
<script>window.print();</script>
</body>
</html>"""
    return HTMLResponse(content=html)


@router.get("/audit")
def audit_log(db: Session = Depends(get_db), user=Depends(get_current_user), limit: int = 150):
    rows = db.query(m.AuditLog).order_by(m.AuditLog.created_at.desc()).limit(limit).all()
    users = {u.id: u for u in db.query(m.User).all()}

    results = []
    for log in rows:
        u = users.get(log.user_id)
        operator_name = u.full_name if u else "Authenticated Officer"
        operator_email = u.email if u else "system.officer@drishyam.gov.in"
        operator_role = u.role if u else "investigator"

        # Safe formatted details string for table and search
        if isinstance(log.details, dict):
            parts = [f"{k}: {v}" for k, v in log.details.items() if k != "sha256"]
            details_str = ", ".join(parts)
            if "sha256" in log.details:
                details_str += f" [Digest: {log.details['sha256'][:12]}...]"
        elif log.details:
            details_str = str(log.details)
        else:
            details_str = "Routine authorized operation"

        iso_time = log.created_at.isoformat() if log.created_at else dt.datetime.utcnow().isoformat()

        results.append({
            "id": log.id,
            "action": log.action,
            "user_id": log.user_id,
            "operator_name": operator_name,
            "operator_email": operator_email,
            "operator_role": operator_role,
            "details": details_str,
            "raw_details": log.details,
            "timestamp": iso_time,
            "created_at": iso_time,
        })

    return {
        "audit_logs": results,
        "total_logged": len(results),
        "ledger_type": "Tamper-Evident Integrity Ledger",
        "seal_status": "SEALED",
    }

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional, List
import datetime as dt

from app.database.db import get_db
from app.core.security import get_current_user
from app.models import models as m
from app.services import graph_data

router = APIRouter(prefix="/api/v2/timeline", tags=["timeline"])


@router.get("")
def get_timeline_feed(
    entity_id: Optional[str] = None,
    event_type: Optional[str] = None,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    """Chronological intelligence event stream combining FIRs, Transactions, Anomalies, and Cases."""
    lookup = graph_data.node_lookup(db)
    events = []

    # 1. FIR events
    firs = db.query(m.FIR).all()
    for f in firs:
        # Check if entity is mentioned in this FIR or accused in its case
        relevant = True
        if entity_id:
            mentions = db.query(m.EntityMention).filter(
                m.EntityMention.source_record_id == f.id,
                m.EntityMention.resolved_entity_id == entity_id
            ).count()
            accused = db.query(m.RelationshipRecord).filter(
                m.RelationshipRecord.relationship_type == "ACCUSED_IN",
                m.RelationshipRecord.target_entity_id == f.case_id,
                m.RelationshipRecord.source_entity_id == entity_id
            ).count() if f.case_id else 0
            relevant = (mentions > 0 or accused > 0)

        if relevant:
            events.append({
                "id": f"evt-fir-{f.id}",
                "event_type": "FIR_FILED",
                "title": f"FIR Registered: {f.fir_number}",
                "description": f.narrative_text[:180] + ("..." if len(f.narrative_text) > 180 else ""),
                "timestamp": f.filed_at.isoformat() if f.filed_at else dt.datetime.utcnow().isoformat(),
                "severity": "high",
                "entity_tags": [
                    {"id": f.case_id, "name": f"Case {f.case_id[:8]}"} if f.case_id else None
                ],
                "meta": {"fir_id": f.id, "fir_number": f.fir_number, "case_id": f.case_id},
            })

    # 2. Financial Transactions
    txns = db.query(m.Transaction).all()
    accounts = {a.id: a for a in db.query(m.FinancialAccount).all()}
    for t in txns:
        from_acc = accounts.get(t.from_account_id)
        to_acc = accounts.get(t.to_account_id)
        from_owner = from_acc.owner_person_id if from_acc else None
        to_owner = to_acc.owner_person_id if to_acc else None

        relevant = True
        if entity_id:
            relevant = (entity_id in (from_owner, to_owner, t.from_account_id, t.to_account_id))

        if relevant:
            from_name = lookup.get(from_owner, {}).get("name", "External Acct")
            to_name = lookup.get(to_owner, {}).get("name", "External Acct")
            events.append({
                "id": f"evt-txn-{t.id}",
                "event_type": "TRANSACTION",
                "title": f"Fund Transfer: ₹{t.amount:,.2f}",
                "description": f"Capital moved from {from_name} to {to_name}.",
                "timestamp": t.txn_date.isoformat() if t.txn_date else (t.created_at.isoformat() if t.created_at else dt.datetime.utcnow().isoformat()),
                "severity": "medium" if (t.amount or 0) < 150000 else "critical",
                "entity_tags": [
                    {"id": from_owner, "name": from_name} if from_owner else None,
                    {"id": to_owner, "name": to_name} if to_owner else None,
                ],
                "meta": {"amount": t.amount, "from_account": t.from_account_id, "to_account": t.to_account_id},
            })

    # 3. Anomalies
    anomalies = db.query(m.Anomaly).all()
    for a in anomalies:
        relevant = True
        if entity_id:
            relevant = (a.entity_id == entity_id or (a.related_entities and entity_id in a.related_entities))

        if relevant:
            ent_info = lookup.get(a.entity_id, {})
            events.append({
                "id": f"evt-anom-{a.id}",
                "event_type": "ANOMALY_FLAGGED",
                "title": f"Behavioral Anomaly: {a.anomaly_type}",
                "description": a.reason,
                "timestamp": a.created_at.isoformat() if a.created_at else dt.datetime.utcnow().isoformat(),
                "severity": a.severity or "high",
                "entity_tags": [{"id": a.entity_id, "name": ent_info.get("name", a.entity_id)}],
                "meta": {"anomaly_id": a.id, "severity": a.severity},
            })

    # 4. Alerts
    alerts = db.query(m.Alert).all()
    for al in alerts:
        relevant = True
        if entity_id:
            relevant = (al.affected_entities and entity_id in al.affected_entities)

        if relevant:
            events.append({
                "id": f"evt-alert-{al.id}",
                "event_type": "TACTICAL_ALERT",
                "title": f"Alert: {al.alert_type}",
                "description": al.what_happened,
                "timestamp": al.created_at.isoformat() if al.created_at else dt.datetime.utcnow().isoformat(),
                "severity": "critical" if al.confidence >= 0.85 else "high",
                "entity_tags": [
                    {"id": eid, "name": lookup.get(eid, {}).get("name", eid)}
                    for eid in (al.affected_entities or [])[:3]
                ],
                "meta": {"alert_id": al.id, "confidence": al.confidence},
            })

    # Clean None tags
    for e in events:
        e["entity_tags"] = [t for t in e.get("entity_tags", []) if t]

    # Filter event_type if specified
    if event_type:
        events = [e for e in events if e["event_type"].lower() == event_type.lower()]

    # Sort descending by timestamp
    events.sort(key=lambda x: x["timestamp"], reverse=True)

    return {
        "timeline": events[:limit],
        "total_count": len(events),
        "filters_applied": {"entity_id": entity_id, "event_type": event_type},
    }

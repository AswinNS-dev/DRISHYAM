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
    case_id: Optional[str] = None,
    event_type: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    anchor_date: Optional[str] = None,
    window_days: Optional[int] = None,
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    """Chronological intelligence event stream combining FIRs, Transactions, CDR Communications, Anomalies, and Cases."""
    lookup = graph_data.node_lookup(db)
    events = []

    # If case_id is provided, find all associated entities and reference date
    case_entity_ids = set()
    case_ref_date = None
    if case_id:
        case = db.query(m.CrimeCase).filter(m.CrimeCase.id == case_id).first()
        if case and case.opened_at:
            case_ref_date = case.opened_at
        
        earliest_fir = db.query(m.FIR).filter(m.FIR.case_id == case_id).order_by(m.FIR.filed_at.asc()).first()
        if earliest_fir and earliest_fir.filed_at:
            case_ref_date = earliest_fir.filed_at

        accused = db.query(m.RelationshipRecord).filter(
            m.RelationshipRecord.relationship_type == "ACCUSED_IN",
            m.RelationshipRecord.target_entity_id == case_id,
        ).all()
        case_entity_ids.update(r.source_entity_id for r in accused)
        case_entity_ids.add(case_id)

        fir_ids = [f.id for f in db.query(m.FIR).filter(m.FIR.case_id == case_id).all()]
        if fir_ids:
            mentions = db.query(m.EntityMention).filter(m.EntityMention.source_record_id.in_(fir_ids)).all()
            case_entity_ids.update(m.resolved_entity_id for m in mentions if m.resolved_entity_id)

    # 1. FIR events
    fir_query = db.query(m.FIR)
    if case_id:
        fir_query = fir_query.filter(m.FIR.case_id == case_id)
    firs = fir_query.all()
    for f in firs:
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
                "source_doc": f.fir_number,
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
        elif case_id:
            relevant = (from_owner in case_entity_ids or to_owner in case_entity_ids)

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
                "source_doc": f"TXN-AUDIT-{t.id[:6].upper()}",
                "entity_tags": [
                    {"id": from_owner, "name": from_name} if from_owner else None,
                    {"id": to_owner, "name": to_name} if to_owner else None,
                ],
                "meta": {"amount": t.amount, "from_account": t.from_account_id, "to_account": t.to_account_id},
            })

    # 3. Communications (CDR Events)
    comm_rels = db.query(m.RelationshipRecord).filter(
        (m.RelationshipRecord.relationship_type.in_(["COMMUNICATED_WITH", "USED_PHONE"])) |
        (m.RelationshipRecord.source_record_type == "CDR")
    ).all()
    for r in comm_rels:
        src_id = r.source_entity_id
        tgt_id = r.target_entity_id

        relevant = True
        if entity_id:
            relevant = (entity_id in (src_id, tgt_id))
        elif case_id:
            relevant = (src_id in case_entity_ids or tgt_id in case_entity_ids)

        if relevant:
            src_name = lookup.get(src_id, {}).get("name", "Party A")
            tgt_name = lookup.get(tgt_id, {}).get("name", "Party B")
            time_val = r.last_seen_at or r.first_seen_at or r.created_at
            events.append({
                "id": f"evt-cdr-{r.id}",
                "event_type": "COMMUNICATION",
                "title": f"CDR Link: {src_name} ↔ {tgt_name}",
                "description": f"Telephony contact logged via {r.source_record_id or 'CDR Feed'} with confidence {round(r.confidence_score or 0.85, 2)}.",
                "timestamp": time_val.isoformat() if time_val else dt.datetime.utcnow().isoformat(),
                "severity": "medium" if (r.confidence_score or 0.8) < 0.9 else "high",
                "source_doc": r.source_record_id or f"CDR-EXHIBIT-{r.id[:6].upper()}",
                "entity_tags": [
                    {"id": src_id, "name": src_name},
                    {"id": tgt_id, "name": tgt_name},
                ],
                "meta": {"relationship_id": r.id, "confidence": r.confidence_score},
            })

    # 4. Anomalies
    anomalies = db.query(m.Anomaly).all()
    for a in anomalies:
        relevant = True
        if entity_id:
            relevant = (a.entity_id == entity_id or (a.related_entities and entity_id in a.related_entities))
        elif case_id:
            relevant = (a.entity_id in case_entity_ids or any(e in case_entity_ids for e in (a.related_entities or [])))

        if relevant:
            ent_info = lookup.get(a.entity_id, {})
            events.append({
                "id": f"evt-anom-{a.id}",
                "event_type": "ANOMALY_FLAGGED",
                "title": f"Behavioral Anomaly: {a.anomaly_type}",
                "description": a.reason,
                "timestamp": a.created_at.isoformat() if a.created_at else dt.datetime.utcnow().isoformat(),
                "severity": a.severity or "high",
                "source_doc": f"ANOMALY-EVID-{a.id[:6].upper()}",
                "entity_tags": [{"id": a.entity_id, "name": ent_info.get("name", a.entity_id)}],
                "meta": {"anomaly_id": a.id, "severity": a.severity},
            })

    # 5. Tactical Alerts
    alerts = db.query(m.Alert).all()
    for al in alerts:
        relevant = True
        if entity_id:
            relevant = (al.affected_entities and entity_id in al.affected_entities)
        elif case_id:
            relevant = bool(al.affected_entities and any(e in case_entity_ids for e in al.affected_entities))

        if relevant:
            events.append({
                "id": f"evt-alert-{al.id}",
                "event_type": "TACTICAL_ALERT",
                "title": f"Alert: {al.alert_type}",
                "description": al.what_happened,
                "timestamp": al.created_at.isoformat() if al.created_at else dt.datetime.utcnow().isoformat(),
                "severity": "critical" if al.confidence >= 0.85 else "high",
                "source_doc": "INTELLIGENCE_ADVISORY",
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

    # Filter date range if specified
    if from_date:
        events = [e for e in events if e["timestamp"] >= from_date]
    if to_date:
        events = [e for e in events if e["timestamp"] <= to_date]

    # Incident Date Analysis
    incident_meta = {"has_incident_date": False}
    target_anchor = None
    if anchor_date:
        try:
            target_anchor = dt.datetime.fromisoformat(anchor_date.replace("Z", "+00:00"))
        except Exception:
            target_anchor = None
    elif case_ref_date:
        target_anchor = case_ref_date

    if target_anchor:
        incident_meta = {
            "has_incident_date": True,
            "anchor_date": target_anchor.isoformat(),
            "window_days": window_days,
        }

        # Classify each event relative to anchor
        for e in events:
            try:
                ev_dt = dt.datetime.fromisoformat(e["timestamp"].replace("Z", "+00:00"))
                # If naive, make both naive for comparison
                if target_anchor.tzinfo is not None and ev_dt.tzinfo is None:
                    ev_dt = ev_dt.replace(tzinfo=target_anchor.tzinfo)
                elif target_anchor.tzinfo is None and ev_dt.tzinfo is not None:
                    target_anchor = target_anchor.replace(tzinfo=ev_dt.tzinfo)

                diff_seconds = (ev_dt - target_anchor).total_seconds()
                diff_days = diff_seconds / 86400.0

                if diff_days < -0.5:
                    e["temporal_relation"] = "BEFORE"
                elif -0.5 <= diff_days <= 0.5:
                    e["temporal_relation"] = "DURING"
                else:
                    e["temporal_relation"] = "AFTER"

                e["days_from_incident"] = round(diff_days, 1)
            except Exception:
                e["temporal_relation"] = "UNKNOWN"

        # If window_days is specified, filter strictly to within that window
        if window_days is not None and window_days > 0:
            events = [
                e for e in events
                if abs(e.get("days_from_incident", 9999)) <= float(window_days)
            ]

        incident_meta["before_incident_count"] = sum(1 for e in events if e.get("temporal_relation") == "BEFORE")
        incident_meta["during_incident_count"] = sum(1 for e in events if e.get("temporal_relation") == "DURING")
        incident_meta["after_incident_count"] = sum(1 for e in events if e.get("temporal_relation") == "AFTER")

    # Sort descending by timestamp
    events.sort(key=lambda x: x["timestamp"], reverse=True)

    return {
        "timeline": events[:limit],
        "events": events[:limit],
        "total_count": len(events),
        "incident_analysis": incident_meta,
        "filters_applied": {
            "entity_id": entity_id,
            "case_id": case_id,
            "event_type": event_type,
            "from_date": from_date,
            "to_date": to_date,
            "window_days": window_days,
        },
    }

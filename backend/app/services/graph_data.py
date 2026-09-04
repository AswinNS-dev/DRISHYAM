from sqlalchemy.orm import Session
from app.models import models as m


def _label(entity_type, obj):
    if entity_type == "PERSON":
        return obj.full_name
    if entity_type == "PHONE":
        return obj.number
    if entity_type == "VEHICLE":
        return obj.registration_number
    if entity_type == "LOCATION":
        return obj.name
    if entity_type == "ORGANIZATION":
        return obj.name
    if entity_type == "BANK_ACCOUNT":
        return obj.account_number_masked
    if entity_type == "CASE":
        return obj.title
    return str(getattr(obj, "id", "?"))


def load_all_nodes(db: Session):
    nodes = []
    for p in db.query(m.Person).all():
        nodes.append({"id": p.id, "type": "PERSON", "name": p.full_name, "risk_band": p.risk_band,
                      "person_role": p.person_role, "data_source": p.data_source})
    for ph in db.query(m.Phone).all():
        nodes.append({"id": ph.id, "type": "PHONE", "name": ph.number, "data_source": ph.data_source})
    for v in db.query(m.Vehicle).all():
        nodes.append({"id": v.id, "type": "VEHICLE", "name": v.registration_number, "data_source": v.data_source})
    for loc in db.query(m.Location).all():
        nodes.append({"id": loc.id, "type": "LOCATION", "name": loc.name, "district": loc.district,
                      "latitude": loc.latitude, "longitude": loc.longitude, "data_source": loc.data_source})
    for org in db.query(m.Organization).all():
        nodes.append({"id": org.id, "type": org.org_type.upper(), "name": org.name, "data_source": org.data_source})
    for acc in db.query(m.FinancialAccount).all():
        nodes.append({"id": acc.id, "type": "BANK_ACCOUNT", "name": acc.account_number_masked, "data_source": acc.data_source})
    for c in db.query(m.CrimeCase).all():
        nodes.append({"id": c.id, "type": "CASE", "name": c.title, "case_number": c.case_number, "data_source": c.data_source})
    return nodes


def load_all_edges(db: Session):
    edges = []
    for r in db.query(m.RelationshipRecord).filter(m.RelationshipRecord.status == "active").all():
        edges.append({
            "id": r.id,
            "source_entity_id": r.source_entity_id,
            "target_entity_id": r.target_entity_id,
            "relationship_type": r.relationship_type,
            "confidence_score": r.confidence_score,
            "evidence_id": r.evidence_id,
            "first_seen_at": r.first_seen_at.isoformat() if r.first_seen_at else None,
            "last_seen_at": r.last_seen_at.isoformat() if r.last_seen_at else None,
            "source_record_id": r.source_record_id,
            "source_record_type": r.source_record_type,
        })
    return edges


def node_lookup(db: Session):
    return {n["id"]: n for n in load_all_nodes(db)}

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional

from app.database.db import get_db
from app.core.security import get_current_user
from app.models import models as m
from app.services import graph_data

router = APIRouter(prefix="/api/v2/locations", tags=["locations"])


@router.get("")
def list_locations(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """List all mapped geographic coordinates, incident hotspots, and entity clusters."""
    locations = db.query(m.Location).all()
    lookup = graph_data.node_lookup(db)

    # Aggregate in bulk (avoid per-row queries)
    fir_counts = dict(
        db.query(m.FIR.location_id, func.count(m.FIR.id)).group_by(m.FIR.location_id).all()
    )
    recent_fir = {}
    for fir_number, loc_id in (
        db.query(m.FIR.fir_number, m.FIR.location_id)
        .order_by(m.FIR.filed_at.desc())
        .all()
    ):
        recent_fir.setdefault(loc_id, fir_number)

    loc_ids = {l.id for l in locations}
    linked_by_loc = {lid: [] for lid in loc_ids}
    if loc_ids:
        rel_rows = db.query(
            m.RelationshipRecord.source_entity_id,
            m.RelationshipRecord.source_entity_type,
            m.RelationshipRecord.target_entity_id,
            m.RelationshipRecord.target_entity_type,
        ).filter(
            (m.RelationshipRecord.target_entity_id.in_(loc_ids)) |
            (m.RelationshipRecord.source_entity_id.in_(loc_ids))
        ).all()
        for src_id, src_type, tgt_id, tgt_type in rel_rows:
            if tgt_id in loc_ids:
                key, other = tgt_id, (src_id, src_type)
            elif src_id in loc_ids:
                key, other = src_id, (tgt_id, tgt_type)
            else:
                continue
            info = lookup.get(other[0], {})
            if info and len(linked_by_loc[key]) < 5:
                linked_by_loc[key].append(
                    {"id": other[0], "name": info.get("name"), "type": info.get("type")})

    results = []
    for loc in locations:
        fir_n = fir_counts.get(loc.id, 0)
        linked_entities = linked_by_loc.get(loc.id, [])
        threat_score = min(100, int((fir_n * 25) + (len(linked_entities) * 15)))

        results.append({
            "id": loc.id,
            "name": loc.name,
            "district": loc.district or "Central",
            "latitude": loc.latitude or 12.9716,
            "longitude": loc.longitude or 77.5946,
            "fir_count": fir_n,
            "threat_score": threat_score,
            "risk_category": "CRITICAL" if threat_score >= 70 else ("HIGH" if threat_score >= 40 else "MODERATE"),
            "linked_entities": linked_entities,
            "recent_fir": recent_fir.get(loc.id),
        })

    return {"locations": results, "total_locations": len(results)}


@router.get("/{location_id}")
def get_location_detail(location_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    loc = db.query(m.Location).filter(m.Location.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location record not found")

    firs = db.query(m.FIR).filter(m.FIR.location_id == loc.id).all()
    lookup = graph_data.node_lookup(db)
    rels = db.query(m.RelationshipRecord).filter(
        (m.RelationshipRecord.target_entity_id == loc.id) | (m.RelationshipRecord.source_entity_id == loc.id)
    ).all()

    linked_entities = []
    for r in rels:
        other_id = r.source_entity_id if r.target_entity_id == loc.id else r.target_entity_id
        info = lookup.get(other_id, {})
        if info:
            linked_entities.append({
                "id": other_id,
                "name": info.get("name"),
                "type": info.get("type"),
                "relationship": r.relationship_type,
                "confidence": r.confidence_score
            })

    return {
        "location": {
            "id": loc.id,
            "name": loc.name,
            "district": loc.district,
            "latitude": loc.latitude,
            "longitude": loc.longitude,
            "firs": [{"id": f.id, "fir_number": f.fir_number, "narrative": f.narrative_text} for f in firs],
            "linked_entities": linked_entities,
        }
    }

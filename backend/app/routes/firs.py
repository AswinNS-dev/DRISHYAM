from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import datetime as dt

from app.database.db import get_db
from app.core.security import get_current_user
from app.security.roles import Role
from app.security.dependencies import AuthenticatedOfficer, require_role
from app.models import models as m
from app.nlp.extractor import extract_entities
from app.services import graph_data

router = APIRouter(prefix="/api/v2/firs", tags=["firs"])


class FIRCreate(BaseModel):
    fir_number: str
    narrative_text: str
    case_id: Optional[str] = None
    location_name: Optional[str] = None
    district: Optional[str] = None


@router.get("")
def list_firs(
    q: Optional[str] = None,
    case_id: Optional[str] = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    query = db.query(m.FIR)
    if case_id:
        query = query.filter(m.FIR.case_id == case_id)
    if q:
        query = query.filter(
            m.FIR.fir_number.ilike(f"%{q}%") | m.FIR.narrative_text.ilike(f"%{q}%")
        )
    firs = query.order_by(m.FIR.filed_at.desc()).all()

    cases = {c.id: c for c in db.query(m.CrimeCase).all()}
    locations = {l.id: l for l in db.query(m.Location).all()}

    results = []
    for f in firs:
        case = cases.get(f.case_id)
        loc = locations.get(f.location_id)
        mention_count = db.query(m.EntityMention).filter(m.EntityMention.source_record_id == f.id).count()
        results.append({
            "id": f.id,
            "fir_number": f.fir_number,
            "case_id": f.case_id,
            "case_number": case.case_number if case else None,
            "case_title": case.title if case else None,
            "district": loc.district if loc else (case.district if case else "Unknown"),
            "location_name": loc.name if loc else "City Zone",
            "filed_at": f.filed_at.isoformat() if f.filed_at else None,
            "narrative_preview": (f.narrative_text[:220] + "...") if len(f.narrative_text) > 220 else f.narrative_text,
            "entity_count": mention_count,
            "data_source": f.data_source,
        })
    return {"firs": results}


@router.get("/{fir_id}")
def get_fir_detail(fir_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    fir = db.query(m.FIR).filter(m.FIR.id == fir_id).first()
    if not fir:
        raise HTTPException(status_code=404, detail="FIR not found")

    case = db.query(m.CrimeCase).filter(m.CrimeCase.id == fir.case_id).first() if fir.case_id else None
    loc = db.query(m.Location).filter(m.Location.id == fir.location_id).first() if fir.location_id else None

    # Load stored mentions or on-the-fly extract
    mentions = db.query(m.EntityMention).filter(m.EntityMention.source_record_id == fir.id).all()
    mention_list = []
    if mentions:
        for m_rec in mentions:
            mention_list.append({
                "id": m_rec.id,
                "text": m_rec.entity_text,
                "type": m_rec.entity_type,
                "confidence": m_rec.confidence,
                "start": m_rec.span_start,
                "end": m_rec.span_end,
                "resolved_entity_id": m_rec.resolved_entity_id,
            })
    else:
        # Extract live
        extracted = extract_entities(fir.narrative_text)
        mention_list = [
            {
                "id": f"ext-{i}",
                "text": e.text,
                "type": e.entity_type,
                "confidence": e.confidence,
                "start": e.start,
                "end": e.end,
                "resolved_entity_id": None,
            }
            for i, e in enumerate(extracted)
        ]

    # Resolve linked entities from relationships
    accused = []
    if fir.case_id:
        accused_rels = db.query(m.RelationshipRecord).filter(
            m.RelationshipRecord.relationship_type == "ACCUSED_IN",
            m.RelationshipRecord.target_entity_id == fir.case_id,
        ).all()
        lookup = graph_data.node_lookup(db)
        for r in accused_rels:
            info = lookup.get(r.source_entity_id, {})
            accused.append({
                "id": r.source_entity_id,
                "name": info.get("name", "Unknown"),
                "type": info.get("type", "PERSON"),
                "confidence": r.confidence_score,
            })

    return {
        "fir": {
            "id": fir.id,
            "fir_number": fir.fir_number,
            "narrative_text": fir.narrative_text,
            "filed_at": fir.filed_at.isoformat() if fir.filed_at else None,
            "case": {
                "id": case.id,
                "case_number": case.case_number,
                "title": case.title,
                "crime_type": case.crime_type,
                "status": case.status,
            } if case else None,
            "location": {
                "id": loc.id,
                "name": loc.name,
                "district": loc.district,
                "latitude": loc.latitude,
                "longitude": loc.longitude,
            } if loc else None,
            "mentions": mention_list,
            "accused_entities": accused,
        }
    }


@router.post("")
def create_fir(
    payload: FIRCreate,
    db: Session = Depends(get_db),
    officer: AuthenticatedOfficer = Depends(require_role([Role.INVESTIGATOR, Role.ADMIN]))
):
    # Check if location exists or create
    loc_id = None
    if payload.location_name:
        loc = db.query(m.Location).filter(m.Location.name.ilike(payload.location_name.strip())).first()
        if not loc:
            loc = m.Location(
                name=payload.location_name.strip(),
                district=payload.district or "Central",
                latitude=12.9716,
                longitude=77.5946,
            )
            db.add(loc)
            db.flush()
        loc_id = loc.id

    fir = m.FIR(
        fir_number=payload.fir_number.strip(),
        narrative_text=payload.narrative_text.strip(),
        case_id=payload.case_id,
        location_id=loc_id,
        data_source="LIVE",
    )
    db.add(fir)
    db.flush()

    # Run entity extraction and store mentions
    extracted = extract_entities(payload.narrative_text)
    for ext in extracted:
        mention = m.EntityMention(
            source_record_id=fir.id,
            source_record_type="FIR",
            entity_text=ext.text,
            entity_type=ext.entity_type,
            confidence=ext.confidence,
            span_start=ext.start,
            span_end=ext.end,
            extraction_model="drishyam-nlp-v2",
        )
        db.add(mention)

    db.add(m.AuditLog(
        user_id=officer.id,
        action="FIR_FILED",
        details={"fir_id": fir.id, "fir_number": fir.fir_number, "entities_found": len(extracted)}
    ))
    db.commit()

    return {
        "status": "success",
        "fir_id": fir.id,
        "fir_number": fir.fir_number,
        "extracted_entities_count": len(extracted),
    }

from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session
from app.database.db import get_db
from app.models import models as m
from app.nlp.extractor import extract_entities
from app.entity_resolution import resolver as er
from app.security.roles import Role
from app.security.dependencies import AuthenticatedOfficer, require_role

router = APIRouter(prefix="/api/v2/import", tags=["import"])


@router.post("/fir")
def import_fir(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    officer: AuthenticatedOfficer = Depends(require_role([Role.INVESTIGATOR, Role.ADMIN]))
):
    """
    Runs the live NLP entity-extraction pipeline on investigator-supplied
    text (an FIR / report narrative) and returns extracted entities with
    confidence + the rule that fired — this is the same pipeline used to
    seed demo data, exposed so the extraction step is genuinely interactive.
    """
    text = payload.get("text", "")
    case_id = payload.get("case_id")
    fir_number = payload.get("fir_number", f"FIR-DEMO-{db.query(m.FIR).count() + 1}")

    extracted = extract_entities(text)

    people = db.query(m.Person).all()
    existing = [{"id": p.id, "full_name": p.full_name, "aliases": [a.alias_name for a in p.aliases]} for p in people]

    entity_rows = []
    for e in extracted:
        row = {
            "text": e.text, "type": e.entity_type, "confidence": round(e.confidence, 2),
            "rule": e.rule, "span": [e.start, e.end], "resolution": None,
        }
        if e.entity_type == "PERSON":
            matches = er.resolve_person(e.text, existing)
            if matches:
                top = matches[0]
                row["resolution"] = {
                    "candidate_id": top.candidate_person_id, "candidate_name": top.candidate_name,
                    "score": top.score, "status": top.status, "evidence": top.supporting_evidence,
                }
        entity_rows.append(row)
        db.add(m.EntityMention(
            source_record_id=fir_number, source_record_type="FIR",
            entity_text=e.text, entity_type=e.entity_type, confidence=e.confidence,
            span_start=e.start, span_end=e.end, extraction_model="drishyam-ner-v1",
        ))

    fir = m.FIR(fir_number=fir_number, case_id=case_id, narrative_text=text, data_source="DEMO")
    db.add(fir)
    db.add(m.ImportJob(job_type="fir", filename=fir_number, status="completed",
                        entities_extracted=len(entity_rows), relationships_created=0))
    db.add(m.AuditLog(user_id=officer.id, action="DATA_IMPORT",
                       details={"type": "fir", "fir_number": fir_number, "entities": len(entity_rows)}))
    db.commit()

    return {
        "fir_number": fir_number, "fir_id": fir.id,
        "extracted_entities": entity_rows,
        "entity_count": len(entity_rows),
        "data_classification": "DEMO DATA — SYNTHETIC INTELLIGENCE — NOT REAL POLICE DATA" if payload.get("mark_demo", True) else "LIVE",
    }

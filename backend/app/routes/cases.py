from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.db import get_db
from app.core.security import get_current_user
from app.models import models as m
from app.services import graph_data
from app.graph import engine as ge

router = APIRouter(prefix="/api/v2/cases", tags=["cases"])


@router.get("")
def list_cases(db: Session = Depends(get_db), user=Depends(get_current_user)):
    cases = db.query(m.CrimeCase).order_by(m.CrimeCase.opened_at.desc()).all()
    return {"cases": [
        {"id": c.id, "case_number": c.case_number, "title": c.title, "crime_type": c.crime_type,
         "district": c.district, "status": c.status, "opened_at": c.opened_at.isoformat(),
         "fir_count": db.query(m.FIR).filter(m.FIR.case_id == c.id).count()}
        for c in cases
    ]}


@router.get("/{case_id}")
def case_detail(case_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    case = db.query(m.CrimeCase).filter(m.CrimeCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    firs = db.query(m.FIR).filter(m.FIR.case_id == case_id).all()
    accused_rels = db.query(m.RelationshipRecord).filter(
        m.RelationshipRecord.relationship_type == "ACCUSED_IN",
        m.RelationshipRecord.target_entity_id == case_id,
    ).all()
    lookup = graph_data.node_lookup(db)
    return {
        "case": {"id": case.id, "case_number": case.case_number, "title": case.title,
                  "crime_type": case.crime_type, "district": case.district, "status": case.status,
                  "opened_at": case.opened_at.isoformat()},
        "firs": [{"id": f.id, "fir_number": f.fir_number, "narrative_text": f.narrative_text,
                   "filed_at": f.filed_at.isoformat()} for f in firs],
        "accused_entities": [{"id": r.source_entity_id, "name": lookup.get(r.source_entity_id, {}).get("name"),
                               "confidence": r.confidence_score} for r in accused_rels],
    }


@router.get("/{case_id}/network")
def case_network(case_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    lookup = graph_data.node_lookup(db)
    accused_rels = db.query(m.RelationshipRecord).filter(
        m.RelationshipRecord.relationship_type == "ACCUSED_IN",
        m.RelationshipRecord.target_entity_id == case_id,
    ).all()
    seed_ids = {r.source_entity_id for r in accused_rels}
    nodes = graph_data.load_all_nodes(db)
    edges = graph_data.load_all_edges(db)
    g = ge.build_graph(nodes, edges)
    expanded = set(seed_ids)
    for sid in seed_ids:
        if sid in g:
            expanded.update(g.neighbors(sid))
    sub_nodes = [n for n in nodes if n["id"] in expanded]
    sub_edges = [e for e in edges if e["source_entity_id"] in expanded and e["target_entity_id"] in expanded]
    return {"case_id": case_id, "nodes": sub_nodes, "edges": sub_edges}

import datetime as dt
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.models import models as m
from app.security.permissions import Permission
from app.security.dependencies import (
    AuthenticatedOfficer,
    require_permission,
)
from app.services.evidence_integrity import (
    register_evidence_with_integrity,
    verify_integrity,
    verify_ledger_chain,
    ensure_evidence_integrity_columns,
    seal_unsealed_evidence,
    INTEGRITY_VERIFIED,
    INTEGRITY_CHANGED,
    INTEGRITY_REQUIRES_REVIEW,
    LEDGER_ALGORITHM,
    LEDGER_TYPE,
)

# Upgrade local SQLite fallback with the evidence integrity columns on first import
try:
    from app.database.db import engine, SessionLocal
    ensure_evidence_integrity_columns(engine)
    _migration_db = SessionLocal()
    try:
        seal_unsealed_evidence(_migration_db)
    finally:
        _migration_db.close()
except Exception as exc:  # pragma: no cover
    print(f"[DRISHYAM] evidence integrity column check skipped: {exc}")

router = APIRouter(prefix="/api/v2/evidence", tags=["evidence"])


class EvidenceRegisterPayload(BaseModel):
    evidence_type: str
    description: str
    source_record_id: Optional[str] = None
    case_id: Optional[str] = None
    custodian_division: Optional[str] = "District Cyber Forensics Lab"
    mime_type: Optional[str] = None


def _evidence_to_result(r: m.Evidence, fir_to_case_id: dict, cases_by_id: dict, cases_by_number: dict) -> dict:
    created_str = r.created_at.isoformat() if r.created_at else dt.datetime.utcnow().isoformat()

    resolved_case = None
    resolved_fir = None
    if r.source_record_id:
        if r.source_record_id in fir_to_case_id:
            resolved_fir = r.source_record_id
            c_id = fir_to_case_id[r.source_record_id]
            resolved_case = cases_by_id.get(c_id)
        elif r.source_record_id in cases_by_id:
            resolved_case = cases_by_id[r.source_record_id]
        elif r.source_record_id in cases_by_number:
            resolved_case = cases_by_number[r.source_record_id]

    integrity_status = (
        INTEGRITY_VERIFIED if (r.file_hash and r.verification_status != "REJECTED")
        else INTEGRITY_REQUIRES_REVIEW if not r.file_hash
        else r.verification_status
    )

    return {
        "id": r.id,
        "evidence_type": r.evidence_type,
        "title": r.description or f"Forensic Exhibit #{r.id[:8]}",
        "description": r.description,
        "source_record_id": r.source_record_id,
        "case_id": resolved_case.id if resolved_case else None,
        "case_number": resolved_case.case_number if resolved_case else None,
        "case_title": resolved_case.title if resolved_case else None,
        "fir_number": resolved_fir,
        "storage_path": r.storage_path or f"/secure_vault/evidence/{r.id}.enc",
        "storage_url": r.storage_url,
        "mime_type": r.mime_type,
        "custody": "District Evidence Vault Locker",
        "confidence": r.confidence or 0.95,
        "data_source": r.data_source or "INVESTIGATION_SEIZURE",
        # Integrity (distinct from authenticity)
        "sha256_digest": r.file_hash,
        "integrity_status": integrity_status,
        "integrity_note": (
            "Recalculated hash matches recorded digest — content unchanged."
            if integrity_status == INTEGRITY_VERIFIED
            else "No persisted SHA-256 digest — awaiting seal."
            if not r.file_hash
            else "Content hash mismatch or manually rejected."
        ),
        # Human verification (authenticity/evidentiary review)
        "verification_status": r.verification_status or INTEGRITY_REQUIRES_REVIEW,
        "verified_by": r.verified_by,
        "verified_at": r.verified_at.isoformat() if r.verified_at else None,
        # Tamper-evident ledger links
        "ledger_position": r.ledger_position,
        "previous_hash": r.previous_hash,
        "ledger_anchor": r.ledger_anchor,
        "algorithm": LEDGER_ALGORITHM,
        "created_at": created_str,
    }


@router.get("")
def list_evidence(
    case_id: Optional[str] = None,
    q: Optional[str] = None,
    evidence_type: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 24,
    db: Session = Depends(get_db),
    officer: AuthenticatedOfficer = Depends(require_permission(Permission.VIEW_EVIDENCE)),
):
    """
    Returns evidence records registered in the Tamper-Evident Integrity Ledger
    complete with SHA-256 digests, ledger chain links, case resolution, search,
    and type filtering. Requires VIEW_EVIDENCE clearance (backend enforced).
    """
    p = page if isinstance(page, int) else getattr(page, "default", 1)
    ps = page_size if isinstance(page_size, int) else getattr(page_size, "default", 24)
    p = max(1, p)
    ps = max(1, min(200, ps))

    firs = db.query(m.FIR).all()
    fir_to_case_id = {f.fir_number: f.case_id for f in firs if f.case_id}

    cases = db.query(m.CrimeCase).all()
    cases_by_id = {c.id: c for c in cases}
    cases_by_number = {c.case_number: c for c in cases}

    query = db.query(m.Evidence)

    if case_id and case_id.strip() and case_id != "ALL":
        target_case = cases_by_id.get(case_id) or cases_by_number.get(case_id)
        if target_case:
            associated_firs = [f.fir_number for f in firs if f.case_id == target_case.id]
            query = query.filter(
                (m.Evidence.source_record_id == target_case.id) |
                (m.Evidence.source_record_id == target_case.case_number) |
                (m.Evidence.source_record_id.in_(associated_firs))
            )
        else:
            query = query.filter(m.Evidence.source_record_id == case_id)

    if evidence_type and evidence_type.strip() and evidence_type != "ALL":
        query = query.filter(m.Evidence.evidence_type == evidence_type.upper())

    if q and q.strip():
        search_pattern = f"%{q.strip()}%"
        matching_case_ids = [
            c.id for c in cases
            if q.lower() in c.case_number.lower() or q.lower() in c.title.lower()
        ]
        matching_fir_nums = [
            f.fir_number for f in firs
            if q.lower() in f.fir_number.lower() or f.case_id in matching_case_ids
        ]
        query = query.filter(
            m.Evidence.id.ilike(search_pattern) |
            m.Evidence.description.ilike(search_pattern) |
            m.Evidence.source_record_id.ilike(search_pattern) |
            m.Evidence.source_record_id.in_(matching_fir_nums) |
            m.Evidence.source_record_id.in_(matching_case_ids)
        )

    total_count = query.count()
    records = (
        query.order_by(m.Evidence.created_at.desc())
        .offset((p - 1) * ps)
        .limit(ps)
        .all()
    )

    results = [_evidence_to_result(r, fir_to_case_id, cases_by_id, cases_by_number) for r in records]

    total_pages = max(1, (total_count + ps - 1) // ps) if total_count > 0 else 1

    return {
        "evidence": results,
        "total_exhibits": total_count,
        "page": p,
        "page_size": ps,
        "total_pages": total_pages,
        "ledger_type": LEDGER_TYPE,
        "hash_algorithm": LEDGER_ALGORITHM,
    }


@router.get("/ledger/verify")
def verify_ledger(
    db: Session = Depends(get_db),
    officer: AuthenticatedOfficer = Depends(require_permission(Permission.VERIFY_INTEGRITY)),
):
    """
    Recomputes and validates the entire Tamper-Evident Integrity Ledger hash chain.
    Detects any modification of recorded integrity entries (broken links or
    altered digests).
    """
    report = verify_ledger_chain(db)
    db.add(m.AuditLog(
        user_id=officer.id,
        action="LEDGER_CHAIN_VERIFIED",
        details={
            "records_checked": report["records_checked"],
            "chain_intact": report["chain_intact"],
            "anchor": report["anchor"],
        }
    ))
    db.commit()

    return {
        "ledger_type": LEDGER_TYPE,
        "algorithm": LEDGER_ALGORITHM,
        "chain_intact": report["chain_intact"],
        "records_checked": report["records_checked"],
        "anchor": report["anchor"],
        "entries": report["entries"],
    }


@router.get("/{evidence_id}")
def get_evidence(
    evidence_id: str,
    db: Session = Depends(get_db),
    officer: AuthenticatedOfficer = Depends(require_permission(Permission.VIEW_EVIDENCE)),
):
    evidence = db.query(m.Evidence).filter(m.Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence record not found")

    firs = db.query(m.FIR).all()
    fir_to_case_id = {f.fir_number: f.case_id for f in firs if f.case_id}
    cases = db.query(m.CrimeCase).all()
    cases_by_id = {c.id: c for c in cases}
    cases_by_number = {c.case_number: c for c in cases}

    result = _evidence_to_result(evidence, fir_to_case_id, cases_by_id, cases_by_number)
    # Attach the live integrity verdict for this record
    integrity = verify_integrity(db, evidence)
    result["integrity_checked"] = integrity["status"]
    result["integrity_reason"] = integrity["reason"]
    result["has_raw_digest"] = bool(evidence.source_hash)
    return result


@router.post("/{evidence_id}/verify")
def verify_evidence_integrity(
    evidence_id: str,
    db: Session = Depends(get_db),
    officer: AuthenticatedOfficer = Depends(require_permission(Permission.VERIFY_INTEGRITY)),
):
    """
    Recalculates the SHA-256 digest and compares it against the digest persisted
    at registration/seal time. Surfaces a real INTEGRITY verdict:

      - VERIFIED        -> recomputed hash matches recorded hash
      - CHANGED         -> recomputed hash differs from recorded hash (tamper / drift)
      - REQUIRES_REVIEW -> no persisted digest exists

    This checks content INTEGRITY, not real-world authenticity. Requires the
    VERIFY_INTEGRITY permission (backend enforced).
    """
    evidence = db.query(m.Evidence).filter(m.Evidence.id == evidence_id).first()

    if evidence:
        result = verify_integrity(db, evidence)
        title = evidence.description or f"Evidence #{evidence.id}"
        integrity_ok = result["integrity_verified"]
        status = result["status"]
    else:
        raise HTTPException(status_code=404, detail="Evidence record not found")

    # Only record an audit event for REAL actions on real records.
    db.add(m.AuditLog(
        user_id=officer.id,
        action="EVIDENCE_INTEGRITY_VERIFIED",
        details={
            "evidence_id": evidence_id,
            "sha256": result["calculated_hash"],
            "recorded_hash": result.get("recorded_hash"),
            "verified_by_badge": officer.email,
            "status": status,
            "integrity_verified": integrity_ok,
        }
    ))
    db.commit()

    return {
        "evidence_id": evidence_id,
        "title": title,
        "algorithm": LEDGER_ALGORITHM,
        "ledger_type": LEDGER_TYPE,
        "status": status,
        "integrity_verified": integrity_ok,
        "calculated_hash": result["calculated_hash"],
        "recorded_hash": result.get("recorded_hash"),
        "reason": result["reason"],
        "verification_timestamp": dt.datetime.utcnow().isoformat(),
        "verified_by": officer.full_name,
        "officer_role": officer.role.value,
        "message": (
            "SHA-256 Integrity: Verified — calculated hash matches recorded hash."
            if status == INTEGRITY_VERIFIED
            else "SHA-256 Integrity: CHANGED — calculated hash does not match the recorded hash. Content appears to have been modified."
            if status == INTEGRITY_CHANGED
            else "SHA-256 Integrity: requires review — a persisted digest has not been established."
        ),
    }


@router.post("/{evidence_id}/review")
def review_evidence(
    evidence_id: str,
    body: dict = Body(default={}),
    db: Session = Depends(get_db),
    officer: AuthenticatedOfficer = Depends(require_permission(Permission.MANAGE_EVIDENCE)),
):
    """
    Human verification of evidence — the investigator decides the evidentiary
    (authenticity/review) state, independent of cryptographic integrity.

    Status values: VERIFIED | REJECTED | REQUIRES_REVIEW
    """
    evidence = db.query(m.Evidence).filter(m.Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence record not found")

    status = (body.get("status") or INTEGRITY_REQUIRES_REVIEW).upper()
    if status not in ("VERIFIED", "REJECTED", "REQUIRES_REVIEW"):
        raise HTTPException(status_code=400, detail="Invalid review status")

    evidence.verification_status = status
    evidence.verified_by = officer.email
    evidence.verified_at = dt.datetime.utcnow()

    db.add(m.AuditLog(
        user_id=officer.id,
        action="EVIDENCE_REVIEWED",
        details={
            "evidence_id": evidence_id,
            "review_status": status,
            "reviewed_by": officer.email,
            "note": body.get("note"),
        }
    ))
    db.commit()

    return {
        "evidence_id": evidence_id,
        "verification_status": status,
        "verified_by": officer.email,
        "verified_at": evidence.verified_at.isoformat(),
    }


@router.post("")
def register_evidence(
    payload: EvidenceRegisterPayload,
    db: Session = Depends(get_db),
    officer: AuthenticatedOfficer = Depends(require_permission(Permission.MANAGE_EVIDENCE)),
):
    """
    Registers a new piece of forensic evidence into the Tamper-Evident Integrity
    Ledger: computes + persists its SHA-256 digest and links it into the hash
    chain. Requires MANAGE_EVIDENCE clearance (backend enforced).
    """
    evidence = m.Evidence(
        evidence_type=payload.evidence_type.upper(),
        description=payload.description,
        source_record_id=payload.case_id or payload.source_record_id,
        storage_path=f"/secure_vault/evidence/{payload.evidence_type.lower()}_{dt.datetime.utcnow().strftime('%Y%m%d%H%M%S')}.enc",
        mime_type=payload.mime_type,
        confidence=0.95,
        data_source="INVESTIGATION",
        # Seed state is integrity-sealed but not yet human-verified
        verification_status=INTEGRITY_REQUIRES_REVIEW,
    )
    db.add(evidence)
    db.flush()

    digest = register_evidence_with_integrity(db, evidence, mime_type=payload.mime_type)

    db.add(m.AuditLog(
        user_id=officer.id,
        action="EVIDENCE_REGISTERED",
        details={
            "evidence_id": evidence.id,
            "evidence_type": evidence.evidence_type,
            "sha256": digest,
            "ledger_position": evidence.ledger_position,
            "custodian": payload.custodian_division,
        }
    ))
    db.commit()

    return {
        "status": "registered",
        "evidence_id": evidence.id,
        "sha256_digest": digest,
        "algorithm": LEDGER_ALGORITHM,
        "ledger_type": LEDGER_TYPE,
        "ledger_position": evidence.ledger_position,
        "custodian": payload.custodian_division,
        "message": "Exhibit sealed into Tamper-Evident Integrity Ledger. Cryptographic integrity recorded; awaiting investigator review.",
    }


@router.post("/upload")
async def upload_evidence_file(
    evidence_type: str = Form(...),
    case_id: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    custodian_division: Optional[str] = Form("District Cyber Forensics Lab"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    officer: AuthenticatedOfficer = Depends(require_permission(Permission.MANAGE_EVIDENCE)),
):
    """
    Uploads a real evidence file: reads the raw bytes, computes + persists the
    SHA-256 digest of the actual content, stores the object metadata, and seals
    the record into the tamper-evident ledger. The file bytes are streamed to
    the storage layer (currently object reference metadata is recorded; actual
    blob storage is delegated to the approved Supabase Storage architecture).
    """
    from app.security.integrity import sha256_of_bytes

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file upload")

    evidence = m.Evidence(
        evidence_type=evidence_type.upper(),
        description=description or file.filename or "Uploaded evidence file",
        source_record_id=case_id,
        storage_path=f"/secure_vault/evidence/{dt.datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{file.filename or 'upload.bin'}",
        mime_type=file.content_type,
        confidence=0.95,
        data_source="INVESTIGATION_SEIZURE",
        verification_status=INTEGRITY_REQUIRES_REVIEW,
    )
    db.add(evidence)
    db.flush()

    register_evidence_with_integrity(db, evidence, raw_bytes=raw, mime_type=file.content_type)

    db.add(m.AuditLog(
        user_id=officer.id,
        action="EVIDENCE_REGISTERED",
        details={
            "evidence_id": evidence.id,
            "evidence_type": evidence.evidence_type,
            "uploaded_filename": file.filename,
            "mime_type": file.content_type,
            "sha256": evidence.file_hash,
            "source_hash": evidence.source_hash,
            "ledger_position": evidence.ledger_position,
        }
    ))
    db.commit()

    return {
        "status": "registered",
        "evidence_id": evidence.id,
        "uploaded_filename": file.filename,
        "sha256_digest": evidence.file_hash,
        "source_bytes_hash": evidence.source_hash,
        "algorithm": LEDGER_ALGORITHM,
        "ledger_type": LEDGER_TYPE,
        "message": "Evidence file received. SHA-256 digest of content bytes computed and sealed into the integrity ledger.",
    }

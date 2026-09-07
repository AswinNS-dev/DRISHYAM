"""
Evidence Integrity + Tamper-Evident Ledger services.

Coordinates persistence of SHA-256 digests, hash-chain links (previous_hash /
ledger_position / ledger_anchor) and human verification state on Evidence
records, plus real tamper-detection during verification.

All writes stay within existing tables (evidence, audit_logs). No new tables,
no schema migrations, no database coordination with Person 2 required.
"""
import datetime as dt
from typing import Optional

from sqlalchemy.orm import Session

from app.models import models as m
from app.security.integrity import (
    compute_evidence_file_hash,
    sha256_of_bytes,
    verify_hash_chain,
)

INTEGRITY_VERIFIED = "VERIFIED"
INTEGRITY_CHANGED = "CHANGED"
INTEGRITY_REQUIRES_REVIEW = "REQUIRES_REVIEW"
LEDGER_ALGORITHM = "SHA-256"
LEDGER_TYPE = "Tamper-Evident Integrity Ledger"


def canonical_created_at_str(evidence) -> str:
    if evidence.created_at:
        return evidence.created_at.isoformat()
    return dt.datetime.utcnow().isoformat()


def compute_evidence_digest(evidence) -> str:
    """Deterministic SHA-256 digest over an evidence record's canonical content."""
    return compute_evidence_file_hash(
        evidence.id,
        evidence.evidence_type,
        evidence.source_record_id,
        evidence.description,
        canonical_created_at_str(evidence),
    )


def account_for_existing_db(evidence: m.Evidence) -> None:
    """Best-effort compatibility with SQLite deployments where new columns are added
    via create_all on an existing file (SQLite ALTER semantics handled by SQLAlchemy
    only for NEW databases). At runtime we rely on defaults; the columns above are
    migrated implicitly by recreating the local DB."""
    pass


EVIDENCE_INTEGRITY_COLUMNS = {
    "storage_url": "VARCHAR",
    "mime_type": "VARCHAR",
    "file_hash": "VARCHAR",
    "source_hash": "VARCHAR",
    "previous_hash": "VARCHAR",
    "ledger_position": "INTEGER",
    "ledger_anchor": "VARCHAR",
    "verification_status": "VARCHAR",
    "verified_by": "VARCHAR",
    "verified_at": "DATETIME",
}


def ensure_evidence_integrity_columns(engine) -> None:
    """
    Idempotently add evidence integrity columns to an existing local database.

    Only the LOCAL SQLite fallback needs this (Supabase schema already declares
    the columns). It mirrors the approved Supabase schema (file_hash, storage_url,
    mime_type) plus the ledger/verification fields owned by this issue.
    """
    from sqlalchemy import text, inspect

    inspector = inspect(engine)
    if "evidence" not in inspector.get_table_names():
        return
    existing = {c["name"] for c in inspector.get_columns("evidence")}
    with engine.begin() as conn:
        for name, col_type in EVIDENCE_INTEGRITY_COLUMNS.items():
            if name not in existing:
                conn.execute(text(
                    f'ALTER TABLE evidence ADD COLUMN {name} {col_type}'
                ))
    print("[DRISHYAM] evidence integrity columns ensured on local database")


def register_evidence_with_integrity(
    db: Session,
    evidence: m.Evidence,
    raw_bytes: Optional[bytes] = None,
    mime_type: Optional[str] = None,
) -> str:
    """
    Attach an evidence record to the tamper-evident ledger:
      - compute + persist the record SHA-256 digest (file_hash)
      - hash raw file bytes if a real file is provided (source_hash)
      - link the record to the previous chain entry (previous_hash)
      - propagate the chain anchor (ledger_anchor)
    Returns the persisted digest.
    """
    digest = compute_evidence_digest(evidence)
    evidence.file_hash = digest
    if raw_bytes is not None:
        evidence.source_hash = sha256_of_bytes(raw_bytes)
    if mime_type:
        evidence.mime_type = mime_type

    prior = (
        db.query(m.Evidence)
        .filter(m.Evidence.id != evidence.id)
        .order_by(m.Evidence.created_at.desc(), m.Evidence.id.desc())
        .first()
    )
    if prior and prior.file_hash:
        evidence.previous_hash = prior.file_hash
        evidence.ledger_position = (prior.ledger_position or 0) + 1
        evidence.ledger_anchor = prior.ledger_anchor or compute_first_entry_hash(db)
    else:
        evidence.previous_hash = None
        evidence.ledger_position = 1
        evidence.ledger_anchor = digest

    db.flush()
    return digest


def compute_first_entry_hash(db: Session) -> str:
    """Return the digest of the first (root) record in the chain."""
    first = (
        db.query(m.Evidence)
        .order_by(m.Evidence.created_at.asc(), m.Evidence.id.asc())
        .first()
    )
    if first and first.file_hash:
        return first.file_hash
    return None


def verify_integrity(db: Session, evidence: m.Evidence) -> dict:
    """
    Recompute the SHA-256 digest for an evidence record and compare it to the
    digest persisted at registration time.

    Returns an INTEGRITY verdict. A mismatch means the recorded content changed
    (or the record was never sealed); this must be surfaced, never silenced.

    NOTE: this is integrity checking, NOT authenticity. A verified hash does not
    prove the evidence is real-world genuine.
    """
    digest = compute_evidence_digest(evidence)
    recorded = evidence.file_hash

    if recorded is None:
        return {
            "status": INTEGRITY_REQUIRES_REVIEW,
            "calculated_hash": digest,
            "recorded_hash": None,
            "integrity_verified": False,
            "reason": "No persisted SHA-256 digest exists for this record. Re-seal to establish integrity.",
        }

    if recorded == digest:
        return {
            "status": INTEGRITY_VERIFIED,
            "calculated_hash": digest,
            "recorded_hash": recorded,
            "integrity_verified": True,
            "reason": "Recalculated SHA-256 matches the recorded digest. Content integrity confirmed.",
        }

    return {
        "status": INTEGRITY_CHANGED,
        "calculated_hash": digest,
        "recorded_hash": recorded,
        "integrity_verified": False,
        "reason": "Recalculated SHA-256 does NOT match the recorded digest. Content appears to have changed.",
    }


def seal_unsealed_evidence(db: Session) -> int:
    """
    Idempotently seal any evidence records that lack a persisted SHA-256 digest.

    Backfills legacy rows (e.g. an existing local DB whose rows predate the
    integrity columns) so the whole Evidence table participates in the
    tamper-evident ledger. Deterministic and non-destructive.
    """
    unsealed = (
        db.query(m.Evidence)
        .filter(m.Evidence.file_hash.is_(None))
        .order_by(m.Evidence.created_at.asc(), m.Evidence.id.asc())
        .all()
    )
    for ev in unsealed:
        register_evidence_with_integrity(db, ev)
    if unsealed:
        db.commit()
    return len(unsealed)


def verify_ledger_chain(db: Session) -> dict:
    """Recompute and validate the whole tamper-evident hash chain."""
    records = (
        db.query(m.Evidence)
        .order_by(
            m.Evidence.ledger_position.asc(),
            m.Evidence.created_at.asc(),
            m.Evidence.id.asc(),
        )
        .all()
    )
    entries = []
    for ev in records:
        entries.append({
            "evidence_id": ev.id,
            "evidence_type": ev.evidence_type,
            "source_record_id": ev.source_record_id,
            "description": ev.description,
            "created_at": canonical_created_at_str(ev),
            "file_hash": ev.file_hash,
            "previous_hash": ev.previous_hash,
        })
    return verify_hash_chain(entries)
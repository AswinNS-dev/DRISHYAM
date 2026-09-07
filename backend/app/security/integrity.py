"""
SHA-256 Integrity and Tamper-Evident Integrity Ledger core.

PURPOSE: Detect whether stored file/content bytes have changed from the recorded
version. SHA-256 matching proves *integrity* (unchanged since recording), NOT
real-world *authenticity* (that the source is legitimate or the content truthful).

Ledger design (hash CHAIN, not a decentralized blockchain):

    file_hash        SHA-256 over the record's canonical content
                     (id|type|source|description|created_at) — persisted at seal
                     time and compared on verification to detect tampering.
    previous_hash    file_hash of the PRIOR record in the chronological chain —
                     breaking a link breaks the whole chain.
    ledger_position  1-based index in the chain.
    ledger_anchor    file_hash of the FIRST record in the chain (root reference,
                     propagated to every record so a single fetch anchors the chain).
"""
import hashlib
from typing import Optional


def sha256_of_bytes(data: bytes) -> str:
    """SHA-256 digest of raw content bytes (used for uploaded file integrity)."""
    return hashlib.sha256(data).hexdigest()


def sha256_of_str(text: str) -> str:
    """SHA-256 digest of a canonical string."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def compute_evidence_file_hash(
    evidence_id: str,
    evidence_type: str,
    source_record_id: Optional[str],
    description: Optional[str],
    created_at_str: str,
) -> str:
    """
    Deterministic SHA-256 fingerprint over the evidence's canonical metadata.

    NOTES:
      - Covers metadata-based integrity for records created without an uploaded
        byte stream.
      - When a real file is uploaded, `source_hash` additionally carries the
        digest of the actual file bytes (sha256_of_bytes).
    """
    raw_payload = (
        f"{evidence_id}|{evidence_type}|{source_record_id or 'NONE'}|"
        f"{description or ''}|{created_at_str}"
    )
    return sha256_of_str(raw_payload)


def verify_hash_chain(entries: list) -> dict:
    """
    Validate the tamper-evident hash chain across ORDERED ledger entries.

    Each entry must provide:
        evidence_id, evidence_type, source_record_id, description, created_at,
        file_hash (persisted), previous_hash (persisted)

    A record is INTACT only when BOTH:
      1. its recomputed content digest matches its persisted file_hash, and
      2. its previous_hash matches the prior record's file_hash (link intact).
    """
    results = []
    chain_intact = True
    prior_content_hash = None

    for idx, entry in enumerate(entries, start=1):
        recomputed = compute_evidence_file_hash(
            entry.get("evidence_id"),
            entry.get("evidence_type"),
            entry.get("source_record_id"),
            entry.get("description"),
            entry.get("created_at") or "",
        )
        recorded = entry.get("file_hash")
        linked = (prior_content_hash is None) or (entry.get("previous_hash") == prior_content_hash)
        content_ok = bool(recorded) and recorded == recomputed
        intact = content_ok and linked
        if not intact:
            chain_intact = False

        results.append({
            "position": idx,
            "evidence_id": entry.get("evidence_id"),
            "recorded_digest": recorded,
            "recomputed_digest": recomputed,
            "previous_hash": entry.get("previous_hash"),
            "previous_link_intact": linked,
            "content_intact": content_ok,
            "status": "INTACT" if intact else "TAMPERED",
        })
        prior_content_hash = recorded

    return {
        "chain_intact": chain_intact,
        "records_checked": len(results),
        "anchor": entries[0].get("file_hash") if results else None,
        "entries": results,
    }
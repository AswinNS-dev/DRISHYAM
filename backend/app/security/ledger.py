import hashlib
import datetime as dt
from typing import List, Dict, Any, Optional, Tuple


GENESIS_PREVIOUS_HASH = "0" * 64
GENESIS_HASH = hashlib.sha256(b"DRISHYAM_TAMPER_EVIDENT_INTEGRITY_LEDGER_GENESIS").hexdigest()


def compute_block_hash(
    block_index: int,
    evidence_id: str,
    evidence_hash: str,
    previous_hash: str,
    timestamp_str: str,
) -> str:
    """Computes a cryptographic SHA-256 chaining hash for an integrity ledger entry."""
    payload = f"{block_index}:{evidence_id}:{evidence_hash}:{previous_hash}:{timestamp_str}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def build_integrity_chain(evidence_records: List[Any], compute_hash_fn) -> List[Dict[str, Any]]:
    """
    Constructs the Tamper-Evident Integrity Ledger chain across all evidence items.
    Preserves cryptographic sequence: Genesis -> Block 1 -> Block 2 -> ... -> Head Block.
    """
    ledger: List[Dict[str, Any]] = [
        {
            "block_index": 0,
            "block_type": "GENESIS",
            "evidence_id": "SYSTEM_GENESIS_ROOT",
            "evidence_type": "GENESIS_ANCHOR",
            "evidence_hash": GENESIS_HASH,
            "previous_hash": GENESIS_PREVIOUS_HASH,
            "block_hash": GENESIS_HASH,
            "timestamp": "2026-01-01T00:00:00Z",
            "status": "SEALED",
        }
    ]

    prev_hash = GENESIS_HASH

    for idx, ev in enumerate(evidence_records, start=1):
        created_str = ev.created_at.isoformat() if hasattr(ev, "created_at") and ev.created_at else "2026-01-01T00:00:00"
        ev_id = getattr(ev, "id", f"exhibit-{idx}")
        ev_type = getattr(ev, "evidence_type", "EXHIBIT")
        source_id = getattr(ev, "source_record_id", None)
        desc = getattr(ev, "description", None)

        # Compute or extract evidence SHA-256
        ev_hash = compute_hash_fn(ev_id, ev_type, source_id, desc, created_str)
        
        block_hash = compute_block_hash(idx, ev_id, ev_hash, prev_hash, created_str)

        ledger.append({
            "block_index": idx,
            "block_type": "EVIDENCE_BLOCK",
            "evidence_id": ev_id,
            "evidence_type": ev_type,
            "evidence_hash": ev_hash,
            "previous_hash": prev_hash,
            "block_hash": block_hash,
            "timestamp": created_str,
            "status": "SEALED",
        })

        prev_hash = block_hash

    return ledger


def verify_integrity_chain(ledger: List[Dict[str, Any]]) -> Tuple[bool, Optional[Dict[str, Any]]]:
    """
    Verifies bit-level integrity and cryptographic continuity across the entire ledger.
    Returns (True, None) if unbroken, or (False, error_report) if any link or content is tampered.
    """
    if not ledger:
        return False, {"error": "Empty ledger"}

    # Verify Genesis
    if ledger[0].get("block_hash") != GENESIS_HASH:
        return False, {
            "error": "Genesis block corrupted",
            "block_index": 0,
            "expected_hash": GENESIS_HASH,
            "actual_hash": ledger[0].get("block_hash"),
        }

    for i in range(1, len(ledger)):
        curr = ledger[i]
        prev = ledger[i - 1]

        # 1. Verify previous_hash link
        if curr.get("previous_hash") != prev.get("block_hash"):
            return False, {
                "error": "Broken chain link: previous_hash mismatch",
                "block_index": i,
                "evidence_id": curr.get("evidence_id"),
                "expected_previous_hash": prev.get("block_hash"),
                "recorded_previous_hash": curr.get("previous_hash"),
            }

        # 2. Recompute and verify current block_hash
        recalculated_block_hash = compute_block_hash(
            curr["block_index"],
            curr["evidence_id"],
            curr["evidence_hash"],
            curr["previous_hash"],
            curr["timestamp"],
        )

        if curr.get("block_hash") != recalculated_block_hash:
            return False, {
                "error": "Block hash altered: bit-level content modified",
                "block_index": i,
                "evidence_id": curr.get("evidence_id"),
                "expected_block_hash": recalculated_block_hash,
                "recorded_block_hash": curr.get("block_hash"),
            }

    return True, None

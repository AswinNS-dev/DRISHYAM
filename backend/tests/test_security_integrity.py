"""
Security, Evidence Integrity & Tamper-Evident Ledger tests.

Covers the Investigation trust/security layer:
  1. SHA-256 hashing determinism + tamper detection
  2. Tamper-Evident Integrity Ledger hash-chain validation
  3. Evidence registration persists digests + ledger links
  4. Integrity verification detects modified content
  5. Backend authorization (401 unauthenticated / 403 unauthorized)
  6. Audit logging writes real records
"""
import datetime as dt
import os
import tempfile

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.security.integrity import (
    compute_evidence_file_hash,
    sha256_of_bytes,
    sha256_of_str,
    verify_hash_chain,
)
from app.services.evidence_integrity import (
    register_evidence_with_integrity,
    verify_integrity,
    verify_ledger_chain,
    seal_unsealed_evidence,
    INTEGRITY_VERIFIED,
    INTEGRITY_CHANGED,
    INTEGRITY_REQUIRES_REVIEW,
)
from app.models import models as m
from app.database import db as db_module
from app.main import app


# ---------- SHA-256 integrity unit tests ----------

def test_sha256_deterministic():
    a = compute_evidence_file_hash("ev-1", "FIR", "INF-001", "desc", "2026-01-01T00:00:00")
    b = compute_evidence_file_hash("ev-1", "FIR", "INF-001", "desc", "2026-01-01T00:00:00")
    assert a == b
    assert len(a) == 64


def test_sha256_changes_on_content_change():
    a = compute_evidence_file_hash("ev-1", "FIR", "INF-001", "desc", "2026-01-01T00:00:00")
    b = compute_evidence_file_hash("ev-1", "FIR", "INF-001", "desc", "2026-01-02T00:00:00")
    c = compute_evidence_file_hash("ev-1", "FIR", "INF-999", "desc", "2026-01-01T00:00:00")
    assert a != b
    assert a != c


def test_sha256_of_bytes_matches_known():
    assert sha256_of_bytes(b"abc") == sha256_of_str("abc") is not None


def test_verify_integrity_detects_tampering(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'ti.db'}")
    m.Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    ev = m.Evidence(evidence_type="FIR", source_record_id="INF-1", description="original", data_source="TEST")
    db.add(ev)
    db.flush()
    register_evidence_with_integrity(db, ev)
    db.commit()

    # Intact
    verdict = verify_integrity(db, db.query(m.Evidence).first())
    assert verdict["status"] == INTEGRITY_VERIFIED
    assert verdict["integrity_verified"] is True

    # Modify content -> integrity must FAIL (never silently verified)
    ev.description = "TAMPERED CONTENT"
    db.commit()
    verdict2 = verify_integrity(db, db.query(m.Evidence).first())
    assert verdict2["status"] == INTEGRITY_CHANGED
    assert verdict2["integrity_verified"] is False
    assert verdict2["calculated_hash"] != verdict2["recorded_hash"]


# ---------- Tamper-evident ledger chain tests ----------

def test_seal_unsealed_backfills_legacy_records(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'backfill.db'}")
    m.Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    # legacy records created WITHOUT any seal
    old1 = m.Evidence(evidence_type="FIR", source_record_id="LEGACY-1", description="old row", data_source="SYNTHETIC",
                      created_at=dt.datetime(2026, 1, 1))
    old2 = m.Evidence(evidence_type="CDR", source_record_id="LEGACY-2", description="old row 2", data_source="SYNTHETIC",
                      created_at=dt.datetime(2026, 1, 2))
    db.add_all([old1, old2])
    db.commit()

    assert db.query(m.Evidence).filter(m.Evidence.file_hash.is_(None)).count() == 2

    sealed = seal_unsealed_evidence(db)
    assert sealed == 2

    report = verify_ledger_chain(db)
    assert report["chain_intact"] is True
    assert report["records_checked"] == 2
    assert all(e["status"] == "INTACT" for e in report["entries"])

def _mk_entry(evidence_id, etype, source, desc, created, file_hash, prev):
    return {
        "evidence_id": evidence_id, "evidence_type": etype,
        "source_record_id": source, "description": desc,
        "created_at": created, "file_hash": file_hash, "previous_hash": prev,
    }


def test_ledger_chain_intact_recomputation():
    e1 = compute_evidence_file_hash("a", "FIR", "SRC1", "desc1", "2026-01-01T00:00:00")
    e2 = compute_evidence_file_hash("b", "CDR", "SRC2", "desc2", "2026-01-02T00:00:00")
    e3 = compute_evidence_file_hash("c", "FINANCIAL", "SRC3", "desc3", "2026-01-03T00:00:00")
    entries = [
        _mk_entry("a", "FIR", "SRC1", "desc1", "2026-01-01T00:00:00", e1, None),
        _mk_entry("b", "CDR", "SRC2", "desc2", "2026-01-02T00:00:00", e2, e1),
        _mk_entry("c", "FINANCIAL", "SRC3", "desc3", "2026-01-03T00:00:00", e3, e2),
    ]
    report = verify_hash_chain(entries)
    assert report["chain_intact"] is True
    assert report["records_checked"] == 3
    assert all(ent["status"] == "INTACT" for ent in report["entries"])


def test_ledger_chain_detects_edited_entry_and_broken_link():
    e1 = compute_evidence_file_hash("a", "FIR", "SRC1", "desc1", "2026-01-01T00:00:00")
    e2 = compute_evidence_file_hash("b", "CDR", "SRC2", "desc2", "2026-01-02T00:00:00")
    e3 = compute_evidence_file_hash("c", "FINANCIAL", "SRC3", "desc3", "2026-01-03T00:00:00")

    # e2's persisted digest differs from what its content recomputes to (tampered)
    bad_e2 = compute_evidence_file_hash("b", "CDR", "SRC2", "ALTERED", "2026-01-02T00:00:00")
    entries = [
        _mk_entry("a", "FIR", "SRC1", "desc1", "2026-01-01T00:00:00", e1, None),
        _mk_entry("b", "CDR", "SRC2", "desc2", "2026-01-02T00:00:00", bad_e2, e1),
        _mk_entry("c", "FINANCIAL", "SRC3", "desc3", "2026-01-03T00:00:00", e3, e2),
    ]
    report = verify_hash_chain(entries)
    assert report["chain_intact"] is False
    # entry b is TAMPERED (content mismatch); entry c is TAMPERED (broken link)
    assert report["entries"][1]["status"] == "TAMPERED"
    assert report["entries"][2]["status"] == "TAMPERED"
    assert report["entries"][2]["previous_link_intact"] is False


# ---------- FastAPI integration tests (temp SQLite DB) ----------

@pytest.fixture()
def client_and_db(tmp_path):
    test_engine = create_engine(f"sqlite:///{tmp_path / 'app_test.db'}")
    m.Base.metadata.create_all(bind=test_engine)
    TestSession = sessionmaker(bind=test_engine, autocommit=False, autoflush=False)

    def override_get_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[db_module.get_db] = override_get_db

    # Seed a demo analyst + admin user with hashed passwords
    from app.core.security import hash_password, create_access_token
    init_db = TestSession()
    analyst_user = m.User(
        email="analyst@test.local", full_name="Test Analyst",
        hashed_password=hash_password("demo1234"), role="analyst", is_active=True,
    )
    admin_user = m.User(
        email="admin@test.local", full_name="Test Admin",
        hashed_password=hash_password("demo1234"), role="admin", is_active=True,
    )
    init_db.add_all([analyst_user, admin_user])
    init_db.commit()

    analyst_token = create_access_token(analyst_user.id, "analyst", email=analyst_user.email, full_name=analyst_user.full_name)
    admin_token = create_access_token(admin_user.id, "admin", email=admin_user.email, full_name=admin_user.full_name)

    client = TestClient(app)
    yield {
        "client": client,
        "db": init_db,
        "analyst_token": analyst_token,
        "admin_token": admin_token,
    }
    app.dependency_overrides.clear()


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_unauthenticated_request_rejected_401(client_and_db):
    c = client_and_db["client"]
    resp = c.get("/api/v2/evidence")
    assert resp.status_code == 401


def test_analyst_can_view_evidence(client_and_db):
    c = client_and_db["client"]
    resp = c.get("/api/v2/evidence", headers=_auth(client_and_db["analyst_token"]))
    assert resp.status_code == 200
    payload = resp.json()
    assert "evidence" in payload
    assert payload["ledger_type"] == "Tamper-Evident Integrity Ledger"


def test_analyst_cannot_register_evidence_403(client_and_db):
    # ANALYST role lacks MANAGE_EVIDENCE -> must be 403 (backend enforced)
    c = client_and_db["client"]
    resp = c.post(
        "/api/v2/evidence",
        json={"evidence_type": "FIR", "description": "test"},
        headers=_auth(client_and_db["analyst_token"]),
    )
    assert resp.status_code == 403


def test_investigator_register_and_tamper_detection(client_and_db):
    # Grant an investigator on the fly to test register/verify flow
    from app.core.security import hash_password, create_access_token
    inv_user = m.User(
        email="invest@test.local", full_name="Test Investigator",
        hashed_password=hash_password("demo1234"), role="investigator", is_active=True,
    )
    client_and_db["db"].add(inv_user)
    client_and_db["db"].commit()
    inv_token = create_access_token(inv_user.id, "investigator", email=inv_user.email, full_name=inv_user.full_name)

    c = client_and_db["client"]
    register = c.post(
        "/api/v2/evidence",
        json={"evidence_type": "FIR", "description": "Integrity test exhibit", "case_id": None},
        headers=_auth(inv_token),
    )
    assert register.status_code == 200
    evidence_id = register.json()["evidence_id"]
    recorded_digest = register.json()["sha256_digest"]
    assert len(recorded_digest) == 64

    # Verify: intact initially
    verify = c.post(f"/api/v2/evidence/{evidence_id}/verify", headers=_auth(inv_token))
    assert verify.status_code == 200
    assert verify.json()["status"] == INTEGRITY_VERIFIED

    # Tamper with the record in DB, then verify must detect it
    ev = client_and_db["db"].query(m.Evidence).filter(m.Evidence.id == evidence_id).first()
    ev.description = "MALICIOUS MODIFICATION"
    client_and_db["db"].commit()

    verify2 = c.post(f"/api/v2/evidence/{evidence_id}/verify", headers=_auth(inv_token))
    assert verify2.status_code == 200
    assert verify2.json()["status"] == INTEGRITY_CHANGED
    assert verify2.json()["integrity_verified"] is False


def test_ledger_chain_verification_endpoint(client_and_db):
    from app.core.security import hash_password, create_access_token
    adm = client_and_db["db"].query(m.User).filter(m.User.email == "admin@test.local").first()
    token = create_access_token(adm.id, "admin", email=adm.email, full_name=adm.full_name)
    c = client_and_db["client"]
    resp = c.get("/api/v2/evidence/ledger/verify", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert "chain_intact" in body
    assert "entries" in body


def test_audit_log_requires_view_audit_permission(client_and_db):
    c = client_and_db["client"]
    # ANALYST lacks VIEW_AUDIT_LOGS -> 403
    resp = c.get("/api/v2/audit", headers=_auth(client_and_db["analyst_token"]))
    assert resp.status_code == 403

    # ADMIN can view
    resp2 = c.get("/api/v2/audit", headers=_auth(client_and_db["admin_token"]))
    assert resp2.status_code == 200
    assert "audit_logs" in resp2.json()

    # INVESTIGATOR can view (issue §9: AUDIT LOG is investigator-facing)
    from app.core.security import hash_password, create_access_token
    inv_user = m.User(
        email="invest-audit@test.local", full_name="Test Investor",
        hashed_password=hash_password("demo1234"), role="investigator", is_active=True,
    )
    client_and_db["db"].add(inv_user)
    client_and_db["db"].commit()
    inv_token = create_access_token(inv_user.id, "investigator", email=inv_user.email, full_name=inv_user.full_name)
    resp3 = c.get("/api/v2/audit", headers=_auth(inv_token))
    assert resp3.status_code == 200


def test_admin_system_telemetry_no_privileged_leak(client_and_db):
    c = client_and_db["client"]
    resp = c.get("/api/v2/admin/system", headers=_auth(client_and_db["admin_token"]))
    assert resp.status_code == 200
    text = str(resp.json())
    assert "SERVICE_KEY" not in text
    assert "service_role" not in text.lower()
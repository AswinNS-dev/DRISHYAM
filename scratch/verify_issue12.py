import urllib.request
import urllib.parse
import urllib.error
import json
import hashlib
import uuid

BASE_URL = "http://127.0.0.1:8000"

def make_request(path, method="GET", data=None, headers=None, is_json=True):
    url = f"{BASE_URL}{path}"
    headers = headers or {}
    encoded_data = None

    if data is not None:
        if isinstance(data, dict):
            if is_json:
                encoded_data = json.dumps(data).encode("utf-8")
                headers["Content-Type"] = "application/json"
            else:
                encoded_data = urllib.parse.urlencode(data).encode("utf-8")
                headers["Content-Type"] = "application/x-www-form-urlencoded"
        elif isinstance(data, bytes):
            encoded_data = data

    req = urllib.request.Request(url, data=encoded_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            status = resp.status
            body = resp.read().decode("utf-8")
            try:
                return status, json.loads(body)
            except Exception:
                return status, body
    except urllib.error.HTTPError as e:
        status = e.code
        body = e.read().decode("utf-8")
        try:
            return status, json.loads(body)
        except Exception:
            return status, body

def send_multipart(path, fields, files, headers=None):
    boundary = f"----WebKitFormBoundary{uuid.uuid4().hex}"
    headers = headers or {}
    headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"

    body = bytearray()
    for k, v in fields.items():
        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(f'Content-Disposition: form-data; name="{k}"\r\n\r\n'.encode("utf-8"))
        body.extend(f"{v}\r\n".encode("utf-8"))

    for field_name, (filename, content, content_type) in files.items():
        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(f'Content-Disposition: form-data; name="{field_name}"; filename="{filename}"\r\n'.encode("utf-8"))
        body.extend(f"Content-Type: {content_type}\r\n\r\n".encode("utf-8"))
        body.extend(content)
        body.extend(b"\r\n")

    body.extend(f"--{boundary}--\r\n".encode("utf-8"))
    
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, data=bytes(body), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))


def test_all():
    print("==================================================")
    print("DRISHYAM - Issue #12 Security & Evidence Verification Test Suite")
    print("==================================================")

    # 1. Test Health
    status, body = make_request("/api/v2/health")
    assert status == 200, f"Health check failed: {body}"
    print("[PASS] 1. Health check operational")

    # 2. Test Unauthenticated Rejection (HTTP 401)
    status, body = make_request("/api/v2/evidence")
    assert status == 401, f"Expected 401 on unauthenticated evidence access, got {status}"
    print("[PASS] 2. Unauthenticated request to /api/v2/evidence rejected with HTTP 401")

    # 3. Test Invalid Login Rejection (HTTP 401) and Failed Login Audit
    status, body = make_request("/api/v2/auth/login", method="POST", data={"username": "investigator@drishyam.demo", "password": "wrongpassword"}, is_json=False)
    assert status == 401, f"Expected 401 on bad password, got {status}"
    print("[PASS] 3. Bad credentials rejected with HTTP 401 (LOGIN_FAILED)")

    # 4. Test Valid Logins for Roles
    # 4a. Admin Login
    status, body = make_request("/api/v2/auth/login", method="POST", data={"username": "admin@drishyam.demo", "password": "demo1234"}, is_json=False)
    assert status == 200, f"Admin login failed: {body}"
    admin_token = body["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("[PASS] 4a. Admin authenticated successfully")

    # 4b. Investigator Login
    status, body = make_request("/api/v2/auth/login", method="POST", data={"username": "investigator@drishyam.demo", "password": "demo1234"}, is_json=False)
    assert status == 200, f"Investigator login failed: {body}"
    inv_token = body["access_token"]
    inv_headers = {"Authorization": f"Bearer {inv_token}"}
    print("[PASS] 4b. Investigator authenticated successfully")

    # 4c. Analyst Login
    status, body = make_request("/api/v2/auth/login", method="POST", data={"username": "analyst@drishyam.demo", "password": "demo1234"}, is_json=False)
    assert status == 200, f"Analyst login failed: {body}"
    ana_token = body["access_token"]
    ana_headers = {"Authorization": f"Bearer {ana_token}"}
    print("[PASS] 4c. Analyst authenticated successfully")

    # 5. Test RBAC Enforcement (HTTP 403)
    # 5a. Analyst cannot register evidence -> 403 Forbidden
    status, body = make_request(
        "/api/v2/evidence",
        method="POST",
        headers=ana_headers,
        data={"evidence_type": "DIGITAL_EXTRACTION", "description": "Analyst should not be able to record this"}
    )
    assert status == 403, f"Expected 403 for analyst evidence registration, got {status}: {body}"
    print("[PASS] 5a. RBAC: Analyst blocked from registering evidence (HTTP 403 Forbidden)")

    # 5b. Investigator cannot manage system users -> 403 Forbidden
    status, body = make_request("/api/v2/admin/users", method="GET", headers=inv_headers)
    assert status == 403, f"Expected 403 for investigator accessing admin users, got {status}: {body}"
    print("[PASS] 5b. RBAC: Investigator blocked from admin user management (HTTP 403 Forbidden)")

    # 5c. Admin can manage users -> 200 OK
    status, body = make_request("/api/v2/admin/users", method="GET", headers=admin_headers)
    assert status == 200, f"Admin users access failed: {body}"
    print("[PASS] 5c. RBAC: Admin granted access to admin user management (HTTP 200 OK)")

    # 6. Test Evidence Registration & SHA-256 Digest
    status, reg_data = make_request(
        "/api/v2/evidence",
        method="POST",
        headers=inv_headers,
        data={
            "evidence_type": "DIGITAL_EXTRACTION",
            "description": "Seized encrypted mobile backup from prime suspect device",
            "custodian_division": "Special Cyber Forensics Unit"
        }
    )
    assert status == 200, f"Evidence registration failed: {reg_data}"
    reg_ev_id = reg_data["evidence_id"]
    reg_sha256 = reg_data["sha256_digest"]
    assert len(reg_sha256) == 64, "Expected valid 64-char SHA-256 hash"
    print(f"[PASS] 6. Evidence registered with deterministic SHA-256 digest ({reg_sha256[:16]}...)")

    # 7. Test Physical File Upload & Binary SHA-256 Verification
    test_bytes = b"DRISHYAM_SEIZED_FORENSIC_RAW_PAYLOAD_BYTE_STREAM_EXHIBIT_2026"
    expected_file_sha256 = hashlib.sha256(test_bytes).hexdigest()

    fields = {
        "evidence_type": "DIGITAL_EXTRACTION",
        "description": "Physical disk sector image acquired during raid",
        "custodian_division": "Cyber Cell Evidence Vault"
    }
    files = {
        "file": ("suspect_harddrive_clone.bin", test_bytes, "application/octet-stream")
    }
    status, upload_res = send_multipart("/api/v2/evidence/upload", fields=fields, files=files, headers=inv_headers)
    assert status == 200, f"File upload failed: {upload_res}"
    assert upload_res["sha256_digest"] == expected_file_sha256, f"Hash mismatch: got {upload_res['sha256_digest']}, expected {expected_file_sha256}"
    upload_ev_id = upload_res["evidence_id"]
    print(f"[PASS] 7. Physical file uploaded, stored in vault, and byte-level SHA-256 computed: {expected_file_sha256[:16]}...")

    # 8. Test Evidence Integrity Verification - SUCCESS (Passing)
    status, verify_pass_data = make_request(f"/api/v2/evidence/{reg_ev_id}/verify", method="POST", headers=inv_headers)
    assert status == 200, f"Verification failed: {verify_pass_data}"
    assert verify_pass_data["verified"] is True, "Expected verified to be True"
    assert verify_pass_data["status"] == "VERIFIED", f"Expected status 'VERIFIED', got {verify_pass_data['status']}"
    assert verify_pass_data["calculated_hash"] == reg_sha256, "Calculated hash must match recorded seal"
    print(f"[PASS] 8. Cryptographic integrity verification passed (100% bit match)")

    # 9. Test Evidence Integrity Verification - FAILURE (Tamper Detection)
    # 9a. Using simulation query parameter
    status, verify_tamper_data = make_request(f"/api/v2/evidence/{reg_ev_id}/verify?simulate_tamper=true", method="POST", headers=inv_headers)
    assert status == 200, f"Tamper verification request failed: {verify_tamper_data}"
    assert verify_tamper_data["verified"] is False, "Expected verified to be False on tampered content"
    assert verify_tamper_data["status"] == "TAMPER_DETECTED", f"Expected TAMPER_DETECTED, got {verify_tamper_data['status']}"
    assert verify_tamper_data["calculated_hash"] != verify_tamper_data["recorded_hash"], "Hashes must differ on tamper"
    print(f"[PASS] 9a. Tamper detection verified: Hash mismatch detected and flagged as TAMPER_DETECTED")

    # 9b. Using persistent tamper test simulation toggle
    status, toggle_res = make_request(f"/api/v2/evidence/{reg_ev_id}/tamper-test?enable_tamper=true", method="POST", headers=inv_headers)
    assert status == 200
    status, verify_tamper2 = make_request(f"/api/v2/evidence/{reg_ev_id}/verify", method="POST", headers=inv_headers)
    assert verify_tamper2["verified"] is False
    assert verify_tamper2["status"] == "TAMPER_DETECTED"
    
    # Clear tamper simulation
    make_request(f"/api/v2/evidence/{reg_ev_id}/tamper-test?enable_tamper=false", method="POST", headers=inv_headers)
    status, verify_cleared = make_request(f"/api/v2/evidence/{reg_ev_id}/verify", method="POST", headers=inv_headers)
    assert verify_cleared["verified"] is True
    print(f"[PASS] 9b. Persistent tamper test simulation toggling and recovery validated")

    # 10. Test Tamper-Evident Integrity Ledger & Cryptographic Chain
    status, ledger_data = make_request("/api/v2/evidence/ledger", method="GET", headers=inv_headers)
    assert status == 200, f"Ledger inspection failed: {ledger_data}"
    assert ledger_data["ledger_type"] == "Tamper-Evident Integrity Ledger", f"Expected correct terminology, got {ledger_data['ledger_type']}"
    assert ledger_data["chain_valid"] is True, f"Ledger chain validation failed: {ledger_data.get('validation_error')}"
    assert ledger_data["total_blocks"] >= 1, "Ledger should contain at least Genesis + evidence blocks"
    print(f"[PASS] 10. Tamper-Evident Integrity Ledger validated: {ledger_data['total_blocks']} blocks chained and unbroken")

    # 11. Test Audit Log Records
    status, audit_res = make_request("/api/v2/audit", method="GET", headers=admin_headers)
    assert status == 200, f"Audit log retrieval failed: {audit_res}"
    audit_logs = audit_res["audit_logs"]
    actions = [l["action"] for l in audit_logs]

    assert "LOGIN" in actions, "LOGIN event missing from audit log"
    assert "LOGIN_FAILED" in actions, "LOGIN_FAILED event missing from audit log"
    assert "EVIDENCE_REGISTERED" in actions, "EVIDENCE_REGISTERED event missing from audit log"
    assert "EVIDENCE_UPLOADED" in actions, "EVIDENCE_UPLOADED event missing from audit log"
    assert "EVIDENCE_INTEGRITY_VERIFIED" in actions, "EVIDENCE_INTEGRITY_VERIFIED missing from audit log"
    assert "EVIDENCE_INTEGRITY_FAILED" in actions, "EVIDENCE_INTEGRITY_FAILED missing from audit log"

    first_log = audit_logs[0]
    assert "operator_name" in first_log, "operator_name missing from audit log"
    assert "operator_email" in first_log, "operator_email missing from audit log"
    assert "operator_role" in first_log, "operator_role missing from audit log"
    assert "timestamp" in first_log, "timestamp missing from audit log"
    print(f"[PASS] 11. Audit Log verified: All security and evidence events (LOGIN, UPLOAD, VERIFY, TAMPER) recorded with rich operator metadata")

    print("==================================================")
    print("ALL 11 SECURITY, EVIDENCE, INTEGRITY & AUDIT TESTS PASSED!")
    print("==================================================")

if __name__ == "__main__":
    test_all()

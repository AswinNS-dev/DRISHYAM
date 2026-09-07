"""Application-layer data: users, officers, victims, gangs, notifications,
intelligence reports + report files, model metadata, audit logs, import jobs.

Everything here is 100% synthetic and clearly labelled as demo content.
"""

import datetime as dt
import hashlib
import json

import config
import core
from entities import _rand_datetime
from names import OFFICER_NAMES, DISTRICTS

# Valid bcrypt hash of the demo password "demo1234" (demo credential only).
DEMO_PASSWORD_HASH = "$2b$12$4jpwwFIZaSo5Y5ZJhXNEx.GjIbiBbgVv30ozJW9HVUfSHvWSS3B6W"

DEMO_USERS = [
    ("investigator@drishyam.demo", "Investigator Demo", "investigator"),
    ("admin@drishyam.demo", "Admin Demo", "admin"),
    ("analyst@drishyam.demo", "Analyst Demo", "crime_analyst"),
]


def generate_users_officers(ctx):
    """Runs early: officers are referenced by notes + chain-of-custody."""
    user_rows = []
    for email, name, role in DEMO_USERS:
        row = {
            "id": core.next_id("US"),
            "email": email,
            "full_name": name,
            "hashed_password": DEMO_PASSWORD_HASH,
            "role": role,
            "is_active": True,
            "created_at": dt.datetime(2024, 1, 2, 9, 0, 0),
        }
        core.add_row("users", row)
        user_rows.append(row)
    ctx["_user_rows"] = user_rows

    officer_rows = []
    ranks = ["Inspector", "Sub-Inspector", "Deputy Superintendent of Police",
             "Assistant Commissioner", "Constable"]
    used_badges = set()
    for i, (name, (district, _, _)) in enumerate(zip(OFFICER_NAMES, DISTRICTS * 3)):
        while True:
            badge = f"TNPLC-{1000 + core.rng.randint(0, 8999)}"
            if badge not in used_badges:
                used_badges.add(badge)
                break
        officer = {
            "id": core.next_id("OF"),
            "user_id": user_rows[i]["id"] if i < len(user_rows) else None,
            "badge_number": badge,
            "rank": ranks[i % len(ranks)],
            "district": district,
            "created_at": dt.datetime(2024, 1, 2, 9, 0, 0),
        }
        core.add_row("officers", officer)
        officer_rows.append(officer)
    ctx["_officer_rows"] = officer_rows
    return ctx


def generate_app_data(ctx):
    rng = core.rng
    users = ctx["_user_rows"]
    admin_id = next(u["id"] for u in users if u["role"] == "admin")
    gangs = ctx["organizations"]["gangs"]
    persons_by_id = ctx["persons"]["persons_by_id"]
    cases = ctx["cases"]["cases"]
    anomalies = core.DATA["anomalies"]
    alerts = core.DATA["alerts"]
    nodes_analysis = core.DATA.get("network_analysis", [])

    # ---- gangs (territory rows for gang organizations) ----
    district_names = [d for d, _, _ in DISTRICTS]
    for g in gangs:
        core.add_row("gangs", {
            "id": core.next_id("GA"),
            "organization_id": g["id"],
            "territory": rng.choice(district_names),
            "created_at": core.now_utc(),
        })

    # ---- victims (person+case pairs from REPORTED_CASE relationships) ----
    seen_pairs = set()
    for rel in core.DATA["relationships"]:
        if rel["relationship_type"] == "REPORTED_CASE":
            key = (rel["source_entity_id"], rel["target_entity_id"])
            if key in seen_pairs:
                continue
            seen_pairs.add(key)
            core.add_row("victims", {
                "id": core.next_id("VI"),
                "person_id": rel["source_entity_id"],
                "case_id": rel["target_entity_id"],
                "created_at": core.now_utc(),
            })

    # ---- intelligence reports + downloadable report files ----
    top_entities = []
    if nodes_analysis:
        ranked = sorted(nodes_analysis, key=lambda r: -(r["pagerank"] or 0))
        top_entities = [r["entity_id"] for r in ranked[: max(6, config.NUM_INTELLIGENCE_REPORTS)]]
    report_types = [
        "Entity Relationship Report", "Network Intelligence Summary",
        "Case Evidence Brief", "Anomaly Assessment Note",
    ]
    report_rows = []
    for i in range(config.NUM_INTELLIGENCE_REPORTS):
        rtype = report_types[i % len(report_types)]
        entity_id = top_entities[i % len(top_entities)] if top_entities else None
        case = rng.choice(cases) if cases and i % 3 == 0 else None
        target_name = persons_by_id[entity_id]["full_name"] if entity_id in persons_by_id \
            else "Network-wide"
        title = f"{rtype} - {target_name}"
        content = {
            "report_type": rtype,
            "generated_for": target_name,
            "data_classification": "SYNTHETIC / DEMO DATA - NOT REAL POLICE DATA",
            "summary": (
                f"Consolidated analytical overview compiled from {len(core.DATA['relationships'])} "
                f"evidence-backed relationships across the synthetic DRISHYAM dataset. "
                f"Subject: {target_name}."),
            "sections": {
                "identity": "See Dossier 360 for the full identity and alias trail.",
                "network_position": "Centrality and community metrics derived from the relationships graph.",
                "recommendations": "Verify each inferred link against the supporting evidence records before operational use.",
            },
            "note": "AI-generated content in this report is analytical output, not a confirmed police finding.",
        }
        created = _rand_datetime()
        row = {
            "id": core.next_id("RP"),
            "report_type": rtype,
            "entity_id": entity_id,
            "case_id": case["id"] if case else None,
            "title": title,
            "content_json": content,
            "created_by": admin_id,
            "created_at": created,
        }
        core.add_row("intelligence_reports", row)
        report_rows.append(row)
        core.add_row("reports", {
            "id": core.next_id("RF"),
            "report_id": row["id"],
            "file_format": rng.choice(["pdf", "docx"]),
            "storage_path": f"/secure_vault/reports/{row['id']}.{ 'pdf' }",
            "created_at": created,
        })
    ctx["_report_rows"] = report_rows

    # ---- notifications (per user, derived from real alerts/anomalies) ----
    for u in users:
        for i in range(rng.randint(2, 4)):
            if alerts:
                a = rng.choice(alerts)
                title = f"New {a['alert_type'].replace('_', ' ').title()} alert"
                body = a["what_happened"]
            elif anomalies:
                an = rng.choice(anomalies)
                title = f"Anomaly flagged: {an['anomaly_type'].replace('_', ' ').title()}"
                body = an["reason"]
            else:
                title, body = "System digest", "No intelligence conditions recorded."
            core.add_row("notifications", {
                "id": core.next_id("NT"),
                "user_id": u["id"],
                "title": title,
                "body": body,
                "is_read": rng.random() < 0.4,
                "created_at": _rand_datetime(),
            })

    # ---- model metadata ----
    for name, version, purpose, feats in [
        ("drishyam-ner-v1", "1.0", "Rule-based entity extraction (PERSON/PHONE/VEHICLE/LOCATION/etc.)",
         ["regex", "gazetteer", "capitalization heuristics"]),
        ("drishyam-entity-resolution-v1", "1.0", "Fuzzy + contextual identity resolution",
         ["rapidfuzz token similarity", "shared phone", "shared vehicle", "same case"]),
        ("drishyam-anomaly-v1", "1.0", "Z-score based interaction anomaly detection",
         ["daily call counts", "daily transaction volume", "new-connection rate"]),
        ("networkx-community-v1", "1.0", "Greedy modularity community detection over the relationships graph",
         ["greedy_modularity_communities"]),
    ]:
        core.add_row("model_metadata", {
            "id": core.next_id("MM"),
            "model_name": name,
            "version": version,
            "purpose": purpose,
            "training_dataset": "Synthetic DRISHYAM corpus (seed "
                                f"{config.SEED}, preset {config.PRESET})",
            "features": feats,
            "training_date": config.EPOCH_END,
            "evaluation_metrics": {"note": "demo metrics - synthetic corpus only"},
            "is_demo_model": True,
            "updated_at": core.now_utc(),
        })

    # ---- import jobs ----
    for i in range(config.NUM_IMPORT_JOBS):
        jtype = ["fir", "cdr", "financial", "surveillance"][i % 4]
        core.add_row("import_jobs", {
            "id": core.next_id("IJ"),
            "job_type": jtype,
            "filename": f"synthetic_{jtype}_batch_{i + 1:02d}.json",
            "status": "completed",
            "entities_extracted": rng.randint(20, 400),
            "relationships_created": rng.randint(10, 200),
            "created_at": _rand_datetime(),
        })

    # ---- audit logs ----
    actions = [
        ("LOGIN", {"email": "{email}"}),
        ("DATA_IMPORT", {"type": "fir", "fir_number": "FIR-{n}"}),
        ("EVIDENCE_REGISTERED", {"evidence_id": "EV{n:06d}", "evidence_type": "CDR"}),
        ("EVIDENCE_INTEGRITY_VERIFIED", {"evidence_id": "EV{n:06d}", "status": "PASSED"}),
        ("REPORT_GENERATED", {"report_id": "RP{n:06d}"}),
        ("AI_QUERY", {"question": "Summarize the network around a tracked subject."}),
        ("FIR_FILED", {"fir_number": "FIR-{n}", "entities_found": 7}),
    ]
    for i in range(config.NUM_AUDIT_LOGS):
        action, details = rng.choice(actions)
        user = rng.choice(users)
        det = {k: v.format(email=user["email"], n=rng.randint(1, 900)) if isinstance(v, str) else v
               for k, v in details.items()}
        core.add_row("audit_logs", {
            "id": core.next_id("AU"),
            "user_id": user["id"],
            "action": action,
            "details": det,
            "created_at": _rand_datetime(),
        })
    return ctx

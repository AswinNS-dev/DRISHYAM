"""DRISHYAM synthetic data generator - orchestrator.

Generates the complete, internally consistent synthetic intelligence dataset:

    python scripts/generate_synthetic_data.py                # demo preset
    DRISHYAM_PRESET=full python scripts/generate_synthetic_data.py

Outputs (deterministic for a fixed SEED):
    database/drishyam_complete.sql   - schema + all seed data (Postgres/Supabase)
    data/*.csv                       - one CSV per table, schema-exact
    backend/drishyam_local.db        - optional SQLite load (--sqlite)
"""

import argparse
import csv
import json
import os
import sys
from datetime import date, datetime

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT_DIR, "data_generator"))
sys.path.insert(0, os.path.join(ROOT_DIR, "backend"))

import config  # noqa: E402
import core  # noqa: E402
import entities  # noqa: E402
import relationships  # noqa: E402
import firs  # noqa: E402
import calls  # noqa: E402
import financial  # noqa: E402
import surveillance  # noqa: E402
import analytics  # noqa: E402
import intel  # noqa: E402
from schema_sql import SCHEMA_DDL  # noqa: E402

DATA_DIR = os.path.join(ROOT_DIR, "data")
DATABASE_DIR = os.path.join(ROOT_DIR, "database")


def ensure_dirs():
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(DATABASE_DIR, exist_ok=True)


def generate():
    ensure_dirs()
    print(f"[DRISHYAM] preset={config.PRESET} seed={config.SEED}")
    core.init(config.SEED)
    ctx = {}

    print("[1/9] Locations, gangs, persons, assets, cases, users, officers...")
    ctx = entities.generate()
    intel.generate_users_officers(ctx)

    print("[2/9] Hidden chains + structural relationship graph...")
    relationships.build_hidden_chains(ctx)
    relationships.build_structural_edges(ctx)

    print("[3/9] FIR narratives + NLP entity mentions...")
    firs.generate(ctx)

    print("[4/9] CDR communication relationships (with burst windows)...")
    calls.generate(ctx)

    print("[5/9] Financial transactions (laundering / burst / routine)...")
    financial.generate(ctx)

    print("[6/9] Surveillance records, CDR details, notes, evidence chain...")
    surveillance.generate_surveillance(ctx)
    surveillance.generate_cdr_details(ctx)
    surveillance.generate_investigation_notes(ctx)
    surveillance.generate_evidence_chain(ctx)

    print("[7/9] Derived network analytics (centrality, communities)...")
    analytics.generate_network_analytics(ctx)

    print("[8/9] Derived anomalies (bursts, spikes, geo, expansion)...")
    analytics.generate_anomalies(ctx)
    analytics.generate_alerts(ctx)
    analytics.generate_entity_matches(ctx)
    analytics.generate_network_events(ctx)
    analytics.generate_intelligence_leads(ctx)

    print("[9/9] Application data (reports, notifications, audit, models)...")
    intel.generate_app_data(ctx)

    _report_stats()
    return ctx


def _report_stats():
    print("\n--- Dataset summary ---")
    for table in core.TABLE_ORDER:
        n = len(core.DATA.get(table, []))
        if n:
            print(f"  {table:24s} {n:>8,d}")
    chains = core.DATA.get("_stats_hint") or []
    print()


# --------------------------------------------------------------------------
# CSV export (schema-exact column order for the loader/validator)
# --------------------------------------------------------------------------
def _dt_to_sql(v: datetime) -> str:
    return v.isoformat() + "Z"


def _csv_value(v):
    if v is None:
        return ""
    if isinstance(v, datetime):
        return _dt_to_sql(v)
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, (list, dict)):
        return json.dumps(v)
    if isinstance(v, float):
        return f"{v:.6f}".rstrip("0").rstrip(".")
    return str(v)


def write_csvs():
    print(f"\nExporting CSVs to {DATA_DIR} ...")
    written = []
    for table in core.TABLE_ORDER:
        rows = core.DATA.get(table) or []
        if not rows:
            continue
        path = os.path.join(DATA_DIR, f"{table}.csv")
        cols = list(rows[0].keys())
        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=cols)
            writer.writeheader()
            for row in rows:
                writer.writerow({c: _csv_value(row.get(c)) for c in cols})
        written.append((table, len(rows)))
    for table, n in written:
        print(f"  data/{table}.csv ({n:,} rows)")
    return written


# --------------------------------------------------------------------------
# SQL generation: schema + data, rerunnable
# --------------------------------------------------------------------------
OUT_SQL_PATH = os.path.join(DATABASE_DIR, "drishyam_complete.sql")


def _sql_value(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "TRUE" if v else "FALSE"
    if isinstance(v, (int,)):
        return str(v)
    if isinstance(v, float):
        return repr(round(v, 6))
    if isinstance(v, datetime):
        return f"'{_dt_to_sql(v)}'"
    if isinstance(v, date):
        return f"'{v.isoformat()}'"
    if isinstance(v, (list, dict)):
        j = json.dumps(v).replace("'", "''")
        return f"'{j}'::jsonb"
    s = str(v).replace("'", "''")
    return f"'{s}'"


def write_sql():
    print(f"\nGenerating {OUT_SQL_PATH} ...")
    with open(OUT_SQL_PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write(SCHEMA_DDL)
        f.write(f"""
-- =====================================================================
-- 13. SYNTHETIC SEED DATA (generated)
-- Everything below is SYNTHETIC INTELLIGENCE - NOT REAL POLICE DATA.
-- Generated by scripts/generate_synthetic_data.py
--   preset: {config.PRESET}   seed: {config.SEED}   epoch: {config.EPOCH_START} -> {config.EPOCH_END}
-- =====================================================================

BEGIN;

""")
        f.write("-- ---------- Demo users (password: demo1234) + officers ----------\n")
        for table in ("users", "officers"):
            _emit_table(f, table, core.DATA.get(table) or [])
        f.write("\n-- ---------- Core entities ----------\n")
        for table in ("persons", "aliases", "victims", "organizations", "gangs",
                      "locations", "phones", "vehicles", "financial_accounts",
                      "crime_cases", "firs", "investigation_notes", "evidence",
                      "evidence_metadata", "chain_of_custody",
                      "surveillance_records", "cdr_records", "transactions"):
            _emit_table(f, table, core.DATA.get(table) or [])
        f.write("\n-- ---------- Intelligence layer ----------\n")
        for table in ("entity_mentions", "entity_matches", "relationships",
                      "network_analysis", "network_communities", "network_events",
                      "anomalies", "intelligence_leads", "intelligence_reports"):
            _emit_table(f, table, core.DATA.get(table) or [])
        f.write("\n-- ---------- Application layer ----------\n")
        for table in ("notifications", "alerts", "reports", "audit_logs",
                      "import_jobs", "model_metadata"):
            _emit_table(f, table, core.DATA.get(table) or [])
        f.write("\nCOMMIT;\n\n")

        f.write(f"""-- =====================================================================
-- 14. VALIDATION QUERIES
-- Run after load; every count must be 0 (no orphan/broken records) and
-- the final SELECTs must return non-zero intelligence structures.
-- =====================================================================

-- Orphan FIRs (case_id must exist):
SELECT count(*) AS orphan_firs FROM firs f
  LEFT JOIN crime_cases c ON f.case_id = c.id
  WHERE f.case_id IS NOT NULL AND c.id IS NULL;

-- Orphan PERSON relationship endpoints:
SELECT count(*) AS orphan_rel_persons FROM relationships r
  WHERE r.source_entity_type = 'PERSON' AND NOT EXISTS
    (SELECT 1 FROM persons p WHERE p.id = r.source_entity_id)
  OR r.target_entity_type = 'PERSON' AND NOT EXISTS
    (SELECT 1 FROM persons p WHERE p.id = r.target_entity_id);

-- Orphan PHONE owners:
SELECT count(*) AS orphan_phones FROM phones ph
  LEFT JOIN persons p ON ph.owner_person_id = p.id
  WHERE ph.owner_person_id IS NOT NULL AND p.id IS NULL;

-- Broken evidence links on relationships:
SELECT count(*) AS broken_evidence_links FROM relationships r
  LEFT JOIN evidence e ON r.evidence_id = e.id
  WHERE r.evidence_id IS NOT NULL AND e.id IS NULL;

-- Relationship endpoints referencing no known entity table:
SELECT count(*) AS orphan_rel_endpoints FROM relationships r
  WHERE (r.source_entity_type = 'PERSON' AND NOT EXISTS (SELECT 1 FROM persons WHERE id = r.source_entity_id))
     OR (r.source_entity_type = 'PHONE'   AND NOT EXISTS (SELECT 1 FROM phones WHERE id = r.source_entity_id))
     OR (r.source_entity_type = 'VEHICLE' AND NOT EXISTS (SELECT 1 FROM vehicles WHERE id = r.source_entity_id))
     OR (r.source_entity_type = 'BANK_ACCOUNT' AND NOT EXISTS (SELECT 1 FROM financial_accounts WHERE id = r.source_entity_id))
     OR (r.source_entity_type IN ('ORGANIZATION','GANG') AND NOT EXISTS (SELECT 1 FROM organizations WHERE id = r.source_entity_id))
     OR (r.source_entity_type = 'LOCATION' AND NOT EXISTS (SELECT 1 FROM locations WHERE id = r.source_entity_id))
     OR (r.source_entity_type = 'CASE' AND NOT EXISTS (SELECT 1 FROM crime_cases WHERE id = r.source_entity_id))
     OR (r.target_entity_type = 'PERSON' AND NOT EXISTS (SELECT 1 FROM persons WHERE id = r.target_entity_id))
     OR (r.target_entity_type = 'PHONE'   AND NOT EXISTS (SELECT 1 FROM phones WHERE id = r.target_entity_id))
     OR (r.target_entity_type = 'VEHICLE' AND NOT EXISTS (SELECT 1 FROM vehicles WHERE id = r.target_entity_id))
     OR (r.target_entity_type = 'BANK_ACCOUNT' AND NOT EXISTS (SELECT 1 FROM financial_accounts WHERE id = r.target_entity_id))
     OR (r.target_entity_type IN ('ORGANIZATION','GANG') AND NOT EXISTS (SELECT 1 FROM organizations WHERE id = r.target_entity_id))
     OR (r.target_entity_type = 'LOCATION' AND NOT EXISTS (SELECT 1 FROM locations WHERE id = r.target_entity_id))
     OR (r.target_entity_type = 'CASE' AND NOT EXISTS (SELECT 1 FROM crime_cases WHERE id = r.target_entity_id));

-- Negative amounts / invalid durations (data quality):
SELECT count(*) AS bad_amounts FROM transactions WHERE amount < 0;
SELECT count(*) AS bad_durations FROM cdr_records WHERE duration_seconds < 0;

-- Intelligence structures that must exist (non-zero):
SELECT count(*) AS anomalies FROM anomalies;
SELECT count(*) AS alerts FROM alerts;
SELECT count(*) AS intelligence_leads FROM intelligence_leads;
SELECT count(*) AS entity_matches FROM entity_matches;
SELECT count(*) AS communities FROM (SELECT DISTINCT community_label FROM network_communities) t;
SELECT count(*) AS centrality_rows FROM network_analysis;
SELECT count(*) AS active_relationships FROM relationships WHERE status = 'active';

-- Hidden chains: multi-hop person->gang paths with NO direct edge
-- (each row is a discoverable buried link):
SELECT count(*) AS hidden_person_gang_pairs
FROM (SELECT DISTINCT r.source_entity_id AS pid, r.target_entity_id AS gid
      FROM relationships r
      WHERE r.source_entity_type = 'PERSON' AND r.target_entity_type = 'GANG'
        AND r.relationship_type IN ('LINKED_TO','MEMBER_OF')) direct
WHERE EXISTS (
  SELECT 1 FROM relationships r1
  JOIN relationships r2 ON r1.target_entity_id = r2.source_entity_id
  WHERE r1.source_entity_id = direct.pid
    AND r2.target_entity_id = direct.gid
    AND r1.target_entity_id <> direct.gid)
AND NOT EXISTS (
  SELECT 1 FROM relationships rd
  WHERE rd.source_entity_id = direct.pid AND rd.target_entity_id = direct.gid
    AND rd.relationship_type IN ('LINKED_TO','MEMBER_OF'));

-- Dashboard statistics (all database-derived):
SELECT * FROM v_dashboard_summary;

-- =====================================================================
-- END OF SCRIPT
-- =====================================================================
""")
    size_mb = os.path.getsize(OUT_SQL_PATH) / (1024 * 1024)
    print(f"  wrote {OUT_SQL_PATH} ({size_mb:.1f} MB)")


def _emit_table(f, table, rows):
    if not rows:
        return
    cols = list(rows[0].keys())
    col_list = ", ".join(cols)
    f.write(f"\n-- {table} ({len(rows):,} rows)\n")
    batch = 400
    for i in range(0, len(rows), batch):
        chunk = rows[i:i + batch]
        f.write(f"INSERT INTO {table} ({col_list}) VALUES\n")
        f.write(",\n".join(
            "(" + ", ".join(_sql_value(row.get(c)) for c in cols) + ")"
            for row in chunk))
        f.write(" ON CONFLICT DO NOTHING;\n")


# --------------------------------------------------------------------------
# Optional direct SQLite load (dev convenience)
# --------------------------------------------------------------------------
def load_sqlite():
    db_path = os.path.join(ROOT_DIR, "backend", "drishyam_local.db")
    uri = "sqlite:///" + db_path.replace("\\", "/")
    print(f"\nLoading dataset into SQLite ({db_path}) ...")
    from sqlalchemy import create_engine, event
    from sqlalchemy.orm import sessionmaker
    engine = create_engine(uri)
    from app.database.db import Base
    from app.models import models as m

    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    model_map = {
        "users": m.User, "officers": m.Officer, "persons": m.Person,
        "aliases": m.Alias, "victims": m.Victim, "organizations": m.Organization,
        "gangs": m.Gang, "locations": m.Location, "phones": m.Phone,
        "vehicles": m.Vehicle, "financial_accounts": m.FinancialAccount,
        "crime_cases": m.CrimeCase, "firs": m.FIR,
        "investigation_notes": m.InvestigationNote, "evidence": m.Evidence,
        "evidence_metadata": m.EvidenceMetadata,
        "chain_of_custody": m.ChainOfCustody,
        "surveillance_records": m.SurveillanceRecord,
        "cdr_records": m.CDRRecord, "transactions": m.Transaction,
        "entity_mentions": m.EntityMention, "entity_matches": m.EntityMatch,
        "relationships": m.RelationshipRecord,
        "network_analysis": m.NetworkAnalysis,
        "network_communities": m.NetworkCommunity,
        "network_events": m.NetworkEvent, "anomalies": m.Anomaly,
        "intelligence_leads": m.IntelligenceLead,
        "intelligence_reports": m.IntelligenceReport,
        "notifications": m.Notification, "alerts": m.Alert, "reports": m.Report,
        "audit_logs": m.AuditLog, "import_jobs": m.ImportJob,
        "model_metadata": m.ModelMetadata,
    }

    total = 0
    for table in core.TABLE_ORDER:
        rows = core.DATA.get(table) or []
        model = model_map.get(table)
        if not model or not rows:
            continue
        db.query(model).delete()
        objs = []
        for row in rows:
            data = {k: v for k, v in row.items() if hasattr(model, k)}
            objs.append(model(**data))
        db.bulk_save_objects(objs)
        db.commit()
        total += len(objs)
        print(f"  {table:24s} {len(objs):>8,}")
    print(f"SQLite load complete: {total:,} rows")
    db.close()


def main():
    parser = argparse.ArgumentParser(description="DRISHYAM synthetic data generator")
    parser.add_argument("--sqlite", action="store_true",
                        help="also load the generated dataset into backend/drishyam_local.db")
    parser.add_argument("--preset", choices=["demo", "full"], default=None,
                        help="override DRISHYAM_PRESET")
    args = parser.parse_args()
    if args.preset:
        os.environ["DRISHYAM_PRESET"] = args.preset
        import importlib
        importlib.reload(config)

    generate()
    write_csvs()
    write_sql()
    if args.sqlite:
        load_sqlite()
    print("\n[DRISHYAM] Synthetic generation complete.")


if __name__ == "__main__":
    main()

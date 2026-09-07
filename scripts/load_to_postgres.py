"""Load the generated DRISHYAM synthetic dataset into PostgreSQL/Supabase.

Reads data/*.csv (schema-exact) and bulk-inserts in foreign-key order with
batching, duplicate tolerance (ON CONFLICT DO NOTHING), per-table verification
counts, and orphan detection at the end.

Usage:
    set DRISHYAM_DB_URI=postgresql://postgres:PASSWORD@HOST:5432/postgres
    python scripts/load_to_postgres.py            # CSV -> Postgres
    python scripts/load_to_postgres.py --sqlite   # CSV -> backend/drishyam_local.db
    python scripts/load_to_postgres.py --from-sql # run database/drishyam_complete.sql instead

For Supabase use the connection string from Project Settings -> Database
(session pooler URI works). Credentials are read from the environment only.
"""

import argparse
import csv
import json
import os
import sys
from datetime import datetime, date

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT_DIR, "data")
SQL_PATH = os.path.join(ROOT_DIR, "database", "drishyam_complete.sql")

# Load order respects foreign-key constraints (matches core.TABLE_ORDER)
TABLE_ORDER = [
    "users", "officers", "persons", "aliases", "victims", "organizations",
    "gangs", "locations", "phones", "vehicles", "financial_accounts",
    "crime_cases", "firs", "investigation_notes", "evidence",
    "evidence_metadata", "chain_of_custody", "surveillance_records",
    "cdr_records", "transactions", "entity_mentions", "entity_matches",
    "relationships", "network_analysis", "network_communities",
    "network_events", "anomalies", "intelligence_leads",
    "intelligence_reports", "notifications", "alerts", "reports",
    "audit_logs", "import_jobs", "model_metadata",
]

BATCH_SIZE = 1000


def _csv_value_to_pg(v):
    """Convert CSV string values to Postgres python values."""
    if v is None or v == "":
        return None
    if v.startswith(("[", "{")) and v.endswith(("]", "}")):
        try:
            return json.dumps(json.loads(v))  # jsonb pass-through
        except (ValueError, TypeError):
            return v
    # timestamps: ISO strings pass through fine for timestamptz
    return v


def load_from_sql():
    """Execute database/drishyam_complete.sql directly (schema + seed)."""
    db_uri = os.environ.get("DRISHYAM_DB_URI")
    if not db_uri:
        print("Error: set DRISHYAM_DB_URI (postgresql://...)")
        sys.exit(1)
    try:
        import psycopg2
    except ImportError:
        print("Error: psycopg2 not installed (pip install psycopg2-binary)")
        sys.exit(1)

    print(f"Connecting to database ...")
    conn = psycopg2.connect(db_uri)
    conn.autocommit = True
    cur = conn.cursor()
    print(f"Executing {SQL_PATH} (this can take a few minutes) ...")
    with open(SQL_PATH, "r", encoding="utf-8") as f:
        cur.execute(f.read())
    cur.execute("""
        select 'persons' t, count(*) from persons
        union all select 'relationships', count(*) from relationships
        union all select 'crime_cases', count(*) from crime_cases
        union all select 'firs', count(*) from firs
        union all select 'cdr_records', count(*) from cdr_records
        union all select 'transactions', count(*) from transactions
        union all select 'surveillance_records', count(*) from surveillance_records
        union all select 'evidence', count(*) from evidence
        union all select 'anomalies', count(*) from anomalies
        union all select 'alerts', count(*) from alerts
        union all select 'network_analysis', count(*) from network_analysis
        union all select 'network_communities', count(*) from network_communities
    """)
    print("\nLoaded row counts:")
    for t, n in cur.fetchall():
        print(f"  {t:24s} {n:>10,}")
    cur.close()
    conn.close()
    print("\nSQL load complete.")


def load_csv_to_postgres():
    db_uri = os.environ.get("DRISHYAM_DB_URI")
    if not db_uri:
        print("Error: set DRISHYAM_DB_URI (postgresql://...)")
        sys.exit(1)
    try:
        import psycopg2
        from psycopg2.extras import execute_values
    except ImportError:
        print("Error: psycopg2 not installed (pip install psycopg2-binary)")
        sys.exit(1)

    print("Connecting to database ...")
    conn = psycopg2.connect(db_uri)
    cur = conn.cursor()
    total_inserted = 0
    errors = []

    for table in TABLE_ORDER:
        csv_path = os.path.join(DATA_DIR, f"{table}.csv")
        if not os.path.exists(csv_path):
            print(f"  {table:24s} (no csv, skipped)")
            continue
        with open(csv_path, "r", encoding="utf-8", newline="") as f:
            reader = csv.reader(f)
            columns = next(reader)
            rows = []
            for raw in reader:
                vals = [_csv_value_to_pg(v) for v in raw]
                rows.append(vals)
        if not rows:
            print(f"  {table:24s} 0 rows")
            continue
        query = (f"INSERT INTO {table} ({', '.join(columns)}) VALUES %s "
                 f"ON CONFLICT DO NOTHING")
        inserted = 0
        try:
            for i in range(0, len(rows), BATCH_SIZE):
                batch = rows[i:i + BATCH_SIZE]
                execute_values(cur, query, batch, page_size=BATCH_SIZE)
                inserted += cur.rowcount if cur.rowcount and cur.rowcount > 0 else len(batch)
            conn.commit()
            total_inserted += len(rows)
            print(f"  {table:24s} {len(rows):>8,} rows")
        except Exception as exc:
            conn.rollback()
            errors.append((table, str(exc)[:300]))
            print(f"  {table:24s} ERROR: {str(exc)[:200]}")

    # ---- verification: expected vs actual ----
    print("\nVerification (actual DB counts):")
    expected_failures = []
    for table in TABLE_ORDER:
        csv_path = os.path.join(DATA_DIR, f"{table}.csv")
        if not os.path.exists(csv_path):
            continue
        with open(csv_path, "r", encoding="utf-8", newline="") as f:
            expected = sum(1 for _ in f) - 1
        try:
            cur.execute(f"SELECT count(*) FROM {table}")
            actual = cur.fetchone()[0]
            status = "OK" if actual >= expected else "MISMATCH"
            if actual < expected:
                expected_failures.append(table)
            print(f"  {table:24s} expected>={expected:>8,} actual={actual:>10,} {status}")
        except Exception as exc:
            errors.append((table, f"verify: {str(exc)[:200]}"))

    # ---- orphan detection ----
    print("\nOrphan checks (all must be 0):")
    orphan_queries = [
        ("firs->crime_cases",
         "SELECT count(*) FROM firs f LEFT JOIN crime_cases c ON f.case_id=c.id "
         "WHERE f.case_id IS NOT NULL AND c.id IS NULL"),
        ("phones->persons",
         "SELECT count(*) FROM phones p LEFT JOIN persons x ON p.owner_person_id=x.id "
         "WHERE p.owner_person_id IS NOT NULL AND x.id IS NULL"),
        ("vehicles->persons",
         "SELECT count(*) FROM vehicles v LEFT JOIN persons x ON v.owner_person_id=x.id "
         "WHERE v.owner_person_id IS NOT NULL AND x.id IS NULL"),
        ("accounts->persons",
         "SELECT count(*) FROM financial_accounts a LEFT JOIN persons x "
         "ON a.owner_person_id=x.id WHERE a.owner_person_id IS NOT NULL AND x.id IS NULL"),
        ("transactions->accounts",
         "SELECT count(*) FROM transactions t LEFT JOIN financial_accounts a "
         "ON t.from_account_id=a.id WHERE t.from_account_id IS NOT NULL AND a.id IS NULL"),
        ("relationships->evidence",
         "SELECT count(*) FROM relationships r LEFT JOIN evidence e "
         "ON r.evidence_id=e.id WHERE r.evidence_id IS NOT NULL AND e.id IS NULL"),
        ("custody->evidence",
         "SELECT count(*) FROM chain_of_custody c LEFT JOIN evidence e "
         "ON c.evidence_id=e.id WHERE c.evidence_id IS NOT NULL AND e.id IS NULL"),
    ]
    orphans_bad = 0
    for label, q in orphan_queries:
        try:
            cur.execute(q)
            n = cur.fetchone()[0]
            flag = "OK" if n == 0 else "ORPHANS"
            if n:
                orphans_bad += 1
            print(f"  {label:26s} {n:>6,} {flag}")
        except Exception as exc:
            errors.append((label, f"orphan check: {str(exc)[:200]}"))

    cur.close()
    conn.close()

    print(f"\nLoad complete: {total_inserted:,} rows processed.")
    if errors:
        print(f"\n{len(errors)} ERRORS:")
        for t, e in errors[:10]:
            print(f"  {t}: {e}")
        sys.exit(1)
    if expected_failures or orphans_bad:
        print("Verification FAILED - see mismatches/orphans above.")
        sys.exit(1)
    print("All verification checks passed.")


def load_csv_to_sqlite():
    """Dev convenience: load CSVs into the local SQLite file the backend uses."""
    sys.path.insert(0, os.path.join(ROOT_DIR, "backend"))
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.database.db import Base
    from app.models import models as m

    db_path = os.path.join(ROOT_DIR, "backend", "drishyam_local.db")
    engine = create_engine("sqlite:///" + db_path.replace("\\", "/"))
    Base.metadata.create_all(bind=engine)
    db = sessionmaker(bind=engine)()

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

    json_cols = {"supporting_evidence", "related_entities", "details",
                 "features", "evaluation_metrics", "content_json",
                 "affected_entities"}

    total = 0
    for table in TABLE_ORDER:
        csv_path = os.path.join(DATA_DIR, f"{table}.csv")
        model = model_map.get(table)
        if not model or not os.path.exists(csv_path):
            continue
        with open(csv_path, "r", encoding="utf-8", newline="") as f:
            rows = list(csv.DictReader(f))
        db.query(model).delete()
        objs = []
        for row in rows:
            clean = {}
            for k, v in row.items():
                if not hasattr(model, k):
                    continue
                if v == "" or v is None:
                    clean[k] = None
                elif k in json_cols:
                    clean[k] = json.loads(v) if v else ([] if "entities" in k or k == "features" else {})
                elif k == "confidence_score" or k.endswith("score") or k in ("amount", "confidence", "pagerank"):
                    clean[k] = float(v)
                elif k in ("degree_centrality", "betweenness_centrality", "latitude", "longitude"):
                    clean[k] = float(v)
                elif k in ("match_score", "match_score_x"):
                    clean[k] = float(v)
                elif k in ("evidence_count", "span_start", "span_end",
                           "duration_seconds", "entities_extracted",
                           "relationships_created", "community_label"):
                    clean[k] = int(v)
                elif k in ("is_active", "is_read", "is_demo_model"):
                    clean[k] = v.lower() == "true"
                elif k == "status":
                    clean[k] = v
                else:
                    # try datetime parse for *_at / *_date fields
                    if k.endswith(("_at", "opened_at", "txn_date", "call_time",
                                   "observed_at", "occurred_at", "reviewed_at",
                                   "filed_at", "created_at")) and v:
                        try:
                            clean[k] = datetime.fromisoformat(v.replace("Z", "+00:00")).replace(tzinfo=None)
                            continue
                        except ValueError:
                            pass
                    clean[k] = v
            objs.append(model(**clean))
        db.bulk_save_objects(objs)
        db.commit()
        total += len(objs)
        print(f"  {table:24s} {len(objs):>8,}")
    print(f"\nSQLite load complete: {total:,} rows -> {db_path}")
    db.close()


def main():
    parser = argparse.ArgumentParser(description="Load DRISHYAM dataset")
    parser.add_argument("--sqlite", action="store_true",
                        help="load CSVs into backend/drishyam_local.db (SQLite)")
    parser.add_argument("--from-sql", action="store_true",
                        help="execute database/drishyam_complete.sql on Postgres instead of CSV loading")
    args = parser.parse_args()

    if args.sqlite:
        load_csv_to_sqlite()
    elif args.from_sql:
        load_from_sql()
    else:
        load_csv_to_postgres()


if __name__ == "__main__":
    main()

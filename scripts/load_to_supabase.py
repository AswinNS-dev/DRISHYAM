"""Push the DRISHYAM synthetic dataset to Supabase.

Works even when direct PostgreSQL ports (5432/6543) are firewall-blocked,
because it only uses HTTPS (443):
  1. DDL execution   -> Supabase Management API  /v1/projects/{ref}/database/query
  2. Data loading    -> Supabase REST (PostgREST) /rest/v1/{table}

Env vars:
  SUPABASE_ACCESS_TOKEN  personal access token (DDL)
  SUPABASE_SERVICE_KEY   service role JWT (data)
  SUPABASE_PROJECT_REF   project ref (default ktzzlqekrycezqtghhpt)

Usage:
  python scripts/load_to_supabase.py --schema           # DDL only
  python scripts/load_to_supabase.py --data             # CSV -> REST
  python scripts/load_to_supabase.py                    # schema + data
  python scripts/load_to_supabase.py --verify           # counts + integrity
  python scripts/load_to_supabase.py --truncate         # empty all tables first
"""

import argparse
import csv
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.request

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT_DIR, "data")
sys.path.insert(0, os.path.join(ROOT_DIR, "data_generator"))

REF = os.environ.get("SUPABASE_PROJECT_REF", "ktzzlqekrycezqtghhpt")
TOKEN = os.environ.get("SUPABASE_ACCESS_TOKEN", "")
SVC = os.environ.get("SUPABASE_SERVICE_KEY", "")
MGMT = f"https://api.supabase.com/v1/projects/{REF}"
REST = f"https://{REF}.supabase.co/rest/v1/"
CTX = ssl.create_default_context()

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

BATCH = 800


def mgmt_sql(query, max_tries=3):
    """Execute raw SQL via the Management API. Returns (ok, data)."""
    hdrs = {
        "Authorization": f"Bearer {TOKEN}",
        "User-Agent": "drishyam-loader/1.0",
        "Content-Type": "application/json",
    }
    body = json.dumps({"query": query}).encode()
    for attempt in range(max_tries):
        req = urllib.request.Request(f"{MGMT}/database/query", data=body,
                                     headers=hdrs, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=120, context=CTX) as r:
                return True, json.loads(r.read().decode("utf-8", "replace"))
        except urllib.error.HTTPError as e:
            err = e.read().decode("utf-8", "replace")[:500]
            if e.code >= 500 and attempt < max_tries - 1:
                time.sleep(3 * (attempt + 1))
                continue
            return False, err
        except Exception as exc:
            if attempt < max_tries - 1:
                time.sleep(3)
                continue
            return False, str(exc)[:300]


def rest_write(method, table, rows, max_tries=4):
    hdrs = {
        "apikey": SVC, "Authorization": f"Bearer {SVC}",
        "User-Agent": "drishyam-loader/1.0",
        "Content-Type": "application/json",
        "Prefer": "return=minimal,resolution=merge-duplicates",
    }
    data = json.dumps(rows).encode()
    for attempt in range(max_tries):
        req = urllib.request.Request(REST + table, data=data, headers=hdrs, method=method)
        try:
            with urllib.request.urlopen(req, timeout=120, context=CTX) as r:
                return True, r.status
        except urllib.error.HTTPError as e:
            err = e.read().decode("utf-8", "replace")[:400]
            if e.code in (429, 500, 502, 503, 504) and attempt < max_tries - 1:
                time.sleep(2 * (attempt + 1))
                continue
            return False, err
        except Exception as exc:
            if attempt < max_tries - 1:
                time.sleep(2)
                continue
            return False, str(exc)[:300]


def rest_count(table):
    hdrs = {
        "apikey": SVC, "Authorization": f"Bearer {SVC}",
        "User-Agent": "drishyam-loader/1.0", "Prefer": "count=exact",
        "Range": "0-0",
    }
    req = urllib.request.Request(f"{REST}{table}?select=*", headers=hdrs)
    try:
        with urllib.request.urlopen(req, timeout=60, context=CTX) as r:
            cr = r.headers.get("Content-Range", "")
            try:
                return int(cr.split("/")[-1])
            except (ValueError, IndexError):
                return -1
    except Exception:
        return -1


# --------------------------------------------------------------------------
# CSV parsing
# --------------------------------------------------------------------------
def load_csv_rows(table):
    path = os.path.join(DATA_DIR, f"{table}.csv")
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def coerce(table, cols_types, row):
    out = {}
    for k, v in row.items():
        if v == "" or v is None:
            out[k] = None
            continue
        t = cols_types.get(k, "text")
        if t == "jsonb":
            try:
                out[k] = json.loads(v)
            except (ValueError, TypeError):
                out[k] = v
        elif t in ("numeric", "double precision"):
            try:
                out[k] = float(v)
            except ValueError:
                out[k] = None
        elif t == "integer":
            try:
                out[k] = int(float(v))
            except ValueError:
                out[k] = None
        elif t == "boolean":
            out[k] = v.lower() in ("true", "t", "1")
        else:
            out[k] = v
    return out


def table_columns(table):
    ok, data = mgmt_sql(f"""
        select column_name, data_type from information_schema.columns
        where table_schema='public' and table_name='{table}'
        order by ordinal_position
    """)
    if not ok:
        return None
    return {c: t for c, t in data}


# --------------------------------------------------------------------------
# DDL
# --------------------------------------------------------------------------
def push_schema():
    from schema_sql import SCHEMA_DDL
    print("[1/2] Dropping legacy tables (old uuid-PK demo schema) ...")
    drops = ", ".join(f'"{t}"' for t in reversed(TABLE_ORDER))
    ok, res = mgmt_sql(f"DROP TABLE IF EXISTS {drops} CASCADE;")
    if not ok:
        print("DROP FAILED:", res)
        sys.exit(1)
    ok, res = mgmt_sql("""
        DROP VIEW IF EXISTS v_high_confidence_relationships CASCADE;
        DROP VIEW IF EXISTS v_open_cases CASCADE;
        DROP VIEW IF EXISTS v_network_summary CASCADE;
        DROP VIEW IF EXISTS v_dashboard_summary CASCADE;
    """)
    if not ok:
        print("VIEW DROP FAILED:", res)
        sys.exit(1)

    print("      Pushing schema DDL (text PKs, checks, views, RLS) ...")
    ok, data = mgmt_sql(SCHEMA_DDL)
    if not ok:
        print("SCHEMA FAILED:", data)
        sys.exit(1)
    ok, tables = mgmt_sql("""
        select table_name from information_schema.tables
        where table_schema='public' order by table_name
    """)
    names = [t["table_name"] for t in tables]
    print(f"      created {len(names)} public tables/views: {', '.join(names[:12])} ...")
    return names


def push_data(only=None):
    print("[2/2] Loading CSV data via REST ...")
    order = TABLE_ORDER if not only else [t for t in TABLE_ORDER if t in only]
    total = 0
    failures = []
    for table in order:
        rows = load_csv_rows(table)
        if not rows:
            print(f"  {table:24s} (no csv, skipped)")
            continue
        cols = table_columns(table)
        if cols is None:
            failures.append((table, "cannot introspect columns"))
            continue
        payload = [coerce(table, cols, r) for r in rows]
        inserted = 0
        for i in range(0, len(payload), BATCH):
            chunk = payload[i:i + BATCH]
            ok, res = rest_write("POST", table, chunk)
            if not ok:
                failures.append((table, f"batch {i // BATCH}: {res}"))
                break
            inserted += len(chunk)
        total += inserted
        flag = "" if inserted == len(payload) else "  <-- INCOMPLETE"
        print(f"  {table:24s} {inserted:>8,} rows{flag}")
    print(f"\nLoaded {total:,} rows total.")
    return failures


def truncate_all():
    print("Truncating all tables (restart identity, cascade) ...")
    tables_sql = ", ".join(TABLE_ORDER)
    ok, res = mgmt_sql(f"TRUNCATE TABLE {tables_sql} RESTART IDENTITY CASCADE;")
    print("      done." if ok else f"      FAILED: {res}")
    return ok


def verify():
    print("\n--- Verification (Supabase counts vs CSV) ---")
    failures = []
    for table in TABLE_ORDER:
        path = os.path.join(DATA_DIR, f"{table}.csv")
        expected = 0
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8", newline="") as f:
                expected = sum(1 for _ in f) - 1
        actual = rest_count(table)
        status = "OK" if actual >= expected >= 0 else ("?" if actual < 0 else "MISMATCH")
        if status == "MISMATCH":
            failures.append(table)
        print(f"  {table:24s} expected>={expected:>8,} actual={actual:>10,} {status}")

    print("\n--- Orphan checks (must all be 0) ---")
    checks = [
        ("orphan_firs", """select count(*) n from firs f
            left join crime_cases c on f.case_id=c.id
            where f.case_id is not null and c.id is null"""),
        ("orphan_phone_owners", """select count(*) n from phones p
            left join persons x on p.owner_person_id=x.id
            where p.owner_person_id is not null and x.id is null"""),
        ("orphan_rel_endpoints", """
            select count(*) n from relationships r
            where (r.source_entity_type='PERSON' and not exists(select 1 from persons p where p.id=r.source_entity_id))
               or (r.source_entity_type='PHONE' and not exists(select 1 from phones p where p.id=r.source_entity_id))
               or (r.source_entity_type='VEHICLE' and not exists(select 1 from vehicles v where v.id=r.source_entity_id))
               or (r.source_entity_type='BANK_ACCOUNT' and not exists(select 1 from financial_accounts a where a.id=r.source_entity_id))
               or (r.source_entity_type IN ('ORGANIZATION','GANG') and not exists(select 1 from organizations o where o.id=r.source_entity_id))
               or (r.source_entity_type='LOCATION' and not exists(select 1 from locations l where l.id=r.source_entity_id))
               or (r.source_entity_type='CASE' and not exists(select 1 from crime_cases c where c.id=r.source_entity_id))
               or (r.target_entity_type='PERSON' and not exists(select 1 from persons p where p.id=r.target_entity_id))
               or (r.target_entity_type='PHONE' and not exists(select 1 from phones p where p.id=r.target_entity_id))
               or (r.target_entity_type='VEHICLE' and not exists(select 1 from vehicles v where v.id=r.target_entity_id))
               or (r.target_entity_type='BANK_ACCOUNT' and not exists(select 1 from financial_accounts a where a.id=r.target_entity_id))
               or (r.target_entity_type IN ('ORGANIZATION','GANG') and not exists(select 1 from organizations o where o.id=r.target_entity_id))
               or (r.target_entity_type='LOCATION' and not exists(select 1 from locations l where l.id=r.target_entity_id))
               or (r.target_entity_type='CASE' and not exists(select 1 from crime_cases c where c.id=r.target_entity_id))"""),
        ("broken_evidence_links", """select count(*) n from relationships r
            left join evidence e on r.evidence_id=e.id
            where r.evidence_id is not null and e.id is null"""),
        ("anomaly_count", "select count(*) n from anomalies"),
        ("alert_count", "select count(*) n from alerts"),
        ("communities", "select count(distinct community_label) n from network_communities"),
        ("active_relationships", "select count(*) n from relationships where status='active'"),
    ]
    for label, q in checks:
        ok, data = mgmt_sql(q)
        if not ok:
            print(f"  {label:26s} ERROR: {data}")
            continue
        n = data[0]["n"] if data else 0
        flag = "OK" if (label.startswith("orphan") or "broken" in label) else f"present"
        if label.startswith(("orphan", "broken")) and n:
            failures.append(label)
        print(f"  {label:26s} {n:>8,} {flag}")
    return failures


def main():
    parser = argparse.ArgumentParser(description="Push DRISHYAM dataset to Supabase")
    parser.add_argument("--schema", action="store_true", help="push DDL only")
    parser.add_argument("--data", action="store_true", help="load CSVs only")
    parser.add_argument("--truncate", action="store_true", help="truncate all tables first")
    parser.add_argument("--verify", action="store_true", help="verify counts + integrity only")
    parser.add_argument("--only", action="append",
                        help="load only the named table(s); repeatable, e.g. --only crime_cases")
    parser.add_argument("--no-schema", action="store_true",
                        help="skip the drop+DDL step (use for data-only backfills)")
    args = parser.parse_args()

    failures = []
    if args.verify:
        failures = verify()
    elif args.truncate:
        truncate_all()
    else:
        if not TOKEN:
            print("Error: set SUPABASE_ACCESS_TOKEN")
            sys.exit(1)
        if not args.data and not args.no_schema:
            push_schema()
        if not args.schema:
            if not SVC:
                print("Error: set SUPABASE_SERVICE_KEY")
                sys.exit(1)
            failures = push_data(only=args.only) or []
            vfail = verify()
            failures += vfail

    if failures:
        print(f"\nFAILURES ({len(failures)}): {failures[:8]}")
        sys.exit(1)
    print("\n[DRISHYAM] Supabase push complete and verified.")


if __name__ == "__main__":
    main()

"""Supabase-backed data plane for DRISHYAM.

Supabase is the application's ONLY data source. Two transports:

1. Direct PostgreSQL (port 5432/6543) via SQLAlchemy - used whenever the
   network allows it (`settings.USING_SUPABASE`).
2. HTTPS replica (PostgREST on 443) - used when Postgres ports are firewalled.
   On startup the app hydrates the local replica database from the very same
   Supabase tables, then re-syncs on a background timer. Every write is also
   pushed to Supabase (`mirror_write`), so Supabase stays the source of truth.

No mock/sample data is ever produced here: every row served originates from
Supabase. Frontend/API contracts are unchanged.
"""

import datetime as dt
import json
import os
import threading
import time
import urllib.error
import urllib.request

from app.core.config import settings

HTTPS_REFRESH_SECONDS = int(os.getenv("SUPABASE_HTTPS_REFRESH_SECONDS", "300"))

# parent tables first (replica hydration order)
SYNC_TABLES = [
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

PAGE_SIZE = 1000


class SupabaseHTTPSClient:
    """Minimal PostgREST client over HTTPS (port 443, always reachable)."""

    def __init__(self, ref: str, service_key: str):
        self.base = f"https://{ref}.supabase.co/rest/v1/"
        self.key = service_key

    def _headers(self, extra=None):
        h = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "User-Agent": "drishyam-backend/1.0",
        }
        if extra:
            h.update(extra)
        return h

    def select_all(self, table, timeout=90):
        """Fetch every row of `table` (paginated)."""
        rows = []
        offset = 0
        while True:
            url = (f"{self.base}{table}?select=*"
                   f"&limit={PAGE_SIZE}&offset={offset}")
            req = urllib.request.Request(url, headers=self._headers())
            with urllib.request.urlopen(req, timeout=timeout) as r:
                page = json.loads(r.read().decode("utf-8"))
            rows.extend(page)
            if len(page) < PAGE_SIZE:
                return rows
            offset += PAGE_SIZE

    def select_count(self, table, timeout=60):
        url = f"{self.base}{table}?select=*"
        req = urllib.request.Request(
            url, headers=self._headers({"Prefer": "count=exact", "Range": "0-0"}))
        with urllib.request.urlopen(req, timeout=timeout) as r:
            cr = r.headers.get("Content-Range", "")
            try:
                return int(cr.split("/")[-1])
            except (ValueError, IndexError):
                return None

    def insert(self, table, rows, timeout=60):
        url = self.base + table
        data = json.dumps(rows).encode()
        req = urllib.request.Request(
            url, data=data, method="POST",
            headers=self._headers({"Content-Type": "application/json",
                                   "Prefer": "return=minimal"}))
        with urllib.request.urlopen(req, timeout=timeout):
            return True


def _ref() -> str:
    ref = (settings.SUPABASE_URL or "").replace("https://", "").replace("http://", "")
    ref = ref.split(".")[0] if ref else ""
    if ref:
        return ref
    key = settings.SUPABASE_SERVICE_KEY or ""
    if key.count(".") == 2:
        try:
            import base64
            payload = key.split(".")[1]
            payload += "=" * (-len(payload) % 4)
            return json.loads(base64.urlsafe_b64decode(payload)).get("ref", "")
        except Exception:
            return ""
    return ""


class SupabaseReplica:
    """Keeps the local replica database in sync with Supabase over HTTPS."""

    def __init__(self):
        self.ref = _ref()
        self.client = None
        if self.ref and settings.SUPABASE_SERVICE_KEY:
            self.client = SupabaseHTTPSClient(self.ref, settings.SUPABASE_SERVICE_KEY)
        self.last_sync = None
        self.last_error = None
        self.row_counts = {}
        self._timer = None
        self._engine = None
        self._lock = threading.Lock()

    @property
    def available(self) -> bool:
        return self.client is not None

    # -- hydration ---------------------------------------------------------
    def _model_map(self):
        from app.models import models as m
        return {
            "users": m.User, "officers": m.Officer, "persons": m.Person,
            "aliases": m.Alias, "victims": m.Victim,
            "organizations": m.Organization, "gangs": m.Gang,
            "locations": m.Location, "phones": m.Phone,
            "vehicles": m.Vehicle,
            "financial_accounts": m.FinancialAccount,
            "crime_cases": m.CrimeCase, "firs": m.FIR,
            "investigation_notes": m.InvestigationNote,
            "evidence": m.Evidence, "evidence_metadata": m.EvidenceMetadata,
            "chain_of_custody": m.ChainOfCustody,
            "surveillance_records": m.SurveillanceRecord,
            "cdr_records": m.CDRRecord, "transactions": m.Transaction,
            "entity_mentions": m.EntityMention,
            "entity_matches": m.EntityMatch,
            "relationships": m.RelationshipRecord,
            "network_analysis": m.NetworkAnalysis,
            "network_communities": m.NetworkCommunity,
            "network_events": m.NetworkEvent, "anomalies": m.Anomaly,
            "intelligence_leads": m.IntelligenceLead,
            "intelligence_reports": m.IntelligenceReport,
            "notifications": m.Notification, "alerts": m.Alert,
            "reports": m.Report, "audit_logs": m.AuditLog,
            "import_jobs": m.ImportJob, "model_metadata": m.ModelMetadata,
        }

    _DATE_FIELDS = {
        "created_at", "updated_at", "opened_at", "filed_at", "txn_date",
        "call_time", "observed_at", "occurred_at", "reviewed_at",
        "last_seen_at", "first_seen_at", "computed_at",
    }
    _FLOAT_FIELDS = {
        "amount", "confidence", "confidence_score", "match_score",
        "degree_centrality", "betweenness_centrality", "pagerank",
        "latitude", "longitude",
    }
    _INT_FIELDS = {
        "evidence_count", "span_start", "span_end", "duration_seconds",
        "entities_extracted", "relationships_created", "community_label",
    }
    _BOOL_FIELDS = {"is_active", "is_read", "is_demo_model"}
    _JSON_FIELDS = {
        "supporting_evidence", "related_entities", "details", "features",
        "evaluation_metrics", "content_json", "affected_entities",
        "supporting_records",
    }

    def _coerce(self, table, row):
        from app.models import models as m
        model = self._model_map()[table]
        cols = {c.name for c in model.__table__.columns}
        clean = {}
        for k, v in row.items():
            if k not in cols:
                continue
            if v is None:
                clean[k] = None
            elif k in self._JSON_FIELDS:
                clean[k] = v if isinstance(v, (list, dict)) else (
                    json.loads(v) if isinstance(v, str) and v else v)
            elif k in self._BOOL_FIELDS:
                clean[k] = bool(v)
            elif k in self._INT_FIELDS:
                try:
                    clean[k] = int(v)
                except (TypeError, ValueError):
                    clean[k] = None
            elif k in self._FLOAT_FIELDS:
                try:
                    clean[k] = float(v)
                except (TypeError, ValueError):
                    clean[k] = None
            elif k in self._DATE_FIELDS:
                if isinstance(v, str):
                    try:
                        clean[k] = dt.datetime.fromisoformat(
                            v.replace("Z", "+00:00")).replace(tzinfo=None)
                    except ValueError:
                        clean[k] = None
                else:
                    clean[k] = v
            else:
                clean[k] = v
        return model(**clean)

    def sync_table(self, db, table):
        model = self._model_map()[table]
        rows = self.client.select_all(table)
        db.query(model).delete()
        objs = [self._coerce(table, r) for r in rows]
        if objs:
            db.bulk_save_objects(objs)
        db.commit()
        return len(objs)

    def sync_all(self, engine):
        if not self.available or self._lock.locked():
            return False
        with self._lock:
            started = time.time()
            try:
                from app.database.db import SessionLocal
                db = SessionLocal()
                counts = {}
                try:
                    for table in SYNC_TABLES:
                        counts[table] = self.sync_table(db, table)
                finally:
                    db.close()
                self.row_counts = counts
                self.last_sync = dt.datetime.utcnow()
                self.last_error = None
                total = sum(counts.values())
                print(f"[DRISHYAM][supabase-replica] synced {total:,} rows "
                      f"from Supabase in {time.time() - started:.1f}s")
                return True
            except Exception as exc:
                self.last_error = str(exc)[:300]
                print(f"[DRISHYAM][supabase-replica] sync FAILED: {self.last_error}")
                return False

    def start_refresh_loop(self, engine, interval=HTTPS_REFRESH_SECONDS):
        self._engine = engine
        if not self.available:
            return

        def _run():
            self.sync_all(engine)
            self._timer = threading.Timer(interval, _run)
            self._timer.daemon = True
            self._timer.start()

        self._timer = threading.Timer(interval, _run)
        self._timer.daemon = True
        self._timer.start()

    # -- write mirroring ---------------------------------------------------
    def push_write(self, table: str, row: dict):
        """Push one locally-written row up to Supabase (best effort)."""
        if not self.available:
            return False
        try:
            payload = {}
            for k, v in row.items():
                if k.startswith("_"):
                    continue
                if isinstance(v, dt.datetime):
                    payload[k] = v.isoformat() + "Z"
                elif isinstance(v, (list, dict)):
                    payload[k] = json.dumps(v)
                elif isinstance(v, dt.date):
                    payload[k] = v.isoformat()
                else:
                    payload[k] = v
            self.client.insert(table, [payload])
            return True
        except Exception as exc:
            print(f"[DRISHYAM][supabase-replica] write mirror to {table} "
                  f"failed: {str(exc)[:160]}")
            return False

    def status(self):
        mode = "supabase-direct"
        if settings.USING_SUPABASE:
            mode = "supabase-direct"
        elif self.available:
            mode = "supabase-https-replica"
        else:
            mode = "no-supabase-connection"
        return {
            "mode": mode,
            "data_source": "supabase" if mode != "no-supabase-connection" else "none",
            "project_ref": self.ref,
            "last_sync": self.last_sync.isoformat() + "Z" if self.last_sync else None,
            "last_error": self.last_error,
            "row_counts": self.row_counts,
            "refresh_seconds": HTTPS_REFRESH_SECONDS,
        }


supabase_replica = SupabaseReplica()


def mirror_write(table: str, model_obj):
    """After a local commit in replica mode, push the row to Supabase."""
    try:
        row = {
            c: getattr(model_obj, c)
            for c in model_obj.__table__.columns.keys()
            if hasattr(model_obj, c)
        }
        supabase_replica.push_write(table, row)
    except Exception:
        pass

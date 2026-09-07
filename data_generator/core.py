"""Shared runtime state for the generator: seeded RNG, ID allocation, and the
in-memory master dataset that every generator module appends to.

The master dataset (`DATA`) is a dict keyed by table name holding lists of plain
dict rows whose keys mirror the SQLAlchemy columns in
`backend/app/models/models.py`. That keeps generation fully decoupled from the
DB layer: exporters/loaders/validators all consume the same structure.
"""

import random
from datetime import datetime, timedelta

import config

rng: random.Random = None
faker = None

# master dataset: {"persons": [...], "relationships": [...], ...}
DATA = {}


def init(seed: int = config.SEED) -> None:
    global rng, faker
    rng = random.Random(seed)
    from faker import Faker

    faker = Faker("en_IN")
    Faker.seed(seed)
    random.seed(seed)
    for table in TABLE_ORDER:
        DATA[table] = []
    _counters.clear()


# --------------------------------------------------------------------------
# per-table output ordering (loads/foreign keys respect this order)
# --------------------------------------------------------------------------
TABLE_ORDER = [
    "users",
    "officers",
    "persons",
    "aliases",
    "victims",
    "organizations",
    "gangs",
    "locations",
    "phones",
    "vehicles",
    "financial_accounts",
    "crime_cases",
    "firs",
    "investigation_notes",
    "evidence",
    "evidence_metadata",
    "chain_of_custody",
    "surveillance_records",
    "cdr_records",
    "transactions",
    "entity_mentions",
    "entity_matches",
    "relationships",
    "network_analysis",
    "network_communities",
    "network_events",
    "anomalies",
    "intelligence_leads",
    "intelligence_reports",
    "notifications",
    "alerts",
    "reports",
    "audit_logs",
    "import_jobs",
    "model_metadata",
]

# Counter state (reset in init())
_counters = {}


def next_id(prefix: str) -> str:
    assert prefix.isalnum() and prefix.isupper(), "ID prefixes must be upper-alnum"
    count = _counters.get(prefix, 0) + 1
    _counters[prefix] = count
    return f"{prefix}{count:06d}"


# --------------------------------------------------------------------------
# helpers shared across modules
# --------------------------------------------------------------------------
def add_row(table: str, row: dict) -> None:
    DATA.setdefault(table, []).append(row)


def now_utc() -> datetime:
    return datetime.utcnow()


def iso(dt: datetime) -> str:
    return dt.isoformat() + "Z" if dt is not None else None


def parse_iso(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00")).replace(tzinfo=None)


def weighted_choice(options, weights):
    return rng.choices(options, weights=weights, k=1)[0]
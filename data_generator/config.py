"""Global configuration for the DRISHYAM synthetic data generator.

Every volume/likelihood knob lives here. Two presets are provided:

* ``demo`` (default)  - compact, fast dataset committed to the repository
  (``database/drishyam_complete.sql`` + ``data/*.csv``). Comfortably renders
  every frontend page and keeps the per-request NetworkX algorithms snappy.
* ``full``            - the large operational-scale dataset
  (DRISHYAM_PRESET=full python scripts/generate_synthetic_data.py).

Reproducibility: ``SEED`` fixes the random state. Re-running with the same
seed (pinned Faker + Python stdlib random) yields identical output.
"""

import os

# --------------------------------------------------------------------------
# Reproducibility
# --------------------------------------------------------------------------
SEED = 26189

# --------------------------------------------------------------------------
# Temporal window. Everything is generated inside this range and kept
# chronologically consistent (incident -> FIR -> case -> transfers/calls).
# --------------------------------------------------------------------------
EPOCH_START = "2024-01-01"   # first possible incident
EPOCH_END = "2026-08-31"     # last possible record (fixed for determinism)

# --------------------------------------------------------------------------
# Dataset volumes
# --------------------------------------------------------------------------
_DEMO = dict(
    NUM_PERSONS=600,
    NUM_GANGS=12,
    NUM_ORG_FRONTS=12,
    NUM_LOCATIONS=60,
    NUM_PHONES=650,
    NUM_VEHICLES=480,
    NUM_ACCOUNTS=620,
    NUM_ALIASES=700,
    NUM_CASES=90,
    NUM_FIRS=110,
    NUM_TRANSACTIONS=2600,
    NUM_CALL_RECORDS=3200,
    NUM_SURVEILLANCE=1400,
    NUM_INVESTIGATION_NOTES=180,
    NUM_EVIDENCE=340,
    NUM_FIN_GRAPH_EDGES=260,
    NUM_MATCHES=60,
    NUM_ANOMALIES_TARGET=24,
    NUM_ALERTS=18,
    NUM_AUDIT_LOGS=240,
    NUM_IMPORT_JOBS=8,
    NUM_INTELLIGENCE_REPORTS=12,
)

# Section-25 "full synthetic dataset" scale.
_FULL = dict(
    NUM_PERSONS=15000,
    NUM_GANGS=40,
    NUM_ORG_FRONTS=40,
    NUM_LOCATIONS=300,
    NUM_PHONES=7000,
    NUM_VEHICLES=6000,
    NUM_ACCOUNTS=6000,
    NUM_ALIASES=5000,
    NUM_CASES=1500,
    NUM_FIRS=1900,
    NUM_TRANSACTIONS=40000,
    NUM_CALL_RECORDS=75000,
    NUM_SURVEILLANCE=25000,
    NUM_INVESTIGATION_NOTES=3000,
    NUM_EVIDENCE=2000,
    NUM_FIN_GRAPH_EDGES=4000,
    NUM_MATCHES=1200,
    NUM_ANOMALIES_TARGET=150,
    NUM_ALERTS=90,
    NUM_AUDIT_LOGS=4000,
    NUM_IMPORT_JOBS=14,
    NUM_INTELLIGENCE_REPORTS=40,
)

PRESET = os.environ.get("DRISHYAM_PRESET", "demo").strip().lower()
if PRESET == "full":
    _volumes = _FULL
else:
    _volumes = _DEMO

for _k, _v in _volumes.items():
    globals()[_k] = _v

# --------------------------------------------------------------------------
# Graph-edge split. The backend loads only `status == "active"` relationships
# into the NetworkX graph (graph_data.load_all_edges), while the
# communications/timeline pages read ALL comm relationships regardless of
# status. So: bulk routine CDR is stored as `archived` (visible in feeds,
# excluded from the graph); investigatively meaningful links are `active`.
# --------------------------------------------------------------------------
CALL_RECORDS_ACTIVE_RATIO = 0.20   # notable calls become active graph edges

# --------------------------------------------------------------------------
# Tuning / structural ratios
# --------------------------------------------------------------------------
CRIMINAL_RATIO = 0.30
ASSOCIATE_RATIO = 0.40
VICTIM_RATIO = 0.18
WITNESS_RATIO = 0.12

GANG_MIN_SIZE = 4
GANG_MAX_SIZE = 34

NUM_ASSOCIATES_AS_MEMBERS = 160 if PRESET != "full" else 1400
NUM_ORG_EMPLOYEES = 40 if PRESET != "full" else 400

NUM_HIDDEN_CHAINS = 12 if PRESET != "full" else 25   # 5/6-hop cross-evidence chains
CHAIN_MIN_HOPS = 5
NUM_EXPANSION_ANOMALIES = 10 if PRESET != "full" else 40
NUM_RAPID_VEHICLE_EVENTS = 14 if PRESET != "full" else 60
NUM_UNUSUAL_HOUR_CALLERS = 8 if PRESET != "full" else 30

# --------------------------------------------------------------------------
# Data-source flag. Every generated row is tagged as clearly synthetic.
# --------------------------------------------------------------------------
DATA_SOURCE = "SYNTHETIC"

# --------------------------------------------------------------------------
# Paths
# --------------------------------------------------------------------------
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.path.join(ROOT_DIR, "generated_data")
BACKEND_REQUIREMENTS_PATH = os.path.join(ROOT_DIR, "backend", "requirements.txt")

DEFAULT_DB_URI = os.environ.get(
    "DRISHYAM_DB_URI",
    "sqlite:///" + os.path.join(ROOT_DIR, "backend", "drishyam_local.db").replace("\\", "/"),
)

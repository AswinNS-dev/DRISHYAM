"""CDR call-record generator.

Calls are stored as COMMUNICATED_WITH relationship rows (the app's
communications/timeline pages read exactly that), with:

* realistic intra/cross-gang + bridge/victim traffic distribution,
* concentrated *burst* windows around case incidents for specific hub callers
  (this is what the anomaly detector later derives COMMUNICATION_BURST from),
* a dedicated CDR-batch evidence row per quarter so calls carry evidence ids
  without exploding the evidence ledger,
* ~CALL_RECORDS_ACTIVE_RATIO of rows marked `active` (notable calls that enter
  the NetworkX graph); the rest stay `archived` but fully queryable in feeds.
"""

from datetime import timedelta

import config
import core
from entities import _rand_datetime
from relationships import add_rel


CDR_BATCHES = []


def _make_cdr_batches():
    from datetime import datetime
    for year in ("2024", "2025", "2026"):
        for q, month in (("Q1", 3), ("Q2", 6), ("Q3", 9), ("Q4", 12)):
            row = {
                "id": core.next_id("EV"),
                "evidence_type": "CDR",
                "source_record_id": f"CDR-BATCH-{year}-{q}",
                "description": f"Bulk CDR pull {year} {q} (synthetic demo)",
                "storage_path": f"/secure_vault/synthetic/cdr/batch-{year}-{q}.enc",
                "confidence": 0.85,
                "data_source": config.DATA_SOURCE,
                "created_at": datetime(int(year), month, 28, 18, 0, 0),
            }
            core.add_row("evidence", row)
            CDR_BATCHES.append(row)
    return CDR_BATCHES


def _caller_pool(ctx):
    """person_id -> weight used when picking callers."""
    persons = ctx["persons"]["persons"]
    assigned = ctx["persons"]["assigned"]
    pool = {}
    for p in persons:
        w = 0.3
        if p["person_role"] == "criminal":
            w = 1.0 if p["risk_band"] == "high" else 0.7
            if p["id"] in assigned and assigned[p["id"]][1] == "coordinator":
                w = 3.0
        elif p["person_role"] == "associate":
            w = 0.5
        elif p["person_role"] in ("victim", "witness"):
            w = 0.15
        pool[p["id"]] = w
    return pool


def _partner(ctx, caller_id, caller_role, callers):
    """Pick a realistic conversation partner for a caller."""
    rng = core.rng
    assigned = ctx["persons"]["assigned"]
    persons_by_id = ctx["persons"]["persons_by_id"]
    if caller_role == "criminal":
        gid = assigned[caller_id][0] if caller_id in assigned else None
        if gid and rng.random() < 0.7:
            mates = [pid for pid, (g, _r) in assigned.items() if g == gid and pid != caller_id]
            if mates:
                return rng.choice(mates)
        others = [pid for pid in callers if pid != caller_id
                  and persons_by_id[pid]["person_role"] != "victim"]
        if others:
            return rng.choice(others)
    if caller_role == "associate":
        members = [pid for pid, (g, _r) in assigned.items()]
        if members and rng.random() < 0.7:
            return rng.choice(members)
    pool = [pid for pid in callers if pid != caller_id]
    return rng.choice(pool) if pool else None


def generate(ctx):
    rng = core.rng
    _make_cdr_batches()
    callers = _caller_pool(ctx)
    persons_by_id = ctx["persons"]["persons_by_id"]
    assigned = ctx["persons"]["assigned"]

    # burst hubs: coordinators/financiers/gang members with cases near them
    hub_ids = [pid for pid, w in sorted(callers.items(), key=lambda kv: -kv[1])[:60]]
    hub_ids = hub_ids[: 40]

    records = []
    seq = 0
    burst_slots = [0.0] * len(hub_ids)

    def _burst_window(hub_idx):
        t0 = _rand_datetime()
        start = t0 - timedelta(days=10)
        end = t0 + timedelta(days=20)
        slot = int((t0.month + 12 * (t0.year - 2024)) % 40)
        burst_slots[hub_idx] = slot
        return start, end

    target = config.NUM_CALL_RECORDS
    while len(records) < target:
        # 16% of calls live inside burst windows of hub callers
        burst = len(records) % 6 == 0
        if burst and hub_ids:
            hub = rng.choice(hub_ids)
            hub_idx = hub_ids.index(hub)
            start, end = _burst_window(hub_idx)
            call_time = start + timedelta(seconds=rng.randint(0, int((end - start).total_seconds())))
            partner = _partner(ctx, hub, persons_by_id[hub]["person_role"], list(callers))
            if partner is None:
                continue
            caller_id, caller_role = hub, persons_by_id[hub]["person_role"]
        else:
            call_time = _rand_datetime()
            keys = list(callers)
            caller_id = rng.choices(keys, [callers[k] for k in keys])[0]
            caller_role = persons_by_id[caller_id]["person_role"]
            partner = _partner(ctx, caller_id, caller_role, keys)
            if partner is None:
                continue

        caller_risk = persons_by_id[caller_id]["risk_band"]
        partner_risk = persons_by_id[partner]["risk_band"]
        is_notable = (caller_risk == "high" or partner_risk == "high"
                      or (caller_id in assigned and assigned[caller_id][1] == "coordinator"))
        active = is_notable or rng.random() < config.CALL_RECORDS_ACTIVE_RATIO

        seq += 1
        ymd = call_time.strftime("%Y%m%d")
        src_id = f"CDR-{ymd}-{seq:06d}"
        batch = CDR_BATCHES[rng.randrange(len(CDR_BATCHES))]
        records.append(add_rel(
            caller_id, "PERSON", partner, "PERSON", "COMMUNICATED_WITH",
            confidence=round(rng.uniform(0.75, 0.98), 2),
            first_seen=call_time, last_seen=call_time + timedelta(seconds=rng.randint(30, 900)),
            source_record_id=src_id, source_record_type="CDR",
            evidence_id=batch["id"],
            status="active" if active else "archived",
        ))

    ctx["_call_bursts"] = {"hubs": hub_ids, "records": len(records),
                           "active": sum(1 for r in records if r["status"] == "active")}
    return ctx
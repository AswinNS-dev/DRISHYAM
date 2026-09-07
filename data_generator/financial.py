"""Financial transactions generator.

Writes detailed rows to the `transactions` table (consumed by the timeline +
transactions pages) and mirrors a *curated subset* of suspicious flows as
active FINANCIAL_TRANSFER relationship edges so the money movement over
layering chains is visible in the NetworkX graph without flooding it.

Three archetypes:
1. routine flow  - day-to-day transfers between tracked persons' accounts,
2. laundering    - regular round-number sweeps from gang financiers into
                   front-company accounts (layered through an intermediary),
3. burst cluster - many rapid same-day transfers into/out of a few hub
                   accounts (feeds the derived FINANCIAL_BURST anomalies).
"""

import datetime as dt
from datetime import timedelta

import config
import core
from entities import _rand_datetime
from relationships import add_rel


def _amount(rng, lo, hi, round_to=None):
    a = rng.uniform(lo, hi)
    if round_to:
        a = round(a / round_to) * round_to
    return round(a, 2)


def generate(ctx):
    rng = core.rng
    accounts = ctx["accounts"]["accounts"]
    persons_by_id = ctx["persons"]["persons_by_id"]
    assigned = ctx["persons"]["assigned"]

    owned = [ac for ac in accounts if ac["owner_person_id"]]
    unowned = [ac for ac in accounts if not ac["owner_person_id"]]

    rows = []
    seen_fin_edges = set()

    def txn_row(frm, to, amount, when):
        rows.append({
            "id": core.next_id("TX"),
            "from_account_id": frm,
            "to_account_id": to,
            "amount": amount,
            "txn_date": when,
            "data_source": config.DATA_SOURCE,
            "created_at": core.now_utc(),
        })

    def fin_edge(frm_id, to_id, when, amount, conf):
        k = tuple(sorted((frm_id, to_id)))
        if k in seen_fin_edges:
            return
        if len(seen_fin_edges) >= config.NUM_FIN_GRAPH_EDGES:
            return
        seen_fin_edges.add(k)
        add_rel(frm_id, "BANK_ACCOUNT", to_id, "BANK_ACCOUNT",
                "FINANCIAL_TRANSFER", confidence=conf,
                first_seen=when, last_seen=when,
                source_record_type="FINANCIAL")

    budget = config.NUM_TRANSACTIONS
    if not owned or not unowned:
        return ctx

    # --- laundering archetype ---------------------------------------------
    financers = set()
    for pid, (gid, role) in assigned.items():
        if role == "financier":
            financers.add(pid)
    fin_accts = [ac for ac in owned if ac["owner_person_id"] in financers]
    mid_accts = [ac for ac in owned if ac["owner_person_id"] not in financers]
    rng.shuffle(mid_accts)

    launder_target = int(budget * 0.25)
    for fac in fin_accts[:200]:
        if launder_target <= 0:
            break
        if not mid_accts or not unowned:
            continue
        mid = rng.choice(mid_accts)
        sink = rng.choice(unowned)
        months = rng.randint(8, 18)
        month_dates = sorted(_rand_datetime() for _ in range(months))
        for when in month_dates:
            if launder_target <= 0:
                break
            amt = _amount(rng, 400000, 3000000, round_to=100000)
            if rng.random() < 0.4:
                # layer through an intermediary
                txn_row(fac["id"], mid["id"], amt, when)
                txn_row(mid["id"], sink["id"], round(amt * 0.92), when)
                launder_target -= 2
            else:
                txn_row(fac["id"], sink["id"], amt, when)
                launder_target -= 1
            fin_edge(fac["id"], sink["id"], when, amt, rng.uniform(0.8, 0.95))

    # --- burst-cluster archetype ------------------------------------------
    burst_target = int(budget * 0.20)
    hub_accounts = [ac for ac in fin_accts[:120]] or owned[:40]
    for hub in hub_accounts[:20]:
        if burst_target <= 0:
            break
        day = _rand_datetime()
        n_chunks = rng.randint(25, 90)
        others = [ac for ac in owned if ac["id"] != hub["id"]]
        for _ in range(min(n_chunks, burst_target)):
            side = rng.choice(others) if others else hub
            if rng.random() < 0.5:
                frm, to = side["id"], hub["id"]
            else:
                frm, to = hub["id"], side["id"]
            when = day + timedelta(seconds=rng.randint(0, 90 * 3600))
            txn_row(frm, to, _amount(rng, 100000, 2000000, round_to=50000), when)
            burst_target -= 1
            fin_edge(frm, to, when, 0, rng.uniform(0.7, 0.9))

    # --- routine archetype -------------------------------------------------
    made = len(rows)
    remaining = max(0, budget - made)
    for _ in range(remaining):
        a = rng.choice(owned)
        b = rng.choice(owned)
        if a["id"] == b["id"]:
            b = rng.choice(owned)
        amt = _amount(rng, 5000, 500000)
        when = _rand_datetime()
        txn_row(a["id"], b["id"], amt, when)

    graph_edges_made = len(seen_fin_edges)
    for r in rows:
        core.add_row("transactions", r)

    ctx["_financial"] = {
        "transactions": len(rows),
        "graph_edges": graph_edges_made,
    }
    return ctx
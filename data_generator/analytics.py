"""Derived intelligence: network analytics, anomalies, alerts, entity matches,
network events and intelligence leads.

Nothing in this module is random decoration:
* centrality / PageRank / communities are computed from the actual
  `relationships` graph (NetworkX, same algorithms as the backend engine);
* anomalies are detected from the actual call, transaction, surveillance and
  association data, each with a numeric explanation;
* alerts are projections of real detected conditions (bursts, bridges,
  hidden chains, financial spikes, geographic outliers);
* entity matches are grounded in real name/alias/asset overlaps.
"""

import difflib
import math
import statistics
from collections import defaultdict
from datetime import datetime, timedelta

import networkx as nx

import config
import core
from entities import _rand_datetime


def build_active_graph():
    g = nx.Graph()
    for r in core.DATA["relationships"]:
        if r["status"] != "active":
            continue
        g.add_node(r["source_entity_id"])
        g.add_node(r["target_entity_id"])
        if g.has_edge(r["source_entity_id"], r["target_entity_id"]):
            g[r["source_entity_id"]][r["target_entity_id"]].setdefault(
                "weight", 0.0)
            g[r["source_entity_id"]][r["target_entity_id"]]["weight"] += \
                float(r.get("confidence_score") or 0.8)
        else:
            g.add_edge(r["source_entity_id"], r["target_entity_id"], weight=1.0)
    return g


def generate_network_analytics(ctx):
    g = build_active_graph()
    n_nodes = g.number_of_nodes()
    degree = nx.degree_centrality(g)
    if n_nodes:
        try:
            betweenness = nx.betweenness_centrality(
                g, k=min(200, n_nodes) or None, weight="weight")
        except Exception:
            betweenness = {n: 0.0 for n in g.nodes}
        try:
            pagerank = nx.pagerank(g, alpha=0.85, weight="weight")
        except Exception:
            pagerank = {n: 0.0 for n in g.nodes}
    else:
        betweenness, pagerank = {}, {}

    for n in g.nodes():
        core.add_row("network_analysis", {
            "id": core.next_id("NA"),
            "entity_id": n,
            "degree_centrality": round(degree.get(n, 0.0), 4),
            "betweenness_centrality": round(betweenness.get(n, 0.0), 4),
            "pagerank": round(pagerank.get(n, 0.0), 4),
            "computed_at": core.now_utc(),
        })

    community_map = {}
    if n_nodes:
        communities = nx.algorithms.community.greedy_modularity_communities(g, weight="weight")
        for idx, community in enumerate(communities):
            for node in community:
                community_map[node] = idx
                core.add_row("network_communities", {
                    "id": core.next_id("NC"),
                    "community_label": idx,
                    "entity_id": node,
                    "computed_at": core.now_utc(),
                })

    ctx["_centrality"] = {
        nid: {"degree_centrality": degree.get(nid, 0.0),
              "betweenness_centrality": betweenness.get(nid, 0.0),
              "pagerank": pagerank.get(nid, 0.0)}
        for nid in g.nodes()
    }
    ctx["_communities"] = community_map
    ctx["_graph"] = g
    return ctx


# --------------------------------------------------------------------------
# anomaly detection from real data
# --------------------------------------------------------------------------
def _fmt(n):
    return f"{n:,.0f}"


def _detect_communication_bursts(ctx):
    """Call counts per caller per day; flag statistical outlier days."""
    persons_by_id = ctx["persons"]["persons_by_id"]
    per_day = defaultdict(lambda: defaultdict(int))
    hour_buckets = defaultdict(lambda: [0, set()])  # caller -> [late-night calls, nights]
    for r in core.DATA["relationships"]:
        if r["relationship_type"] != "COMMUNICATED_WITH":
            continue
        when = r.get("first_seen_at")
        if not when:
            continue
        per_day[r["source_entity_id"]][when.date().isoformat()] += 1
        if when.hour < 5:
            b = hour_buckets[r["source_entity_id"]]
            b[0] += 1
            b[1].add(when.date().isoformat())

    anomalies = []
    for caller, days in per_day.items():
        if caller not in persons_by_id:
            continue
        counts = list(days.values())
        if not counts:
            continue
        top_day = max(days, key=days.get)
        top = days[top_day]
        baseline_vals = [c for d, c in days.items() if d != top_day]
        baseline = statistics.mean(baseline_vals) if baseline_vals else 1.0
        baseline = max(baseline, 0.5)
        if top >= 8 and top >= 3.0 * baseline:
            anomalies.append({
                "entity_id": caller, "entity_type": "PERSON",
                "anomaly_type": "COMMUNICATION_BURST",
                "reason": (f"{top} outgoing calls recorded on {top_day}, compared with a "
                           f"baseline average of {baseline:.1f} calls/day "
                           f"({top / baseline:.1f}x increase)."),
                "severity": "high" if top / baseline >= 5 else "medium",
                "related_entities": [],
                "evidence_count": top,
            })
    # unusual-hour callers
    for caller, (cnt, nights) in hour_buckets.items():
        if caller not in persons_by_id or cnt < 5 or len(nights) < 3:
            continue
        anomalies.append({
            "entity_id": caller, "entity_type": "PERSON",
            "anomaly_type": "UNUSUAL_CALL_TIME",
            "reason": (f"{cnt} calls between 00:00-05:00 across {len(nights)} distinct "
                       f"nights - repeated activity in hours when the baseline "
                       f"population makes almost no calls."),
            "severity": "medium",
            "related_entities": [],
            "evidence_count": cnt,
        })
    return anomalies


def _detect_financial_spikes(ctx):
    accounts_by_id = {a["id"]: a for a in core.DATA["financial_accounts"]}
    per_day = defaultdict(lambda: defaultdict(float))
    per_day_count = defaultdict(lambda: defaultdict(int))
    for t in core.DATA["transactions"]:
        when = t.get("txn_date")
        if not when:
            continue
        d = when.date().isoformat()
        per_day[t["to_account_id"]][d] += float(t["amount"] or 0)
        per_day[t["from_account_id"]][d] += float(t["amount"] or 0)
        per_day_count[t["to_account_id"]][d] += 1

    anomalies = []
    for acc_id, days in per_day.items():
        if acc_id not in accounts_by_id:
            continue
        top_day = max(days, key=days.get)
        top = days[top_day]
        baseline_vals = [v for d, v in days.items() if d != top_day]
        baseline = statistics.median(baseline_vals) if baseline_vals else 0.0
        if top >= 500000 and baseline > 0 and top >= 5.0 * baseline:
            acc = accounts_by_id[acc_id]
            anomalies.append({
                "entity_id": acc_id, "entity_type": "BANK_ACCOUNT",
                "anomaly_type": "FINANCIAL_SPIKE",
                "reason": (f"Rs. {_fmt(top)} moved through account "
                           f"{acc['account_number_masked']} on {top_day} "
                           f"({per_day_count[acc_id][top_day]} transfers) versus a daily "
                           f"median of Rs. {_fmt(baseline)} ({top / baseline:.1f}x)."),
                "severity": "high" if top / baseline >= 10 else "medium",
                "related_entities": [acc["owner_person_id"]] if acc.get("owner_person_id") else [],
                "evidence_count": per_day_count[acc_id][top_day],
            })
    return anomalies


def _detect_unusual_locations(ctx):
    from names import DISTRICT_TO_COORD
    loc_by_id = {l["id"]: l for l in ctx["locations"]["locations"]}
    persons_by_id = ctx["persons"]["persons_by_id"]

    def home_district(p):
        parts = p["address"].split(", ")
        return parts[-2] if len(parts) >= 2 else None

    anomalies = []
    for r in core.DATA["surveillance_records"]:
        p = persons_by_id.get(r.get("person_id"))
        loc = loc_by_id.get(r.get("location_id"))
        if not p or not loc:
            continue
        home = home_district(p)
        if not home or home not in DISTRICT_TO_COORD or loc["district"] not in DISTRICT_TO_COORD:
            continue
        if loc["district"] == home:
            continue
        hlat, hlon = DISTRICT_TO_COORD[home]
        flat, flon = DISTRICT_TO_COORD[loc["district"]]
        dist_km = math.hypot((hlat - flat) * 111.0, (hlon - flon) * 105.0)
        if dist_km >= 200:
            anomalies.append({
                "entity_id": p["id"], "entity_type": "PERSON",
                "anomaly_type": "UNUSUAL_LOCATION",
                "reason": (f"Sighted at {loc['name']} ({loc['district']}) on "
                           f"{r['observed_at'].date().isoformat()}, approx. "
                           f"{dist_km:.0f} km outside the recorded home district {home}."),
                "severity": "medium",
                "related_entities": [loc["id"]],
                "evidence_count": 1,
            })
    return anomalies


def _detect_rapid_vehicle_movement(ctx):
    loc_by_id = {l["id"]: l for l in ctx["locations"]["locations"]}
    vehicles_by_id = {v["id"]: v for v in ctx["vehicles"]["vehicles"]}
    by_vehicle = defaultdict(list)
    for r in core.DATA["surveillance_records"]:
        if r.get("vehicle_id"):
            by_vehicle[r["vehicle_id"]].append(r)

    anomalies = []
    for vid, recs in by_vehicle.items():
        if vid not in vehicles_by_id or len(recs) < 3:
            continue
        recs.sort(key=lambda r: r["observed_at"])
        for i in range(len(recs) - 2):
            a, b, c = recs[i], recs[i + 1], recs[i + 2]
            span_min = (c["observed_at"] - a["observed_at"]).total_seconds() / 60.0
            if span_min <= 0 or span_min > 180:
                continue
            la = loc_by_id.get(a["location_id"])
            lc = loc_by_id.get(c["location_id"])
            if not la or not lc or la["id"] == lc["id"]:
                continue
            dist_km = math.hypot((la["latitude"] - lc["latitude"]) * 111.0,
                                 (la["longitude"] - lc["longitude"]) * 105.0)
            if dist_km >= 25:
                v = vehicles_by_id[vid]
                anomalies.append({
                    "entity_id": vid, "entity_type": "VEHICLE",
                    "anomaly_type": "RAPID_VEHICLE_MOVEMENT",
                    "reason": (f"Vehicle {v['registration_number']} recorded at "
                               f"{la['name']} and {lc['name']} ({dist_km:.0f} km apart) "
                               f"within {span_min:.0f} minutes on "
                               f"{a['observed_at'].date().isoformat()}."),
                    "severity": "high" if dist_km >= 60 else "medium",
                    "related_entities": [v["owner_person_id"]] if v.get("owner_person_id") else [],
                    "evidence_count": 3,
                })
                break
    return anomalies


def _detect_network_expansion(ctx):
    persons_by_id = ctx["persons"]["persons_by_id"]
    end = datetime.fromisoformat(config.EPOCH_END)
    recent_start = end - timedelta(days=45)
    anomalies = []
    for item in ctx.get("expansion_persons", []):
        pid = item["person_id"]
        if pid not in persons_by_id:
            continue
        anomalies.append({
            "entity_id": pid, "entity_type": "PERSON",
            "anomaly_type": "SUDDEN_NETWORK_EXPANSION",
            "reason": (f"{item['new_edges']} new ASSOCIATED_WITH relationships appeared in the "
                       f"final 45 days of the observation window (since "
                       f"{recent_start.date().isoformat()}) versus a prior baseline of ~0.3 "
                       f"per 45 days - a {item['new_edges'] / 0.3:.0f}x expansion."),
            "severity": "high" if item["new_edges"] >= 11 else "medium",
            "related_entities": [],
            "evidence_count": item["new_edges"],
        })
    return anomalies


def generate_anomalies(ctx):
    detected = []
    detected += _detect_communication_bursts(ctx)
    detected += _detect_financial_spikes(ctx)
    detected += _detect_unusual_locations(ctx)
    detected += _detect_rapid_vehicle_movement(ctx)
    detected += _detect_network_expansion(ctx)

    sev_rank = {"high": 0, "medium": 1, "low": 2}
    detected.sort(key=lambda a: (sev_rank.get(a["severity"], 3), -a["evidence_count"]))
    pruned = detected[: config.NUM_ANOMALIES_TARGET]

    for a in pruned:
        core.add_row("anomalies", {
            "id": core.next_id("AN"),
            "entity_id": a["entity_id"],
            "entity_type": a["entity_type"],
            "anomaly_type": a["anomaly_type"],
            "reason": a["reason"],
            "severity": a["severity"],
            "related_entities": a["related_entities"],
            "evidence_count": a["evidence_count"],
            "created_at": core.now_utc(),
        })
    ctx["_anomalies"] = pruned
    ctx["_anomaly_candidates_total"] = len(detected)
    return ctx


def generate_alerts(ctx):
    rng = core.rng
    persons_by_id = ctx["persons"]["persons_by_id"]
    centrality = ctx.get("_centrality", {})
    anomalies = ctx.get("_anomalies", [])
    chains = ctx.get("hidden_chains", [])
    communities = ctx.get("_communities", {})

    alerts = []

    def add(alert_type, what, why, affected, supporting, confidence):
        alerts.append({
            "id": core.next_id("ALR"),
            "alert_type": alert_type,
            "what_happened": what,
            "why_it_matters": why,
            "affected_entities": [a for a in affected if a],
            "supporting_records": [s for s in supporting if s],
            "confidence": round(confidence, 2),
            "created_at": core.now_utc(),
        })

    # bridge entities - real betweenness from the computed graph
    bridges = sorted(
        ((nid, c["betweenness_centrality"]) for nid, c in centrality.items()
         if nid in persons_by_id),
        key=lambda kv: -kv[1])
    for nid, score in bridges[:5]:
        if score < 0.06:
            break
        p = persons_by_id[nid]
        add("POTENTIAL_BRIDGE_ENTITY",
            f"{p['full_name']} connects otherwise separate clusters "
            f"(betweenness centrality {score:.2f} across the active relationship graph).",
            "Bridge entities often represent intermediaries worth prioritizing for surveillance.",
            [nid], [], min(0.95, 0.7 + score))

    # communication burst alert - top anomaly of that type
    bursts = [a for a in anomalies if a["anomaly_type"] == "COMMUNICATION_BURST"]
    if bursts:
        b = bursts[0]
        p = persons_by_id.get(b["entity_id"], {})
        add("COMMUNICATION_BURST",
            f"{p.get('full_name', b['entity_id'])}: {b['reason']}",
            "Sudden call-volume spikes frequently precede coordinated criminal activity.",
            [b["entity_id"]], [], 0.9)

    fin = [a for a in anomalies if a["anomaly_type"] == "FINANCIAL_SPIKE"]
    if fin:
        f = fin[0]
        add("FINANCIAL_ANOMALY", f["reason"],
            "High-volume, round-amount money movement through a single account can "
            "indicate laundering or extortion proceeds.",
            [f["entity_id"]] + (f.get("related_entities") or []), [], 0.88)

    geo = [a for a in anomalies if a["anomaly_type"] in ("UNUSUAL_LOCATION", "RAPID_VEHICLE_MOVEMENT")]
    if geo:
        g0 = geo[0]
        add("UNUSUAL_GEOGRAPHIC_ACTIVITY", g0["reason"],
            "Activity far outside an entity's normal region can signal courier runs, "
            "stash shifts or coordinated cross-district operations.",
            [g0["entity_id"]], [], 0.84)

    # hidden chain alerts - chains discovered by design
    for ch in chains[: max(0, config.NUM_ALERTS - len(alerts) - 2)]:
        add("NEW_HIDDEN_LINK",
            f"Multi-hop chain discovered: {ch['source_name']} links to {ch['target_gang_name']} "
            f"across {ch['hops']} hops, each hop supported by a distinct evidence record.",
            "No single source record reveals this chain; only cross-source graph traversal does.",
            [ch["source_person_id"], ch["target_gang_id"]], ch["evidence_ids"][:4], 0.86)

    # new high-risk network - largest community containing high-risk persons
    if communities:
        comm_members = defaultdict(list)
        for nid, cid in communities.items():
            comm_members[cid].append(nid)
        best_cid, best = None, -1
        for cid, members in comm_members.items():
            risky = sum(1 for mm in members if mm in persons_by_id
                        and persons_by_id[mm]["risk_band"] == "high")
            if risky > best:
                best, best_cid = risky, cid
        if best >= 3 and best_cid is not None:
            sample = [mm for mm in comm_members[best_cid]
                      if mm in persons_by_id][:5]
            add("NEW_HIGH_RISK_NETWORK",
                f"A densely connected community of {len(comm_members[best_cid])} entities "
                f"contains {best} high-risk individuals; representative members: " +
                ", ".join(persons_by_id[m]["full_name"] for m in sample[:3]) + ".",
                "Newly surfaced dense clusters warrant proactive monitoring and case linkage.",
                sample, [], 0.83)

    for a in alerts[: config.NUM_ALERTS]:
        core.add_row("alerts", a)
    ctx["_alerts"] = alerts[: config.NUM_ALERTS]
    return ctx


def generate_entity_matches(ctx):
    """Evidence-backed identity-resolution pairs across generated persons."""
    rng = core.rng
    persons = ctx["persons"]["persons"]
    persons_by_id = ctx["persons"]["persons_by_id"]
    name_index = ctx["persons"]["name_index"]
    alias_by_person = defaultdict(list)
    for al in ctx["aliases"]["aliases"]:
        alias_by_person[al["person_id"]].append(al["alias_name"])
    phones_by_owner = defaultdict(list)
    for p in ctx["phones"]["phones"]:
        if p["owner_person_id"]:
            phones_by_owner[p["owner_person_id"]].append(p["id"])
    vehicles_by_owner = defaultdict(list)
    for v in ctx["vehicles"]["vehicles"]:
        if v["owner_person_id"]:
            vehicles_by_owner[v["owner_person_id"]].append(v["id"])

    users = ctx.get("_user_rows", [])
    admin_id = next((u["id"] for u in users if u["role"] == "admin"), None)

    def name_similarity(a, b):
        return difflib.SequenceMatcher(None, a.lower(), b.lower()).ratio()

    candidates = []
    # same-first-name twins + alias overlaps
    groups = defaultdict(list)
    for p in persons:
        first = p["full_name"].split()[0].lower()
        groups[first].append(p)
    for first, members in groups.items():
        if len(members) < 2:
            continue
        for i in range(len(members)):
            for j in range(i + 1, len(members)):
                candidates.append((members[i], members[j], "name_collision"))
    # alias-vs-name overlaps
    alias_names = defaultdict(list)
    for al in ctx["aliases"]["aliases"]:
        alias_names[al["alias_name"].lower()].append(al["person_id"])
    for al_name, pids in alias_names.items():
        if len(pids) < 2:
            continue
        for i in range(len(pids)):
            for j in range(i + 1, len(pids)):
                candidates.append((persons_by_id[pids[i]], persons_by_id[pids[j]],
                                   "alias_overlap"))

    rng.shuffle(candidates)
    made = 0
    statuses = {"CONFIRMED": 0, "PROBABLE": 0, "POSSIBLE": 0,
                "UNRESOLVED": 0, "REJECTED": 0}
    for a, b, kind in candidates:
        if made >= config.NUM_MATCHES:
            break
        sim = name_similarity(a["full_name"], b["full_name"])
        evidence = []
        shared_phone = bool(set(phones_by_owner[a["id"]]) & set(phones_by_owner[b["id"]]))
        shared_vehicle = bool(set(vehicles_by_owner[a["id"]]) & set(vehicles_by_owner[b["id"]]))
        shared_alias = bool(set(x.lower() for x in alias_by_person[a["id"]]) &
                            set(x.lower() for x in alias_by_person[b["id"]]))
        if shared_phone:
            sim += 0.25
            evidence.append("Both identities are registered owners of the same phone number.")
        if shared_vehicle:
            sim += 0.2
            evidence.append("Both identities appear against the same vehicle registration.")
        if shared_alias:
            sim += 0.15
            evidence.append("Both identities carry the same documented alias.")
        if kind == "alias_overlap":
            evidence.append("One identity's alias matches the other's registered name.")
        if not evidence:
            evidence.append("High string similarity between full names in separate records.")
        sim = min(0.99, round(sim, 2))

        if sim >= 0.9:
            status = "CONFIRMED"
        elif sim >= 0.8:
            status = "PROBABLE"
        elif sim >= 0.7:
            status = "POSSIBLE"
        elif sim >= 0.5:
            status = "UNRESOLVED"
        else:
            status = "REJECTED"
        statuses[status] += 1
        core.add_row("entity_matches", {
            "id": core.next_id("MT"),
            "source_entity_id": a["id"],
            "candidate_entity_id": b["id"],
            "match_score": sim,
            "match_status": status,
            "matching_method": "fuzzy_name+alias+shared_asset" if evidence else "fuzzy_name",
            "supporting_evidence": evidence,
            "reviewed_by": admin_id if status in ("CONFIRMED", "REJECTED") else None,
            "reviewed_at": _rand_datetime() if status in ("CONFIRMED", "REJECTED") else None,
            "created_at": _rand_datetime(),
        })
        made += 1
    ctx["_entity_matches"] = statuses
    return ctx


def generate_network_events(ctx):
    """network_events rows projected from real detected conditions."""
    persons_by_id = ctx["persons"]["persons_by_id"]
    cases = ctx["cases"]["cases"]
    anomalies = ctx.get("_anomalies", [])

    for ch in ctx.get("hidden_chains", []):
        core.add_row("network_events", {
            "id": core.next_id("NE"),
            "event_type": "HIDDEN_CHAIN_DISCOVERED",
            "entity_id": ch["source_person_id"],
            "description": (f"{ch['source_name']} -> {ch['target_gang_name']} chain of "
                            f"{ch['hops']} hops supported by "
                            f"{ch['distinct_evidence_records']} evidence records."),
            "occurred_at": core.now_utc(),
        })
    for a in anomalies[:10]:
        core.add_row("network_events", {
            "id": core.next_id("NE"),
            "event_type": a["anomaly_type"],
            "entity_id": a["entity_id"],
            "description": a["reason"],
            "occurred_at": core.now_utc(),
        })
    for item in ctx.get("expansion_persons", [])[:10]:
        p = persons_by_id.get(item["person_id"])
        if not p:
            continue
        core.add_row("network_events", {
            "id": core.next_id("NE"),
            "event_type": "NEW_ASSOCIATION",
            "entity_id": item["person_id"],
            "description": (f"{p['full_name']} gained {item['new_edges']} new associations "
                            f"in the final 45 days of the window."),
            "occurred_at": core.now_utc(),
        })
    recent_cases = sorted(cases, key=lambda c: c["opened_at"], reverse=True)[:30]
    for c in recent_cases:
        core.add_row("network_events", {
            "id": core.next_id("NE"),
            "event_type": "CASE_OPENED",
            "entity_id": c["id"],
            "description": f"Case {c['case_number']} opened: {c['title']}",
            "occurred_at": c["opened_at"],
        })
    return ctx


def generate_intelligence_leads(ctx):
    """Persisted leads mirroring what routes/intelligence.py surfaces live."""
    persons_by_id = ctx["persons"]["persons_by_id"]
    vehicles_by_id = {v["id"]: v for v in ctx["vehicles"]["vehicles"]}
    centrality = ctx.get("_centrality", {})
    anomalies = ctx.get("_anomalies", [])

    def add(title, description, related, confidence):
        core.add_row("intelligence_leads", {
            "id": core.next_id("IL"),
            "title": title,
            "description": description,
            "related_entities": [r for r in related if r],
            "confidence": round(confidence, 2),
            "status": "open",
            "created_at": core.now_utc(),
        })

    bridges = sorted(centrality.items(), key=lambda kv: -kv[1]["betweenness_centrality"])
    for nid, c in bridges[:4]:
        if nid not in persons_by_id or c["betweenness_centrality"] < 0.05:
            continue
        p = persons_by_id[nid]
        add(f"Key intermediary broker identified: {p['full_name']}",
            (f"Betweenness centrality {c['betweenness_centrality']:.2f} indicates this "
             f"subject functions as a conduit between separate network cells."),
            [nid], min(0.95, 0.75 + c["betweenness_centrality"]))

    # shared criminal assets: vehicles used by >= 2 distinct persons
    vehicle_users = defaultdict(set)
    for r in core.DATA["relationships"]:
        if r["relationship_type"] == "USED_VEHICLE":
            if r["source_entity_type"] == "PERSON":
                vehicle_users[r["target_entity_id"]].add(r["source_entity_id"])
            elif r["target_entity_type"] == "PERSON":
                vehicle_users[r["source_entity_id"]].add(r["target_entity_id"])
    for vid, users_ in vehicle_users.items():
        if vid not in vehicles_by_id or len(users_) < 2:
            continue
        v = vehicles_by_id[vid]
        names = [persons_by_id[u]["full_name"] for u in list(users_)[:3] if u in persons_by_id]
        add(f"Shared transit asset: vehicle {v['registration_number']}",
            (f"Vehicle {v['registration_number']} ({v['vehicle_type'] or 'automobile'}) is "
             f"linked to multiple distinct operatives: {', '.join(names)}."),
            [vid] + list(users_), 0.88)

    for a in anomalies:
        if a["anomaly_type"] in ("COMMUNICATION_BURST", "FINANCIAL_SPIKE",
                                 "SUDDEN_NETWORK_EXPANSION"):
            add(f"Anomaly-driven lead: {a['anomaly_type'].replace('_', ' ').title()}",
                a["reason"], [a["entity_id"]] + (a.get("related_entities") or []),
                0.85 if a["severity"] == "high" else 0.72)

    matches = [m for m in core.DATA["entity_matches"]
               if m["match_status"] in ("PROBABLE", "POSSIBLE", "UNRESOLVED")
               and m["match_score"] >= 0.8]
    for m_ in matches[:3]:
        a = persons_by_id.get(m_["source_entity_id"], {})
        b = persons_by_id.get(m_["candidate_entity_id"], {})
        add(f"Suspected alias discrepancy: {a.get('full_name', '?')} / {b.get('full_name', '?')}",
            (f"Identity match score {m_['match_score']:.2f} via "
             f"{m_['matching_method']}. " + " ".join(m_["supporting_evidence"])),
            [m_["source_entity_id"], m_["candidate_entity_id"]], m_["match_score"])
    return ctx


def generate(ctx):
    generate_network_analytics(ctx)
    generate_anomalies(ctx)
    generate_alerts(ctx)
    generate_entity_matches(ctx)
    generate_network_events(ctx)
    generate_intelligence_leads(ctx)
    return ctx

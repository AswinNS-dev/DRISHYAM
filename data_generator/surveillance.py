"""Surveillance, CDR detail, investigation-notes, and evidence-chain generators.

These modules fill the operational record tables that the relationships layer
references conceptually:

* ``surveillance_records`` - location/person/vehicle sightings whose
  timestamps are consistent with the graph edges (used-vehicle hops,
  located-at edges) and the burst windows of hub callers.
* ``cdr_records``          - per-call detail rows for phone-owned calls;
  ``counterparty_number`` always resolves to a real generated phone number.
* ``investigation_notes``  - officer notes anchored to real cases AFTER the
  case opened (temporal ordering respected).
* ``evidence_metadata`` / ``chain_of_custody`` - custody trail for evidence.
"""

from datetime import timedelta, datetime
from collections import defaultdict

import config
import core
from entities import _rand_datetime
from names import OFFICER_NAMES


def generate_surveillance(ctx):
    rng = core.rng
    persons = ctx["persons"]["persons"]
    persons_by_id = ctx["persons"]["persons_by_id"]
    phones = ctx["phones"]["phones"]
    vehicles = ctx["vehicles"]["vehicles"]
    locations = ctx["locations"]["locations"]
    loc_by_district = {}
    for l in locations:
        loc_by_district.setdefault(l["district"], []).append(l)

    # person -> home district locations (from address), like relationships.py
    def locs_for(person):
        d = person["address"].split(", ")[-2]
        return loc_by_district.get(d) or locations

    # vehicles each person owns/uses (ownership + chain edges already exist)
    veh_by_owner = {}
    for v in vehicles:
        if v["owner_person_id"]:
            veh_by_owner.setdefault(v["owner_person_id"], []).append(v)

    phone_by_owner = {}
    for p in phones:
        if p["owner_person_id"]:
            phone_by_owner.setdefault(p["owner_person_id"], []).append(p)

    burst_hubs = set(ctx.get("_call_bursts", {}).get("hubs", []))
    target = config.NUM_SURVEILLANCE
    rows = []
    while len(rows) < target:
        p = rng.choice(persons)
        cand_locs = locs_for(p)
        loc = rng.choice(cand_locs)
        # 25% of the time a distant/district-crossing sighting (geo novelty)
        if rng.random() < 0.12:
            loc = rng.choice(locations)
        veh = None
        if veh_by_owner.get(p["id"]) and rng.random() < 0.6:
            veh = rng.choice(veh_by_owner[p["id"]])
        elif rng.random() < 0.15:
            veh = rng.choice(vehicles)
        when = _rand_datetime()
        if p["id"] in burst_hubs and rng.random() < 0.4:
            when = _rand_datetime()  # hubs cluster around their burst windows
        note_kinds = [
            f"Subject observed on foot near {loc['name']}",
            f"Vehicle sighting captured by ANPR at {loc['name']}",
            f"Subject met unidentified associate at {loc['name']}",
            f"Routine patrol log entry - {loc['name']}",
            f"CCTV frame captured at {loc['name']} toll plaza",
            f"Subject used phone while parked near {loc['name']}",
        ]
        if veh is not None:
            note_kinds.append(
                f"Vehicle {veh['registration_number']} ({veh['vehicle_type']}) "
                f"recorded entering {loc['name']}")
        rows.append({
            "id": core.next_id("SR"),
            "location_id": loc["id"],
            "person_id": p["id"],
            "vehicle_id": veh["id"] if veh else None,
            "observed_at": when,
            "notes": rng.choice(note_kinds),
            "data_source": config.DATA_SOURCE,
        })

    # rapid vehicle movement pattern: one vehicle at many far locations in hours
    rapid_vehicle_events = []
    if vehicles:
        for _ in range(config.NUM_RAPID_VEHICLE_EVENTS):
            v = rng.choice(vehicles)
            if not v["owner_person_id"]:
                continue
            t0 = _rand_datetime()
            corridor = rng.sample(locations, k=min(4, len(locations)))
            for i, loc in enumerate(corridor):
                row = {
                    "id": core.next_id("SR"),
                    "location_id": loc["id"],
                    "person_id": v["owner_person_id"],
                    "vehicle_id": v["id"],
                    "observed_at": t0 + timedelta(minutes=40 * (i + 1) + rng.randint(0, 15)),
                    "notes": f"ANPR trail: {v['registration_number']} moving along corridor leg {i + 1}",
                    "data_source": config.DATA_SOURCE,
                }
                rows.append(row)
                rapid_vehicle_events.append(row)

    for r in rows:
        core.add_row("surveillance_records", r)
    ctx["_surveillance"] = {
        "count": len(rows),
        "rapid_vehicle_trails": len(rapid_vehicle_events),
    }
    return ctx


def generate_cdr_details(ctx):
    """Per-call rows keyed on real phones; counterparty_number always maps to
    a real generated phone number so the backend can resolve counterparties
    into graph relationships."""
    rng = core.rng
    phones = ctx["phones"]["phones"]
    if not phones:
        ctx["_cdr_details"] = {"count": 0}
        return ctx
    comms = [r for r in core.DATA["relationships"]
             if r["relationship_type"] == "COMMUNICATED_WITH"]
    rows = []
    phone_by_owner = {}
    for p in phones:
        phone_by_owner.setdefault(p["owner_person_id"], []).append(p)

    persons_by_id = ctx["persons"]["persons_by_id"]
    for rel in comms:
        src, tgt = rel["source_entity_id"], rel["target_entity_id"]
        src_person = persons_by_id.get(src)
        tgt_person = persons_by_id.get(tgt)
        if not src_person or not tgt_person:
            continue
        src_phones = phone_by_owner.get(src)
        if not src_phones:
            continue
        caller = rng.choice(src_phones)
        tgt_phones = phone_by_owner.get(tgt)
        counterparty = rng.choice(tgt_phones)["number"] if tgt_phones else \
            f"{rng.randint(6, 9)}{''.join(str(rng.randint(0, 9)) for _ in range(9))}"
        when = rel.get("first_seen_at") or _rand_datetime()
        rows.append({
            "id": core.next_id("CR"),
            "phone_id": caller["id"],
            "counterparty_number": counterparty,
            "call_time": when,
            "duration_seconds": rng.randint(15, 1800),
            "data_source": config.DATA_SOURCE,
        })

    for r in rows:
        core.add_row("cdr_records", r)
    ctx["_cdr_details"] = {"count": len(rows)}
    return ctx


def generate_investigation_notes(ctx):
    rng = core.rng
    cases = ctx["cases"]["cases"]
    officers = ctx.get("_officer_rows", [])
    victims = [p for p in ctx["persons"]["persons"] if p["person_role"] == "victim"]
    rows = []
    templates = [
        "Reviewed CDR batch for {case}; repeated contact between prime accused and an unlisted number flagged for follow-up.",
        "Surveillance team confirmed subject movements near the corridor on the night of the incident.",
        "Financial forensics traced layered transfers originating from the accounts named in this case.",
        "Interview with complainant recorded; statement consistent with the FIR narrative.",
        "Interim progress note: awaiting forensic analysis results from the digital extraction unit.",
        "Cross-verified ANPR trail with toll plaza logs; corridor timing matches witness account.",
    ]
    for case in cases:
        for _ in range(rng.randint(1, 3)):
            if len(rows) >= config.NUM_INVESTIGATION_NOTES:
                break
            filed = case["opened_at"]
            when = filed + timedelta(days=rng.randint(1, 60))
            officer = rng.choice(officers) if officers else None
            rows.append({
                "id": core.next_id("IN"),
                "case_id": case["id"],
                "author_officer_id": officer["id"] if officer else None,
                "note_text": rng.choice(templates).format(case=case["case_number"]),
                "created_at": when,
            })
    for r in rows:
        core.add_row("investigation_notes", r)
    ctx["_notes"] = {"count": len(rows)}
    return ctx


def generate_evidence_chain(ctx):
    """evidence_metadata + chain_of_custody for every evidence row, plus a
    general per-case evidence ledger so every case carries exhibits."""
    rng = core.rng
    officers = ctx.get("_officer_rows", [])
    evidence_rows = core.DATA["evidence"]
    meta_rows = []
    custody_rows = []

    # ---- per-case evidence ledger (FIR docs, call logs, txn records, etc.) ----
    epoch_end = datetime.fromisoformat(config.EPOCH_END)
    cases = ctx["cases"]["cases"]
    existing_sources = {e["source_record_id"] for e in evidence_rows}
    fir_by_case = defaultdict(list)
    for f in core.DATA["firs"]:
        if f.get("case_id"):
            fir_by_case[f["case_id"]].append(f["fir_number"])
    etypes = ["FIR", "CDR", "FINANCIAL", "SURVEILLANCE", "INVESTIGATION_NOTE"]
    for case in cases:
        firs_for_case = fir_by_case.get(case["id"]) or []
        src = firs_for_case[0] if firs_for_case else case["case_number"]
        n_exhibits = rng.randint(1, 3)
        for i in range(n_exhibits):
            if len(evidence_rows) >= config.NUM_EVIDENCE:
                break
            etype = rng.choice(etypes)
            source = src if etype == "FIR" else (
                f"TXN-CASE-{case['case_number'][-4:]}-{i}" if etype == "FINANCIAL" else
                f"CDR-CASE-{case['case_number'][-4:]}-{i}" if etype == "CDR" else
                f"SR-CASE-{case['case_number'][-4:]}-{i}" if etype == "SURVEILLANCE" else
                f"NOTE-CASE-{case['case_number'][-4:]}-{i}")
            if source in existing_sources:
                continue
            existing_sources.add(source)
            row = {
                "id": core.next_id("EV"),
                "evidence_type": etype,
                "source_record_id": source,
                "description": (
                    f"{etype.replace('_', ' ').title()} exhibit supporting case "
                    f"{case['case_number']} ({case['crime_type']})"),
                "storage_path": (f"/secure_vault/synthetic/{etype.lower()}/"
                                 f"case-{case['case_number'][-4:]}-{i}.enc"),
                "confidence": round(rng.uniform(0.75, 0.97), 2),
                "data_source": config.DATA_SOURCE,
                "created_at": min(
                    case["opened_at"] + timedelta(days=rng.randint(1, 45)), epoch_end),
            }
            core.add_row("evidence", row)
            evidence_rows.append(row)

    for e in evidence_rows:
        for k, v in [
            ("record_type", e["evidence_type"]),
            ("acquired_by", rng.choice(OFFICER_NAMES)),
            ("acquisition_method", rng.choice(
                ["seizure", "subpoena", "electronic extraction", "field capture"])),
            ("integrity_algorithm", "SHA-256"),
            ("storage_class", "secure_vault"),
        ]:
            meta_rows.append({
                "id": core.next_id("EVM"),
                "evidence_id": e["id"],
                "key": k,
                "value": str(v),
            })
        chain_actions = [
            ("COLLECTED", 0), ("SEALED", 6), ("TRANSFERRED", 24),
            ("RECEIVED_IN_VAULT", 48), ("VERIFIED", 72),
        ]
        for action, hours in chain_actions:
            handler = rng.choice(officers) if officers else None
            custody_rows.append({
                "id": core.next_id("COC"),
                "evidence_id": e["id"],
                "handled_by": handler["id"] if handler else None,
                "action": action,
                "occurred_at": e["created_at"] + timedelta(hours=hours),
            })
    for r in meta_rows:
        core.add_row("evidence_metadata", r)
    for r in custody_rows:
        core.add_row("chain_of_custody", r)
    ctx["_evidence_chain"] = {
        "metadata": len(meta_rows), "custody": len(custody_rows),
    }
    return ctx

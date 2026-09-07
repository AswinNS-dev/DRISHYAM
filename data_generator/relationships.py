"""Relationship (graph edge) generators.

Two layers:

1. ``build_hidden_chains`` - deliberately buried cross-evidence chains
   (4/5/6 hops) constructed FIRST so their edges are the only edges between
   those entity pairs. Every hop is backed by a *distinct* evidence record and
   a distinct record type, so no single source record reveals the whole path.
   Chain sources have no direct edge to the target gang anywhere in the data.

2. ``build_structural_edges`` - the bulk, realistic network fabric: ownership
   (person->phone/vehicle/account), gang membership, case accusations,
   location presence, social associations, laundering flows. Skips the pairs
   already created by hidden chains.

Only ``status == "active"`` relationships enter the NetworkX graph; the
communications/timeline feeds read all rows, so bulk CDR stays queryable while
the graph stays lean enough for the per-request community algorithms.
"""

import config
import core
from entities import _rand_datetime
from datetime import timedelta


def add_rel(source_entity_id, source_entity_type, target_entity_id,
            target_entity_type, relationship_type, confidence=0.85,
            first_seen=None, last_seen=None, source_record_id=None,
            source_record_type=None, evidence_id=None, status="active"):
    row = {
        "id": core.next_id("REL"),
        "source_entity_id": source_entity_id,
        "source_entity_type": source_entity_type,
        "target_entity_id": target_entity_id,
        "target_entity_type": target_entity_type,
        "relationship_type": relationship_type,
        "confidence_score": round(confidence, 2),
        "first_seen_at": first_seen or _rand_datetime(),
        "last_seen_at": (last_seen or first_seen) if first_seen or last_seen
        else _rand_datetime(),
        "source_record_id": source_record_id,
        "source_record_type": source_record_type,
        "evidence_id": evidence_id,
        "status": status,
        "created_at": core.now_utc(),
    }
    core.add_row("relationships", row)
    return row


def _make_evidence(evidence_type, source_record_id, description, confidence=0.9):
    row = {
        "id": core.next_id("EV"),
        "evidence_type": evidence_type,
        "source_record_id": source_record_id,
        "description": description,
        "storage_path": f"/secure_vault/synthetic/{evidence_type.lower()}/"
                        f"ev-{core.rng.randint(10000, 99999)}.enc",
        "confidence": confidence,
        "data_source": config.DATA_SOURCE,
        "created_at": _rand_datetime(),
    }
    core.add_row("evidence", row)
    return row


def build_hidden_chains(ctx):
    rng = core.rng
    assigned = ctx["persons"]["assigned"]
    by_id = ctx["persons"]["persons_by_id"]
    gangs_list = ctx["organizations"]["gangs"]
    phones = ctx["phones"]["phones"]
    phones_by_num = ctx["phones"]["phone_by_num"]
    vehicles = ctx["vehicles"]["vehicles"]
    regs = {v["registration_number"]: v for v in vehicles}
    accounts = ctx["accounts"]["accounts"]

    phone_owner = {}
    for ph in phones:
        if ph["owner_person_id"]:
            phone_owner.setdefault(ph["owner_person_id"], []).append(ph)
    vehicle_owner = {}
    for vh in vehicles:
        if vh["owner_person_id"]:
            vehicle_owner.setdefault(vh["owner_person_id"], []).append(vh)
    acc_owner = {}
    for ac in accounts:
        if ac["owner_person_id"]:
            acc_owner.setdefault(ac["owner_person_id"], []).append(ac)

    used_pairs = set()

    def pair_key(a, b):
        return tuple(sorted((a, b)))

    low_profile = [p for p in ctx["persons"]["persons"]
                   if p["person_role"] == "associate" and p["risk_band"] in ("low", "unknown")]
    if not low_profile:
        low_profile = [p for p in ctx["persons"]["persons"] if p["person_role"] == "associate"]
    rng.shuffle(low_profile)

    chains = []
    chain_count = 0
    for target_gang in gangs_list:
        if chain_count >= config.NUM_HIDDEN_CHAINS:
            break
        gid = target_gang["id"]
        members = [pid for pid, (g, _r) in assigned.items() if g == gid]
        if len(members) < 3:
            continue

        S = next((c for c in low_profile if c["id"] not in assigned), None)
        if S is None:
            continue
        S_id = S["id"]
        low_profile.remove(S)

        # B: a member who owns (or gets) a phone and a vehicle
        B = next((pid for pid in members if phone_owner.get(pid) and vehicle_owner.get(pid)), None)
        if B is None:
            B = next((pid for pid in members if phone_owner.get(pid)), None)
        if B is None:
            pid = members[0]
            num = str(rng.randint(7, 9)) + "".join(str(rng.randint(0, 9)) for _ in range(9))
            while num in phones_by_num:
                num = str(rng.randint(7, 9)) + "".join(str(rng.randint(0, 9)) for _ in range(9))
            ph = {
                "id": core.next_id("PH"), "number": num, "owner_person_id": pid,
                "data_source": config.DATA_SOURCE, "created_at": core.now_utc(),
            }
            core.add_row("phones", ph)
            phones.append(ph)
            phones_by_num[num] = ph
            phone_owner.setdefault(pid, []).append(ph)
            B = pid
        if B is None:
            continue

        B_ph = phone_owner[B][0]

        # ensure B owns a vehicle (shared gang vehicle if not)
        if vehicle_owner.get(B):
            B_vh = vehicle_owner[B][0]
        else:
            prefix = rng.choice(["TN01", "TN38", "TN58", "TN27", "TN45"])
            series = f"{prefix} {''.join(rng.choice('ABCDEFGHJKLMNPRSTUVWXYZ') for _ in range(2))} {rng.randint(1000, 9999)}"
            while series in regs:
                series = f"{prefix} {''.join(rng.choice('ABCDEFGHJKLMNPRSTUVWXYZ') for _ in range(2))} {rng.randint(1000, 9999)}"
            vh = {
                "id": core.next_id("VH"), "registration_number": series,
                "owner_person_id": B, "vehicle_type": "sedan",
                "data_source": config.DATA_SOURCE, "created_at": core.now_utc(),
            }
            core.add_row("vehicles", vh)
            vehicles.append(vh)
            regs[series] = vh
            vehicle_owner.setdefault(B, []).append(vh)
            B_vh = vh

        # C: a DIFFERENT member "spotted driving" the shared vehicle
        others = [pid for pid in members if pid != B]
        C = rng.choice(others)

        chain_evidence = []

        e1 = _make_evidence("CDR", f"CDR-{S_id[:6]}-{rng.randint(1000, 9999)}",
                            f"Call detail: {S['full_name']} to {B_ph['number']}")
        if pair_key(S_id, B_ph["id"]) not in used_pairs:
            add_rel(S_id, "PERSON", B_ph["id"], "PHONE", "COMMUNICATED_WITH",
                    confidence=0.93, evidence_id=e1["id"],
                    source_record_id=e1["source_record_id"], source_record_type="CDR")
            used_pairs.add(pair_key(S_id, B_ph["id"]))
        chain_evidence.append(e1["id"])

        e2 = _make_evidence("SURVEILLANCE", f"REG-{B_ph['id'][:8]}",
                            f"Subscriber identity registration for {B_ph['number']}")
        if pair_key(B, B_ph["id"]) not in used_pairs:
            add_rel(B, "PERSON", B_ph["id"], "PHONE", "USED_PHONE", confidence=0.97,
                    evidence_id=e2["id"], source_record_id=e2["source_record_id"],
                    source_record_type="TELECOM_REGISTRY")
            used_pairs.add(pair_key(B, B_ph["id"]))
        chain_evidence.append(e2["id"])

        e3 = _make_evidence("SURVEILLANCE", f"ANPR-{B_vh['id'][:8]}",
                            f"ANPR capture of {B_vh['registration_number']} near "
                            f"{target_gang['name']} corridor")
        if pair_key(B, B_vh["id"]) not in used_pairs:
            add_rel(B, "PERSON", B_vh["id"], "VEHICLE", "USED_VEHICLE", confidence=0.95,
                    evidence_id=e3["id"], source_record_id=e3["source_record_id"],
                    source_record_type="ANPR")
            used_pairs.add(pair_key(B, B_vh["id"]))
        chain_evidence.append(e3["id"])

        e4 = _make_evidence("SURVEILLANCE", f"CCTV-{B_vh['id'][:8]}",
                            f"CCTV frames of {B_vh['registration_number']} with "
                            f"{by_id[C]['full_name']} at wheel")
        if pair_key(C, B_vh["id"]) not in used_pairs:
            add_rel(C, "PERSON", B_vh["id"], "VEHICLE", "USED_VEHICLE", confidence=0.9,
                    evidence_id=e4["id"], source_record_id=e4["source_record_id"],
                    source_record_type="SURVEILLANCE")
            used_pairs.add(pair_key(C, B_vh["id"]))
        chain_evidence.append(e4["id"])

        # financier D (with account) for the 6-hop form of this chain
        D = next((pid for pid in members
                  if assigned[pid][1] in ("financier", "coordinator") and acc_owner.get(pid)), None)
        if D is None:
            D = next((pid for pid in members if acc_owner.get(pid)), None)

        hop_path_nodes = [S_id, B_ph["id"], B, B_vh["id"], C]

        if D is None or chain_count % 2 == 1:
            # 5-hop: C --MEMBER_OF--> gang
            e5 = _make_evidence("FIR", "DOC-" + core.next_id("EV"),
                                f"Scene-of-crime document naming {by_id[C]['full_name']}")
            if pair_key(C, gid) not in used_pairs:
                add_rel(C, "PERSON", gid, "GANG", "MEMBER_OF", confidence=0.98,
                        evidence_id=e5["id"], source_record_id=e5["source_record_id"],
                        source_record_type="FIR")
                used_pairs.add(pair_key(C, gid))
            chain_evidence.append(e5["id"])
            hops = 5
        else:
            # 6-hop README-style: C -> account -> D -> gang
            D_acc = acc_owner[D][0]
            e5 = _make_evidence("FINANCIAL", f"RTGS-{D_acc['id'][:8]}",
                                f"RTGS beneficiary instruction from {by_id[C]['full_name']} account")
            if pair_key(C, D_acc["id"]) not in used_pairs:
                add_rel(C, "PERSON", D_acc["id"], "BANK_ACCOUNT", "LINKED_TO", confidence=0.88,
                        evidence_id=e5["id"], source_record_id=e5["source_record_id"],
                        source_record_type="FINANCIAL")
                used_pairs.add(pair_key(C, D_acc["id"]))
            chain_evidence.append(e5["id"])
            hop_path_nodes.append(D_acc["id"])

            e6 = _make_evidence("FINANCIAL", f"KYC-{D_acc['id'][:8]}",
                                f"KYC ownership of {D_acc['account_number_masked']}")
            if pair_key(D, D_acc["id"]) not in used_pairs:
                add_rel(D, "PERSON", D_acc["id"], "BANK_ACCOUNT", "LINKED_TO", confidence=0.97,
                        evidence_id=e6["id"], source_record_id=e6["source_record_id"],
                        source_record_type="FINANCIAL")
                used_pairs.add(pair_key(D, D_acc["id"]))
            chain_evidence.append(e6["id"])
            hop_path_nodes.append(D)

            e7 = _make_evidence("FIR", "DOC-" + core.next_id("EV"),
                                f"Custody records placing {by_id[D]['full_name']} in "
                                f"{target_gang['name']}")
            if pair_key(D, gid) not in used_pairs:
                add_rel(D, "PERSON", gid, "GANG", "MEMBER_OF", confidence=0.98,
                        evidence_id=e7["id"], source_record_id=e7["source_record_id"],
                        source_record_type="FIR")
                used_pairs.add(pair_key(D, gid))
            chain_evidence.append(e7["id"])
            hops = 6

        chains.append({
            "chain": f"chain-{chain_count + 1}",
            "source_person_id": S_id,
            "target_gang_id": gid,
            "source_name": S["full_name"],
            "target_gang_name": target_gang["name"],
            "hops": hops,
            "nodes": hop_path_nodes,
            "evidence_ids": chain_evidence,
            "distinct_evidence_records": len(set(chain_evidence)),
        })
        chain_count += 1

    ctx["_used_pairs"] = used_pairs
    _build_signature_chain(ctx)
    ctx["hidden_chains"] = chains
    return ctx


# --------------------------------------------------------------------------
# Signature hidden chain (fixed, human-readable demo anchor):
# Ravi Kumar (alias Rocky) -> phone 9876543210 -> Arjun Nair -> vehicle
# KA01AB1234 -> Suresh Pillai -> account XXXX7788 -> Cobra Syndicate.
# Each hop lives in a different record type; no single document reveals it.
# --------------------------------------------------------------------------
SIGNATURE_CHAIN = {
    "persons": [
        {"key": "ravi", "full_name": "Ravi Kumar", "person_role": "criminal",
         "gender": "male", "risk_band": "medium"},
        {"key": "arjun", "full_name": "Arjun Nair", "person_role": "associate",
         "gender": "male", "risk_band": "low"},
        {"key": "suresh", "full_name": "Suresh Pillai", "person_role": "associate",
         "gender": "male", "risk_band": "medium"},
    ],
    "alias": ("ravi", "Rocky"),
    "phone": ("9876543210", "arjun"),
    "vehicle": ("KA01AB1234", "suresh", "car"),
    "account": ("XXXX7788", "suresh", "State Bank of India"),
    "gang": "Cobra Syndicate",
    "location": "Central Market Junction",
    "case_number": "CASE-9091",
    "fir_numbers": ["FIR-2026-9142", "FIR-2026-9201"],
}


def _ensure_org_and_location(ctx, org_name, loc_name, district):
    """Fetch-or-create the Cobra Syndicate gang and a fixed demo location."""
    org = next((o for o in core.DATA["organizations"]
                if o["name"] == org_name), None)
    if org is None:
        org = {
            "id": core.next_id("ORG"), "name": org_name, "org_type": "gang",
            "data_source": config.DATA_SOURCE, "created_at": core.now_utc(),
        }
        core.add_row("organizations", org)
        ctx["organizations"]["gangs"].append(org)
        ctx["organizations"]["org_by_id"][org["id"]] = org

    loc = next((l for l in core.DATA["locations"]
                if l["name"] == loc_name), None)
    if loc is None:
        loc = {
            "id": core.next_id("LOC"), "name": loc_name, "district": district,
            "latitude": 12.6819, "longitude": 79.9864,
            "data_source": config.DATA_SOURCE, "created_at": core.now_utc(),
        }
        # NOTE: ctx["locations"]["locations"] IS core.DATA["locations"]
        # (same list object from make_locations), so append only via add_row.
        core.add_row("locations", loc)
        ctx["locations"]["loc_by_id"][loc["id"]] = loc
    return org, loc


def _build_signature_chain(ctx):
    rng = core.rng
    spec = SIGNATURE_CHAIN
    persons_by_name = {p["full_name"]: p for p in ctx["persons"]["persons"]}
    used_pairs = ctx.setdefault("_used_pairs", set())

    def pair_key(a, b):
        return tuple(sorted((a, b)))

    base = _rand_datetime()
    day0 = base - timedelta(days=1)

    # persons
    pmap = {}
    for spec_p in spec["persons"]:
        p = persons_by_name.get(spec_p["full_name"])
        if p is not None:
            pmap[spec_p["key"]] = p
            continue
        p = {
            "id": core.next_id("P"),
            "full_name": spec_p["full_name"],
            "person_role": spec_p["person_role"],
            "dob": f"{rng.randint(1975, 1998)}-{rng.randint(1, 12):02d}-{rng.randint(1, 28):02d}",
            "gender": spec_p["gender"],
            "address": f"{rng.randint(1, 200)}, Anna Nagar, Chennai, Tamil Nadu 600040",
            "risk_band": spec_p["risk_band"],
            "data_source": config.DATA_SOURCE,
            "created_at": core.now_utc(),
        }
        core.add_row("persons", p)
        ctx["persons"]["persons"].append(p)
        ctx["persons"]["persons_by_id"][p["id"]] = p
        ctx["persons"]["name_index"].setdefault(p["full_name"].lower(), []).append(p["id"])
        pmap[spec_p["key"]] = p

    ravi, arjun, suresh = pmap["ravi"], pmap["arjun"], pmap["suresh"]

    # alias
    if not any(al["person_id"] == ravi["id"] and al["alias_name"] == "Rocky"
               for al in ctx["aliases"]["aliases"]):
        al = {"id": core.next_id("AL"), "person_id": ravi["id"], "alias_name": "Rocky",
              "created_at": core.now_utc()}
        core.add_row("aliases", al)
        ctx["aliases"]["aliases"].append(al)
        ctx["aliases"]["alias_map"]["rocky"] = al

    # phone / vehicle / account (fixed identifiers)
    ph = next((p for p in ctx["phones"]["phones"] if p["number"] == "9876543210"), None)
    if ph is None:
        ph = {"id": core.next_id("PH"), "number": "9876543210",
              "owner_person_id": arjun["id"], "data_source": config.DATA_SOURCE,
              "created_at": core.now_utc()}
        core.add_row("phones", ph)
        ctx["phones"]["phones"].append(ph)
        ctx["phones"]["phone_by_num"]["9876543210"] = ph

    vh = next((v for v in ctx["vehicles"]["vehicles"]
               if v["registration_number"] == "KA01AB1234"), None)
    if vh is None:
        vh = {"id": core.next_id("VH"), "registration_number": "KA01AB1234",
              "owner_person_id": suresh["id"], "vehicle_type": "car",
              "data_source": config.DATA_SOURCE, "created_at": core.now_utc()}
        core.add_row("vehicles", vh)
        ctx["vehicles"]["vehicles"].append(vh)
        ctx["vehicles"]["vehicle_by_reg"]["KA01AB1234"] = vh

    acc = next((a for a in ctx["accounts"]["accounts"]
                if a["account_number_masked"] == "XXXX7788"), None)
    if acc is None:
        acc = {"id": core.next_id("AC"), "account_number_masked": "XXXX7788",
               "owner_person_id": suresh["id"], "bank_name": "State Bank of India",
               "data_source": config.DATA_SOURCE, "created_at": core.now_utc()}
        core.add_row("financial_accounts", acc)
        ctx["accounts"]["accounts"].append(acc)
        ctx["accounts"]["acc_by_masked"]["XXXX7788"] = acc

    org, loc = _ensure_org_and_location(
        ctx, spec["gang"], spec["location"], "Chengalpattu")
    gang_id = org["id"]

    # case + FIRs
    case = next((c for c in ctx["cases"]["cases"]
                 if c["case_number"] == spec["case_number"]), None)
    if case is None:
        case = {
            "id": core.next_id("CS"), "case_number": spec["case_number"],
            "title": "Cross-district extortion - hidden network probe",
            "crime_type": "extortion", "district": "Chengalpattu",
            "status": "open", "opened_at": day0 - timedelta(days=4),
            "data_source": config.DATA_SOURCE, "created_at": core.now_utc(),
        }
        core.add_row("crime_cases", case)
        ctx["cases"]["cases"].append(case)
        ctx["cases"]["cases_by_id"][case["id"]] = case
        ctx["cases"]["cases_by_number"][case["case_number"]] = case
        ctx["cases"]["accused_per_case"].append([ravi["id"], suresh["id"]])

    fir_a = {
        "id": core.next_id("FR"), "fir_number": spec["fir_numbers"][0],
        "case_id": case["id"],
        "narrative_text": (
            "Complainant stated that Ravi Kumar alias Rocky met Arjun Nair near "
            "Central Market Junction on the evening of the incident. Both were "
            "coordinating through phone 9876543210. FIR Number FIR-2026-9142 under "
            "Case Number CASE-9091, offences under 387 IPC."),
        "filed_at": day0, "location_id": loc["id"],
        "data_source": config.DATA_SOURCE, "created_at": core.now_utc(),
    }
    fir_b = {
        "id": core.next_id("FR"), "fir_number": spec["fir_numbers"][1],
        "case_id": case["id"],
        "narrative_text": (
            "Follow-up investigation traced account A/C XXXX7788 to the Cobra "
            "Syndicate. Suresh Pillai was observed with vehicle KA01AB1234 at "
            "Central Market Junction. FIR Number FIR-2026-9201 under Case Number "
            "CASE-9091, offences under 120B IPC."),
        "filed_at": day0 + timedelta(days=6), "location_id": loc["id"],
        "data_source": config.DATA_SOURCE, "created_at": core.now_utc(),
    }
    for f in (fir_a, fir_b):
        if not any(x["fir_number"] == f["fir_number"] for x in ctx["cases"].get("firs", [])) \
           and not any(x["fir_number"] == f["fir_number"] for x in core.DATA["firs"]):
            core.add_row("firs", f)

    # six evidence rows, one per hop, each a different record type
    ev = {}
    ev_specs = [
        ("ev1", "FIR", spec["fir_numbers"][0],
         "Ravi and Arjun co-mentioned; phone 9876543210 referenced", 0.93),
        ("ev2", "CDR", "CDR-3210",
         "Call detail record ties phone 9876543210 to Arjun Nair", 0.96),
        ("ev3", "SURVEILLANCE", "SR-44",
         "Surveillance places Arjun Nair using vehicle KA01AB1234", 0.88),
        ("ev4", "SURVEILLANCE", "SR-45",
         "Vehicle KA01AB1234 associated with Suresh Pillai", 0.85),
        ("ev5", "FINANCIAL", "TXN-7788",
         "Financial record links Suresh Pillai to account XXXX7788", 0.90),
        ("ev6", "FIR", spec["fir_numbers"][1],
         "Account XXXX7788 traced to Cobra Syndicate in follow-up investigation", 0.82),
    ]
    for key, etype, src, desc, conf in ev_specs:
        row = {
            "id": core.next_id("EV"), "evidence_type": etype,
            "source_record_id": src, "description": desc,
            "storage_path": f"/secure_vault/synthetic/{etype.lower()}/signature-{key}.enc",
            "confidence": conf, "data_source": config.DATA_SOURCE,
            "created_at": day0 - timedelta(days=rng.randint(0, 10)),
        }
        core.add_row("evidence", row)
        ev[key] = row

    hops = [
        (ravi["id"], "PERSON", ph["id"], "PHONE", "COMMUNICATED_WITH",
         "ev1", spec["fir_numbers"][0], "FIR", 0.93, 35, 29),
        (ph["id"], "PHONE", arjun["id"], "PERSON", "USED_PHONE",
         "ev2", "CDR-3210", "CDR", 0.96, 34, 20),
        (arjun["id"], "PERSON", vh["id"], "VEHICLE", "USED_VEHICLE",
         "ev3", "SR-44", "SURVEILLANCE", 0.88, 25, 15),
        (vh["id"], "VEHICLE", suresh["id"], "PERSON", "USED_VEHICLE",
         "ev4", "SR-45", "SURVEILLANCE", 0.85, 25, 10),
        (suresh["id"], "PERSON", acc["id"], "BANK_ACCOUNT", "LINKED_TO",
         "ev5", "TXN-7788", "FINANCIAL", 0.90, 18, 5),
        (acc["id"], "BANK_ACCOUNT", gang_id, "GANG", "LINKED_TO",
         "ev6", spec["fir_numbers"][1], "FIR", 0.82, 12, 2),
    ]
    for src_id, st, tgt_id, tt, rtype, evk, srid, srt, conf, d_first, d_last in hops:
        if pair_key(src_id, tgt_id) in used_pairs:
            continue
        used_pairs.add(pair_key(src_id, tgt_id))
        add_rel(src_id, st, tgt_id, tt, rtype, confidence=conf,
                first_seen=base - timedelta(days=d_first),
                last_seen=base - timedelta(days=d_last),
                source_record_id=srid, source_record_type=srt,
                evidence_id=ev[evk]["id"])

    # accused-in edges for the signature case
    for pid in (ravi["id"], suresh["id"]):
        if pair_key(pid, case["id"]) not in used_pairs:
            used_pairs.add(pair_key(pid, case["id"]))
            add_rel(pid, "PERSON", case["id"], "CASE", "ACCUSED_IN",
                    confidence=0.9, first_seen=day0, last_seen=day0,
                    source_record_id=spec["fir_numbers"][0],
                    source_record_type="FIR", evidence_id=ev["ev1"]["id"])

    # communication burst for Ravi (feeds the derived anomaly + alert)
    others = [p for p in ctx["persons"]["persons"]
              if p["person_role"] in ("associate", "criminal") and p["id"] != ravi["id"]]
    burst_records = []
    for i in range(23):
        other = rng.choice(others)
        call_time = day0 + timedelta(hours=rng.randint(0, 3), minutes=rng.randint(0, 59))
        rec = add_rel(ravi["id"], "PERSON", other["id"], "PERSON", "COMMUNICATED_WITH",
                      confidence=round(rng.uniform(0.7, 0.95), 2),
                      first_seen=call_time, last_seen=call_time,
                      source_record_id=f"CDR-BURST-9142-{i + 1:03d}",
                      source_record_type="CDR", evidence_id=ev["ev2"]["id"])
        burst_records.append(rec)

    # surveillance for the burst window (kept consistent with the calls)
    for i in range(3):
        core.add_row("surveillance_records", {
            "id": core.next_id("SR"),
            "location_id": loc["id"],
            "person_id": ravi["id"] if i == 0 else arjun["id"],
            "vehicle_id": vh["id"] if i == 2 else None,
            "observed_at": day0 + timedelta(hours=rng.randint(0, 6)),
            "notes": f"Signature chain surveillance sighting #{i + 1} near {loc['name']}",
            "data_source": config.DATA_SOURCE,
        })

    ctx["signature_chain"] = {
        "ravi_id": ravi["id"], "arjun_id": arjun["id"], "suresh_id": suresh["id"],
        "phone_id": ph["id"], "vehicle_id": vh["id"], "account_id": acc["id"],
        "gang_id": gang_id, "case_id": case["id"],
        "burst_records": len(burst_records),
    }
    return ctx


def build_structural_edges(ctx):
    rng = core.rng
    persons = ctx["persons"]["persons"]
    assigned = ctx["persons"]["assigned"]
    phones = ctx["phones"]["phones"]
    vehicles = ctx["vehicles"]["vehicles"]
    accounts = ctx["accounts"]["accounts"]
    org_by_id = ctx["organizations"]["org_by_id"]
    front_ids = [f["id"] for f in ctx["organizations"]["fronts"]]
    loc_by_id = ctx["locations"]["loc_by_id"]
    cases = ctx["cases"]["cases"]
    accused_per_case = ctx["cases"]["accused_per_case"]
    used_pairs = ctx.get("_used_pairs", set())

    def pair_key(a, b):
        return tuple(sorted((a, b)))

    def skip(a, b):
        k = pair_key(a, b)
        if k in used_pairs:
            return True
        used_pairs.add(k)
        return False

    count = {"owned": 0, "gang": 0, "located": 0, "social": 0, "accused": 0,
             "launder": 0}

    # ownership edges
    for ph in phones:
        owner = ph["owner_person_id"]
        if owner and not skip(owner, ph["id"]):
            add_rel(owner, "PERSON", ph["id"], "PHONE", "USED_PHONE",
                    confidence=rng.uniform(0.8, 0.98),
                    source_record_id=f"REG-{ph['id'][:8]}",
                    source_record_type="TELECOM_REGISTRY")
            count["owned"] += 1
    for vh in vehicles:
        owner = vh["owner_person_id"]
        if owner and not skip(owner, vh["id"]):
            add_rel(owner, "PERSON", vh["id"], "VEHICLE", "USED_VEHICLE",
                    confidence=rng.uniform(0.8, 0.98),
                    source_record_id=f"RTO-{vh['id'][:8]}",
                    source_record_type="ANPR_REGISTRY")
            count["owned"] += 1
    for ac in accounts:
        owner = ac["owner_person_id"]
        if owner and not skip(owner, ac["id"]):
            add_rel(owner, "PERSON", ac["id"], "BANK_ACCOUNT", "LINKED_TO",
                    confidence=rng.uniform(0.8, 0.98),
                    source_record_id=f"KYC-{ac['id'][:8]}",
                    source_record_type="FINANCIAL")
            count["owned"] += 1
        elif not owner:
            f = org_by_id[rng.choice(front_ids)]
            add_rel(f["id"], "ORGANIZATION", ac["id"], "BANK_ACCOUNT",
                    "OPERATES_ACCOUNT", confidence=rng.uniform(0.7, 0.9),
                    source_record_id=f"KYC-{ac['id'][:8]}",
                    source_record_type="FINANCIAL")
            count["owned"] += 1

    # gang membership
    for pid, (gid, role) in assigned.items():
        add_rel(pid, "PERSON", gid, "GANG", "MEMBER_OF",
                confidence=0.97 if role in ("coordinator", "financier") else rng.uniform(0.85, 0.95),
                source_record_id=f"INT-{gid[:8]}",
                source_record_type="INTELLIGENCE")
        count["gang"] += 1

    associate_pool = [p["id"] for p in persons if p["person_role"] == "associate"]
    rng.shuffle(associate_pool)
    gang_ids = [g["id"] for g in ctx["organizations"]["gangs"]]
    n_members = getattr(config, "NUM_ASSOCIATES_AS_MEMBERS", 450)
    n_employees = getattr(config, "NUM_ORG_EMPLOYEES", 150)
    for pid in associate_pool[:n_members]:
        add_rel(pid, "PERSON", rng.choice(gang_ids), "GANG", "MEMBER_OF",
                confidence=rng.uniform(0.55, 0.8),
                source_record_id=f"INT-{pid[:6]}",
                source_record_type="INTELLIGENCE")
        count["gang"] += 1
    for pid in associate_pool[n_members:n_members + n_employees]:
        f = org_by_id[rng.choice(front_ids)]
        add_rel(pid, "PERSON", f["id"], "ORGANIZATION", "MEMBER_OF",
                confidence=rng.uniform(0.6, 0.85),
                source_record_id=f"HRS-{pid[:6]}",
                source_record_type="EMPLOYMENT")
        count["gang"] += 1

    # accusations + complainants
    victims = [p["id"] for p in persons if p["person_role"] == "victim"]
    witnesses = [p["id"] for p in persons if p["person_role"] == "witness"]
    for idx, case in enumerate(cases):
        acc = accused_per_case[idx]
        for pid in acc:
            add_rel(pid, "PERSON", case["id"], "CASE", "ACCUSED_IN",
                    confidence=rng.uniform(0.8, 0.98),
                    source_record_id=case["case_number"], source_record_type="FIR")
            count["accused"] += 1
        if rng.random() < 0.55 and (victims or witnesses):
            cid = rng.choice(victims + witnesses)
            add_rel(cid, "PERSON", case["id"], "CASE", "REPORTED_CASE",
                    confidence=rng.uniform(0.7, 0.9),
                    source_record_id=case["case_number"], source_record_type="FIR")
            count["accused"] += 1

    # location presence
    district_locs = {}
    for loc in ctx["locations"]["locations"]:
        district_locs.setdefault(loc["district"], []).append(loc["id"])
    hotspot_first = [loc["id"] for loc in ctx["locations"]["locations"]][:40]
    for p in persons:
        d = p["address"].split(", ")[-2]
        candidates = list(district_locs.get(d, [])) or list(loc_by_id)
        picks = rng.sample(candidates, min(rng.randint(1, 2), len(candidates)))
        if rng.random() < 0.25 and hotspot_first:
            picks.append(rng.choice(hotspot_first))
        for lid in picks:
            add_rel(p["id"], "PERSON", lid, "LOCATION", "LOCATED_AT",
                    confidence=rng.uniform(0.55, 0.9), source_record_type="SURVEILLANCE")
            count["located"] += 1

    # social (within-gang + bridges + victim contact)
    gang_members = {}
    for pid, (gid, _r) in assigned.items():
        gang_members.setdefault(gid, []).append(pid)

    for gid, members in gang_members.items():
        coord = next((pid for pid, (g, r) in assigned.items() if g == gid and r == "coordinator"), None)
        for pid in members:
            if coord and pid != coord and rng.random() < 0.6:
                add_rel(pid, "PERSON", coord, "PERSON", "ASSOCIATED_WITH",
                        confidence=rng.uniform(0.8, 0.95), source_record_type="SOCIAL")
                count["social"] += 1
            for _ in range(rng.randint(0, 2)):
                other = rng.choice([m for m in members if m != pid] or [pid])
                if other != pid:
                    add_rel(pid, "PERSON", other, "PERSON", "ASSOCIATED_WITH",
                            confidence=rng.uniform(0.7, 0.92), source_record_type="SOCIAL")
                    count["social"] += 1

    bridges = 0
    gang_list = list(gang_members.keys())
    for pid in associate_pool:
        if bridges >= 70 or len(gang_list) < 2:
            break
        if rng.random() < 0.06:
            g1, g2 = rng.sample(gang_list, 2)
            m1 = gang_members[g1]
            m2 = gang_members[g2]
            for g, m in ((g1, m1), (g2, m2)):
                if m:
                    add_rel(pid, "PERSON", rng.choice(m), "PERSON", "ASSOCIATED_WITH",
                            confidence=rng.uniform(0.6, 0.85), source_record_type="SOCIAL")
                    count["social"] += 1
            bridges += 1

    for idx, case in enumerate(cases):
        acc = accused_per_case[idx]
        if acc and rng.random() < 0.35:
            v = rng.choice(victims + witnesses)
            add_rel(v, "PERSON", rng.choice(acc), "PERSON", "ASSOCIATED_WITH",
                    confidence=rng.uniform(0.5, 0.8), source_record_type="INTERVIEW")
            count["social"] += 1

    # laundering net-level flows: financier accounts -> front accounts
    unowned = [a for a in accounts if not a["owner_person_id"]]
    for gid, members in gang_members.items():
        fins = [pid for pid, (g, r) in assigned.items() if g == gid and r == "financier"]
        if not fins:
            continue
        fin_accts = [ac["id"] for ac in accounts if ac["owner_person_id"] in fins]
        for fac in fin_accts[:4]:
            if unowned and rng.random() < 0.6:
                add_rel(fac, "BANK_ACCOUNT", rng.choice(unowned)["id"], "BANK_ACCOUNT",
                        "FINANCIAL_TRANSFER", confidence=rng.uniform(0.75, 0.95),
                        source_record_type="FINANCIAL")
                count["launder"] += 1

    _build_expansion_edges(ctx, associate_pool)
    ctx["_stats"] = dict(count)
    return ctx


def _build_expansion_edges(ctx, associate_pool):
    """Deliberate 'network expansion' actors: quiet associates who suddenly
    accumulate many new associations near the end of the epoch. The anomaly
    detector later derives SUDDEN_NETWORK_EXPANSION from these real rows."""
    rng = core.rng
    from datetime import datetime, timedelta
    end = datetime.fromisoformat(config.EPOCH_END)
    recent_start = end - timedelta(days=45)
    persons_by_id = ctx["persons"]["persons_by_id"]
    expansion = []
    candidates = [pid for pid in associate_pool
                  if persons_by_id[pid]["person_role"] == "associate"]
    rng.shuffle(candidates)
    for pid in candidates:
        if len(expansion) >= config.NUM_EXPANSION_ANOMALIES:
            break
        # quiet baseline: 0-1 old association
        if rng.random() < 0.6:
            other = rng.choice(associate_pool)
            if other != pid:
                add_rel(pid, "PERSON", other, "PERSON", "ASSOCIATED_WITH",
                        confidence=rng.uniform(0.55, 0.8),
                        first_seen=end - timedelta(days=rng.randint(300, 700)),
                        last_seen=end - timedelta(days=rng.randint(280, 299)),
                        source_record_type="SOCIAL")
        n_new = rng.randint(8, 14)
        targets = rng.sample(associate_pool, min(n_new, len(associate_pool)))
        made = 0
        for other in targets:
            if other == pid:
                continue
            add_rel(pid, "PERSON", other, "PERSON", "ASSOCIATED_WITH",
                    confidence=rng.uniform(0.6, 0.9),
                    first_seen=recent_start + timedelta(days=rng.randint(0, 40)),
                    last_seen=end - timedelta(days=rng.randint(0, 3)),
                    source_record_type="SOCIAL")
            made += 1
        if made >= 6:
            expansion.append({"person_id": pid, "new_edges": made})
    ctx["expansion_persons"] = expansion
    return ctx
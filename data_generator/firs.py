"""FIR narrative generator + entity-mention extraction mirror.

The narratives are written from believable templates that reference *real*
generated entities (accused/complainant names, aliases, phone numbers, vehicle
plates, masked accounts, gangs, locations) and embed the records' own FIR /
CASE numbers, incident dates and legal sections.

``extract_mentions`` is a faithful re-implementation of the DRISHYAM rule-based
extractor (backend/app/nlp/extractor.py). Keeping an identical copy here makes
the generator standalone AND guarantees that what we persist as entity mentions
is exactly what the app would extract from the narrative at runtime. If the app
regexes change, update this module (a comment at the top of the app file flags
the relationship).
"""

import datetime as dt
import re
from datetime import timedelta

import config
import core
from names import CRIME_TYPE_PROFILES, VEHICLE_TYPES, OFFICER_NAMES, DISTRICT_TO_COORD

# --- faithful copy of backend/app/nlp/extractor.py patterns ---------------
PHONE_RE = re.compile(r"\b(?:\+?91[-\s]?)?[6-9]\d{9}\b")
VEHICLE_RE = re.compile(r"\b[A-Z]{2}[-\s]?\d{1,2}[-\s]?[A-Z]{1,2}[-\s]?\d{4}\b")
FIR_RE = re.compile(r"\bFIR[-\s]?\d{2,4}[-\s]?\d{2,6}\b", re.IGNORECASE)
CASE_RE = re.compile(r"\bCASE[-\s]?\d{2,6}\b", re.IGNORECASE)
ACCOUNT_RE = re.compile(r"\b(?:A/C|ACCOUNT|ACC)[-\s#:]*[Xx*]{2,}\d{2,6}\b", re.IGNORECASE)
DATE_RE = re.compile(r"\b\d{1,2}[/-][A-Za-z]{3,9}[/-]?\d{0,4}\b|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b")
ALIAS_TRIGGER_RE = re.compile(r"\b([A-Z][a-z]+)\s+(?:alias|aka|a\.k\.a\.?|@)\s+([A-Z][a-zA-Z]+)\b")
PERSON_CANDIDATE_RE = re.compile(r"\b([A-Z][a-z]{2,}(?:\s[A-Z][a-z]{2,}){0,2})\b")
LEGAL_SECTION_RE = re.compile(r"\b(?:Section|Sec\.?|U/S)\s?\d{2,4}[A-Za-z]?(?:\s?(?:IPC|CrPC|NDPS))?\b", re.IGNORECASE)

STOPWORDS_AS_NAMES = {
    "The", "Central", "Market", "Police", "Station", "Report", "Case", "Fir",
    "Vehicle", "Phone", "Account", "Location", "District", "Gang", "Bank",
    "Transaction", "Investigation", "Surveillance", "Evidence", "Officer",
}
PRONOUNS = {"They", "He", "She", "It", "We", "You", "I", "His", "Her", "Their", "Its"}
ORG_GANG_KEYWORDS = ["gang", "syndicate", "cartel", "organization", "group", "network", "outfit"]
CRIME_TYPE_KEYWORDS = [
    "extortion", "smuggling", "narcotics", "trafficking", "robbery", "murder",
    "kidnapping", "fraud", "cybercrime", "money laundering", "counterfeit",
]


def extract_mentions(text):
    """Mirror of extract_entities(). Returns list of mention dicts."""
    entities = []
    seen_spans = set()

    def add(match_text, etype, conf, start, end, rule):
        key = (start, end)
        if key in seen_spans:
            return
        seen_spans.add(key)
        entities.append({
            "entity_text": match_text.strip(),
            "entity_type": etype,
            "confidence": round(conf, 2),
            "span_start": start,
            "span_end": end,
            "rule": rule,
        })

    for m in ALIAS_TRIGGER_RE.finditer(text):
        add(m.group(1), "PERSON", 0.93, m.start(1), m.end(1), "alias_trigger_pattern")
        add(m.group(2), "ALIAS", 0.9, m.start(2), m.end(2), "alias_trigger_pattern")
    for m in PHONE_RE.finditer(text):
        add(m.group(0), "PHONE", 0.97, m.start(), m.end(), "phone_regex")
    for m in VEHICLE_RE.finditer(text):
        add(m.group(0), "VEHICLE", 0.9, m.start(), m.end(), "vehicle_plate_regex")
    for m in FIR_RE.finditer(text):
        add(m.group(0), "FIR_NUMBER", 0.95, m.start(), m.end(), "fir_regex")
    for m in CASE_RE.finditer(text):
        add(m.group(0), "CASE_NUMBER", 0.95, m.start(), m.end(), "case_regex")
    for m in ACCOUNT_RE.finditer(text):
        add(m.group(0), "BANK_ACCOUNT", 0.85, m.start(), m.end(), "account_regex")
    for m in DATE_RE.finditer(text):
        add(m.group(0), "DATE", 0.8, m.start(), m.end(), "date_regex")
    for m in LEGAL_SECTION_RE.finditer(text):
        add(m.group(0), "LEGAL_SECTION", 0.85, m.start(), m.end(), "legal_section_regex")

    lower_text = text.lower()
    for kw in CRIME_TYPE_KEYWORDS:
        idx = lower_text.find(kw)
        if idx != -1:
            add(text[idx:idx + len(kw)], "CRIME_TYPE", 0.75, idx, idx + len(kw),
                "crime_keyword_gazetteer")

    for m in PERSON_CANDIDATE_RE.finditer(text):
        candidate = m.group(1)
        first_word = candidate.split()[0]
        if candidate in PRONOUNS or first_word in PRONOUNS:
            continue
        if first_word in STOPWORDS_AS_NAMES:
            after = lower_text[m.end():m.end() + 15]
            etype = "ORGANIZATION" if any(k in after for k in ORG_GANG_KEYWORDS) else "LOCATION"
            add(candidate, etype, 0.7, m.start(), m.end(), "capitalized_phrase_heuristic")
            continue
        after = lower_text[m.end():m.end() + 15]
        if any(k in after for k in ORG_GANG_KEYWORDS):
            add(candidate, "GANG" if "gang" in after else "ORGANIZATION", 0.82,
                m.start(), m.end(), "gang_org_suffix_heuristic")
            continue
        add(candidate, "PERSON", 0.78, m.start(), m.end(), "capitalized_name_heuristic")

    entities.sort(key=lambda e: (e["span_start"], e["span_end"]))
    return entities


# --------------------------------------------------------------------------
# resolution
# --------------------------------------------------------------------------
def resolve_mentions(mentions, ctx):
    """Map mention text to generated entity ids where an exact/unique match exists."""
    name_idx = ctx["persons"]["name_index"]
    persons_by_id = ctx["persons"]["persons_by_id"]
    alias_map = ctx["aliases"]["alias_map"]
    phone_by_num = ctx["phones"]["phone_by_num"]
    vehicle_by_reg = ctx["vehicles"]["vehicle_by_reg"]
    acc_by_masked = ctx["accounts"]["acc_by_masked"]
    gang_names = {g["name"].lower(): g["id"] for g in ctx["organizations"]["gangs"]}
    org_names = {o["name"].lower(): o["id"] for o in ctx["organizations"]["gangs"] + ctx["organizations"]["fronts"]}
    loc_by_name = {l["name"].lower(): l["id"] for l in ctx["locations"]["locations"]}

    # single-token first-name index for PERSON partials
    first_names = {}
    for pid, person in persons_by_id.items():
        first = person["full_name"].split()[0].strip(".").lower()
        first_names.setdefault(first, []).append(pid)
    for pid, person in persons_by_id.items():
        if person["full_name"].count(" ") >= 1:
            rest = person["full_name"].split()[-1].strip(".").lower()
            first_names.setdefault(rest, []).append(pid)

    resolved = []
    for mt in mentions:
        rid = None
        text_l = mt["entity_text"].strip().lower()
        etype = mt["entity_type"]
        if etype == "PERSON":
            hits = name_idx.get(text_l, [])
            if hits:
                rid = hits[0]
            else:
                token = text_l.split()[0]
                poses = first_names.get(token, [])
                if len(poses) == 1:
                    rid = poses[0]
        elif etype == "ALIAS":
            a = alias_map.get(text_l)
            if a:
                rid = a["person_id"]
        elif etype == "PHONE":
            ph = phone_by_num.get(mt["entity_text"].strip())
            if ph:
                rid = ph["id"]
        elif etype == "VEHICLE":
            vh = vehicle_by_reg.get(mt["entity_text"])
            if vh:
                rid = vh["id"]
        elif etype == "BANK_ACCOUNT":
            # "A/C XXXX7788" -> "XXXX7788"
            m = re.search(r"(XXXX\d{4}|\*{4}\d{4}|\d{4})", mt["entity_text"])
            masked = re.sub(r"[^\d]", "", mt["entity_text"]).rjust(8, "X")
            masked = "XXXX" + masked[-4:]
            acc = acc_by_masked.get(masked)
            if acc is None and m:
                acc = acc_by_masked.get("XXXX" + m.group(1)[-4:])
            if acc:
                rid = acc["id"]
        elif etype == "GANG":
            rid = gang_names.get(text_l)
        elif etype in ("ORGANIZATION", "LOCATION"):
            rid = org_names.get(text_l) or loc_by_name.get(text_l)

        mt["resolved_entity_id"] = rid
        resolved.append(mt)
    return resolved


# --------------------------------------------------------------------------
# narrative composition
# --------------------------------------------------------------------------
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug",
          "Sep", "Oct", "Nov", "Dec"]


def _dmy(d):
    return f"{d.day:02d}-{MONTHS[d.month - 1]}-{d.year}"


def _digits(d):
    return f"{d.day:02d}/{d.month:02d}/{d.year}"


def build_narrative(ctx, case, accused, complainant, location, incident_day,
                    fir_no, gang_name):
    rng = core.rng
    profile = CRIME_TYPE_PROFILES.get(case["crime_type"], CRIME_TYPE_PROFILES["fraud"])
    lo, hi = profile["amount_range"]
    amount = round(rng.uniform(lo, hi))
    sections = profile["sections"]
    section = rng.choice(sections)
    officer = rng.choice(OFFICER_NAMES).lower()
    a1, a2 = accused[0], accused[1] if len(accused) > 1 else accused[0]
    a1_name = a1["full_name"]
    a2_name = a2["full_name"]
    c_name = complainant["full_name"]
    loc_name = location["name"]
    district = case["district"]
    # find real assets for flavour
    phones = ctx["phones"]["phones"]
    ph = next((p["number"] for p in phones if p["owner_person_id"] == a1["id"]), None)
    if ph is None and complainant:
        ph = next((p["number"] for p in phones if p["owner_person_id"] == complainant["id"]), None)
    vh = next((v["registration_number"] for v in ctx["vehicles"]["vehicles"]
               if v["owner_person_id"] == a1["id"]), None)
    alias = next((al["alias_name"] for al in ctx["aliases"]["aliases"]
                  if al["person_id"] == a1["id"]), None)
    acc = next((ac for ac in ctx["accounts"]["accounts"]
                if ac["owner_person_id"] == a1["id"] or ac["owner_person_id"] == a2["id"]), None)

    gph = ph or f"{rng.randint(6, 9)}{''.join(str(rng.randint(0, 9)) for _ in range(9))}"
    gvh = vh or f"TN{rng.choice(['01','38','58','27'])} "
    if not vh:
        gvh += f"{''.join(rng.choice('ABCDEFGHJKLMNPRSTUVWXYZ') for _ in range(2))} {rng.randint(1000, 9999)}"

    d1 = _dmy(incident_day)
    d2 = _digits(incident_day - timedelta(days=rng.randint(1, 9)))
    d3 = _dmy(incident_day + timedelta(days=rng.randint(1, 12)))

    if case["crime_type"] == "money laundering":
        masked = acc["account_number_masked"] if acc else "XXXX7788"
        template = (
            "Complainant {c}, resident of {district}, stated under Section 154 CrPC that between {d1} and {d3}, "
            "{a1} (alias {alias}) and {a2}, acting for {gang_name} gang, induced deposits into A/C {masked} and "
            "layered the proceeds through multiple accounts. On {d2} a sum of Rs. {amount} was routed from the said "
            "A/C {masked} to a shell entity. Suspects used phone {gph} to co-ordinate transfers with accomplices. "
            "{a1} was last seen near {loc_name} in a vehicle bearing registration {gvh}. FIR Number {fir_no} "
            "registered under Case Number {case_no} for offences under {section} and Section 120B IPC. "
            "investigation flagging the transaction trail to {officer} of the financial forensic unit."
        )
    elif case["crime_type"] == "cybercrime":
        template = (
            "On {d1} complainant {c} lodged a complaint of unauthorized digital transactions at {loc_name}, "
            "{district}. The accused {a1} (alias {alias}) and {a2} obtained OTPs via fraudulent calls from "
            "phone {gph}, drained A/C XXXX5123 and transferred funds to controlled mule accounts. On {d2} the "
            "suspect used vehicle registration {gvh} near the cyber park exit. FIR Number {fir_no} under Case "
            "Number {case_no}, offences under {section} read with Section 66D IT Act. The matter was assigned to "
            "{officer}."
        )
    elif case["crime_type"] in ("smuggling", "narcotics trafficking"):
        template = (
            "Based on secret intelligence, on {d1} a consignment was intercepted at {loc_name}, {district}. "
            "Complainant {c} identified {a1} (alias {alias}) and {a2} as the handlers coordinating with {gang_name} "
            "gang operatives. On {d2} both suspects were observed near the godown; {a1} arrived in vehicle "
            "registration {gvh} and communicated with the group using phone {gph}. Contraband valuation is "
            "assessed at Rs. {amount}. FIR Number {fir_no} under Case Number {case_no} was registered; offences "
            "under {section} are being investigated by {officer}."
        )
    elif case["crime_type"] == "extortion":
        template = (
            "Complainant {c} reported at {loc_name} police station in {district} on {d1} that {a1} (alias "
            "{alias}) and {a2} of the {gang_name} gang demanded a periodic levy of Rs. {amount} and threatened "
            "consequences on refusal. On {d2}, {a1} called complainant twice from phone {gph} and repeated the "
            "demand, warning of seizure. The accused were last seen departing in vehicle registration {gvh}. "
            "FIR Number {fir_no} registered under Case Number {case_no}; offences under {section} and 506(2) IPC "
            "shall be investigated. Investigating officer: {officer}."
        )
    elif case["crime_type"] == "robbery":
        template = (
            "On {d2} at around 21:00 hrs complainant {c} was waylaid at {loc_name}, {district}, by {a1} "
            "(alias {alias}) and {a2}, members of the {gang_name} gang, who relieved him of cash and valuables "
            "worth Rs. {amount} at knifepoint. {a1} was identified through his phone {gph} and the getaway "
            "vehicle registration {gvh} recovered on {d3}. FIR Number {fir_no} under Case Number {case_no}; "
            "offences under {section} registered. Investigation entrusted to {officer}."
        )
    elif case["crime_type"] == "murder":
        template = (
            "On {d2} the body of a victim was recovered near {loc_name}, {district}. Enquiry revealed that "
            "{a1} (alias {alias}) and {a2} were last seen with the deceased on {d1} in vehicle registration "
            "{gvh}. Cell tower data links phone {gph} to the scene around the time of the incident. Intercepted "
            "communications reference the {gang_name} gang. FIR Number {fir_no} under Case Number {case_no} for "
            "offences under {section} and 120B IPC. Investigation by {officer}."
        )
    elif case["crime_type"] == "vehicle theft":
        template = (
            "Complainant {c} reported on {d1} the theft of his vehicle from {loc_name}, {district}, on {d2}. "
            "ANPR caught registration {gvh} on the bypass; {a1} (alias {alias}) and {a2} were identified via "
            "phone {gph} and CCTV of {loc_name}. Stolen parts worth Rs. {amount} were recovered. FIR Number "
            "{fir_no} under Case Number {case_no}, offences under {section} and 411 IPC. Investigation: {officer}."
        )
    else:
        template = (
            "Complainant {c} lodged a report at {loc_name}, {district}, on {d1} alleging that {a1} (alias "
            "{alias}) and {a2} engaged in {crime} on {d2}, causing loss assessed at Rs. {amount}. {a1} contacted "
            "complainant from phone {gph} and the accused were observed in vehicle registration {gvh} near "
            "{loc_name} on {d3}. The {gang_name} gang is suspected of involvement. FIR Number {fir_no} under Case "
            "Number {case_no}; offences under {section} registered. Investigation entrusted to {officer}."
        )

    return template.format(
        c=c_name, district=district, a1=a1_name, alias=alias or "Silk",
        a2=a2_name, gang_name=gang_name or "an organized", gph=gph, gvh=gvh,
        loc_name=loc_name, amount=amount, d1=d1, d2=d2, d3=d3,
        fir_no=fir_no, case_no=case["case_number"], section=section,
        crime=case["crime_type"], officer=officer, masked=masked if "masked" in locals() else "XXXX7788",
    )


def generate(ctx):
    rng = core.rng
    persons = ctx["persons"]["persons"]
    persons_by_id = ctx["persons"]["persons_by_id"]
    g_names = {g["id"]: g["name"] for g in ctx["organizations"]["gangs"]}
    victims = [p for p in persons if p["person_role"] == "victim"]
    witnesses = [p for p in persons if p["person_role"] == "witness"]
    complainants = victims + witnesses
    accused_per_case = ctx["cases"]["accused_per_case"]
    location_districts = {}
    for l in ctx["locations"]["locations"]:
        location_districts.setdefault(l["district"], []).append(l)
    fir_index = 0
    gang_members = {}
    for pid, (gid, _r) in ctx["persons"]["assigned"].items():
        gang_members.setdefault(gid, []).append(pid)

    total = 0
    for cidx, case in enumerate(ctx["cases"]["cases"]):
        nfirs = 1
        if rng.random() < 0.12:
            nfirs = 2
        if rng.random() < 0.02:
            nfirs = 3
        loc_pool = location_districts.get(case["district"]) or ctx["locations"]["locations"]
        acc = accused_per_case[cidx]
        accused_objs = [persons_by_id[a] for a in acc if a in persons_by_id]
        complainant = rng.choice(complainants) if complainants else None
        # pick the gang whose members dominate the accused (for gang context)
        gang_name = None
        affiliated = [pid for pid in acc if pid in ctx["persons"]["assigned"]]
        if affiliated:
            gid = ctx["persons"]["assigned"][affiliated[0]][0]
            gang_name = g_names.get(gid)
        incident_day = case["opened_at"] - timedelta(days=rng.randint(1, 40))
        if incident_day.tzinfo:
            incident_day = incident_day.replace(tzinfo=None)
        filed_at = case["opened_at"] if not incident_day.tzinfo else case["opened_at"].replace(tzinfo=None)

        for k in range(nfirs):
            if total >= config.NUM_FIRS:
                break
            location = rng.choice(loc_pool)
            fir_index += 1
            fir_no = f"FIR-{filed_at.year}-{fir_index:04d}"
            narrative = build_narrative(ctx, case, accused_objs, complainant,
                                        location, incident_day, fir_no, gang_name)
            mentions = extract_mentions(narrative)
            resolved = resolve_mentions(mentions, ctx)

            fir = {
                "id": core.next_id("FR"),
                "fir_number": fir_no,
                "case_id": case["id"],
                "narrative_text": narrative,
                "filed_at": filed_at,
                "location_id": location["id"],
                "data_source": config.DATA_SOURCE,
                "created_at": core.now_utc(),
            }
            core.add_row("firs", fir)
            for mt in resolved:
                core.add_row("entity_mentions", {
                    "id": core.next_id("EM"),
                    "source_record_id": fir["id"],
                    "source_record_type": "FIR",
                    "entity_text": mt["entity_text"],
                    "entity_type": mt["entity_type"],
                    "confidence": mt["confidence"],
                    "span_start": mt["span_start"],
                    "span_end": mt["span_end"],
                    "extraction_model": "drishyam-ner-v1",
                    "resolved_entity_id": mt["resolved_entity_id"],
                    "created_at": core.now_utc(),
                })
            total += 1

    # ensure pre-seeded (signature) FIRs also carry entity mentions
    mentioned_firs = {m["source_record_id"] for m in core.DATA["entity_mentions"]}
    for fir in core.DATA["firs"]:
        if fir["id"] in mentioned_firs:
            continue
        mentions = extract_mentions(fir["narrative_text"])
        resolved = resolve_mentions(mentions, ctx)
        for mt in resolved:
            core.add_row("entity_mentions", {
                "id": core.next_id("EM"),
                "source_record_id": fir["id"],
                "source_record_type": "FIR",
                "entity_text": mt["entity_text"],
                "entity_type": mt["entity_type"],
                "confidence": mt["confidence"],
                "span_start": mt["span_start"],
                "span_end": mt["span_end"],
                "extraction_model": "drishyam-ner-v1",
                "resolved_entity_id": mt["resolved_entity_id"],
                "created_at": core.now_utc(),
            })
        mentioned_firs.add(fir["id"])

    ctx["_firs"] = {"count": total, "mentions": len(core.DATA["entity_mentions"])}
    return ctx
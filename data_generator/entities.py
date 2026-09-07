"""Entity generators: persons, aliases, organizations (gangs + front companies),
locations, phones, vehicles, financial accounts and crime cases.

Ends by returning a `context` dict of lookup structures consumed by the
relationship / call / transaction / FIR / evidence generators so every edge,
narrative and exhibit references real, cross-checked synthetic entities.
"""

from datetime import datetime, timedelta

import config
import core
from names import (
    DISTRICTS, DISTRICT_TO_COORD, GANG_NAMES, ORG_FRONT_NAMES, CRIME_TYPES,
    CRIME_TYPE_PROFILES, VEHICLE_TYPES, VEHICLE_COLORS, RTO_BY_DISTRICT,
    AREA_NAMES, PLACE_SUFFIXES, STREET_NAMES, PS_SUFFIXES, BANKS,
)

START = datetime.fromisoformat(config.EPOCH_START)
END = datetime.fromisoformat(config.EPOCH_END)


def _rand_datetime(lo=START, hi=END):
    span = int((hi - lo).total_seconds())
    return lo + timedelta(seconds=core.rng.randint(0, span))


def _unique_number(seen, gen):
    while True:
        n = gen()
        if n not in seen:
            seen.add(n)
            return n


# --------------------------------------------------------------------------
# locations
# --------------------------------------------------------------------------
def make_locations():
    rows = []
    preferred = ["Chennai", "Coimbatore", "Madurai", "Salem", "Vellore",
                 "Tiruchchirappalli", "Chengalpattu", "Thoothukudi",
                 "Thanjavur", "Erode", "Kancheepuram", "Tiruppur"]
    weights = [0.16, 0.14, 0.14, 0.08, 0.07, 0.07, 0.07, 0.06, 0.05, 0.05,
               0.05, 0.04]
    others = [d for d, _, _ in DISTRICTS if d not in preferred]
    others_weight = 1.0 / max(1, len(others))
    rows_by_district = {d: [] for d, _, _ in DISTRICTS}

    for _ in range(config.NUM_LOCATIONS):
        if core.rng.random() < 0.84 and preferred:
            district = core.weighted_choice(preferred, weights)
        else:
            district = core.rng.choice(others)
        area = core.rng.choice(AREA_NAMES)
        suffix = core.rng.choice(PLACE_SUFFIXES)
        name = f"{area} {suffix}"
        lat0, lon0 = DISTRICT_TO_COORD[district]
        lat = round(lat0 + core.rng.uniform(-0.18, 0.18), 6)
        lon = round(lon0 + core.rng.uniform(-0.18, 0.18), 6)
        loc = {
            "id": core.next_id("LOC"),
            "name": name,
            "district": district,
            "latitude": lat,
            "longitude": lon,
            "data_source": config.DATA_SOURCE,
            "created_at": core.now_utc(),
        }
        rows.append(loc)
        rows_by_district[district].append(loc)

    # guarantee at least one police-station style location per heavily used district
    for district in ["Chennai", "Coimbatore", "Madurai", "Salem"]:
        if rows_by_district[district]:
            loc = rows_by_district[district][0]
            loc["name"] = f"{loc['name'].split()[0]} {core.rng.choice(PS_SUFFIXES)}"

    loc_by_id = {r["id"]: r for r in rows}
    combined = []
    for d, _, _ in DISTRICTS:
        combined.extend(rows_by_district[d])
    # resequence so ids stay deterministic order (rows list kept in insert order)
    core.DATA["locations"] = rows
    return {"locations": rows, "loc_by_id": loc_by_id}


# --------------------------------------------------------------------------
# organizations
# --------------------------------------------------------------------------
def make_organizations():
    gang_ids, front_ids = [], []
    for i in range(config.NUM_GANGS):
        g = {
            "id": core.next_id("ORG"),
            "name": GANG_NAMES[i % len(GANG_NAMES)],
            "org_type": "gang",
            "data_source": config.DATA_SOURCE,
            "created_at": core.now_utc(),
        }
        core.add_row("organizations", g)
        gang_ids.append(g)
    for i in range(config.NUM_ORG_FRONTS):
        f = {
            "id": core.next_id("ORG"),
            "name": ORG_FRONT_NAMES[i % len(ORG_FRONT_NAMES)],
            "org_type": "organization",
            "data_source": config.DATA_SOURCE,
            "created_at": core.now_utc(),
        }
        core.add_row("organizations", f)
        front_ids.append(f)
    by_id = {g["id"]: g for g in gang_ids + front_ids}
    return {"gangs": gang_ids, "fronts": front_ids, "org_by_id": by_id}


# --------------------------------------------------------------------------
# persons
# --------------------------------------------------------------------------
def _risk_for(role, criminal_tier=None):
    r = core.rng
    if role == "criminal":
        if criminal_tier == "core":
            return r.choices(["high", "medium", "low", "unknown"],
                             [0.45, 0.42, 0.09, 0.04])[0]
        return r.choices(["medium", "low", "high", "unknown"],
                         [0.50, 0.38, 0.08, 0.04])[0]
    if role == "associate":
        return r.choices(["low", "medium", "high", "unknown"],
                         [0.60, 0.30, 0.05, 0.05])[0]
    if role == "victim":
        return r.choices(["low", "medium", "unknown"], [0.92, 0.05, 0.03])[0]
    return r.choices(["low", "medium", "high", "unknown"],
                     [0.80, 0.12, 0.03, 0.05])[0]


def _make_person(role, tier=None):
    name = core.faker.name()
    gender = core.weighted_choice(["male", "female"], [0.62, 0.38]) if role != "criminal" \
        else core.weighted_choice(["male", "female"], [0.88, 0.12])
    dob = core.faker.date_of_birth(minimum_age=19, maximum_age=71)
    dob_s = dob.strftime("%Y-%m-%d")
    street = f"{core.rng.randint(1, 420)}, {core.rng.choice(STREET_NAMES)}"
    district = core.rng.choice([d for d, _, _ in DISTRICTS])
    area = core.rng.choice(AREA_NAMES)
    address = f"{street}, {area}, {district}, Tamil Nadu {core.rng.randint(600001, 639999)}"
    return {
        "id": core.next_id("P"),
        "full_name": name,
        "person_role": role,
        "dob": dob_s,
        "gender": gender,
        "address": address,
        "risk_band": _risk_for(role, tier),
        "data_source": config.DATA_SOURCE,
        "created_at": core.now_utc(),
    }


def make_persons(org_ctx):
    rng = core.rng
    gangs = org_ctx["gangs"]
    num_criminals = int(config.NUM_PERSONS * config.CRIMINAL_RATIO)
    num_associates = int(config.NUM_PERSONS * config.ASSOCIATE_RATIO)
    num_victims = int(config.NUM_PERSONS * config.VICTIM_RATIO)
    num_witnesses = config.NUM_PERSONS - num_criminals - num_associates - num_victims

    member_slots = []
    for g in gangs:
        size = rng.randint(config.GANG_MIN_SIZE, config.GANG_MAX_SIZE)
        member_slots.append((g, size))

    # assign leaders + roles within each gang
    gang_roles = {}  # gang_id -> {"coordinator": [..], "financier": [..], ...}
    assigned = {}    # person_id -> (gang_id, tier, role)
    person_rows = []
    used_names = set()

    for g, size in member_slots:
        roles_for_gang = {
            "coordinator": 1,
            "financier": 1 if rng.random() < 0.6 else 2,
            "enforcer": rng.randint(2, 5),
            "courier": rng.randint(1, 4),
            "driver": rng.randint(1, 4),
        }
        filled = sum(roles_for_gang.values())
        roles_for_gang["member"] = max(0, size - filled)
        gang_roles[g["id"]] = roles_for_gang
        tier = {"coordinator": "core", "financier": "core", "enforcer": "core"}
        for role, cnt in roles_for_gang.items():
            for _ in range(cnt):
                p = _make_person("criminal", tier.get(role, None))
                while p["full_name"] in used_names:
                    p["full_name"] = core.faker.name()
                used_names.add(p["full_name"])
                person_rows.append(p)
                gang_roles[g["id"]][role]  # keep
                assigned[p["id"]] = (g["id"], role)

    # remaining criminals not tied to a gang (independent operators)
    remaining_criminals = num_criminals - len(assigned)
    for _ in range(max(0, remaining_criminals)):
        p = _make_person("criminal")
        while p["full_name"] in used_names:
            p["full_name"] = core.faker.name()
        used_names.add(p["full_name"])
        person_rows.append(p)

    for _ in range(num_associates):
        p = _make_person("associate")
        while p["full_name"] in used_names:
            p["full_name"] = core.faker.name()
        used_names.add(p["full_name"])
        person_rows.append(p)

    for _ in range(num_victims):
        p = _make_person("victim")
        while p["full_name"] in used_names:
            p["full_name"] = core.faker.name()
        used_names.add(p["full_name"])
        person_rows.append(p)

    for _ in range(num_witnesses):
        p = _make_person("witness")
        while p["full_name"] in used_names:
            p["full_name"] = core.faker.name()
        used_names.add(p["full_name"])
        person_rows.append(p)

    # associates are then partially linked to gangs in relationships.py via
    # the `gang_aware` side table - keep mapping here
    for p in person_rows:
        core.add_row("persons", p)

    persons_by_id = {p["id"]: p for p in person_rows}
    name_index = {}
    for p in person_rows:
        name_index.setdefault(p["full_name"].lower(), []).append(p["id"])

    return {
        "persons": person_rows,
        "persons_by_id": persons_by_id,
        "name_index": name_index,
        "assigned": assigned,          # person_id -> (gang_id, role)
        "gang_roles": gang_roles,
        "rng": rng,
    }


# --------------------------------------------------------------------------
# aliases
# --------------------------------------------------------------------------
def make_aliases(person_ctx):
    rng = core.rng
    rows = []
    candidates = [p for p in person_ctx["persons"]
                  if p["person_role"] in ("criminal", "associate") and rng.random() < 0.55]
    alias_pools = {
        "criminal": ["Raja", "Bhai", "Pickle", "Killer", "Bommi", "Rowdy",
                     "Machaan", "Dada", "Pattasu", "Vikram", "Jango", "Blackie",
                     "Chotta", "Jacket", "Silk", "Sathya", "Boss", "Kuberan",
                     "Thalapathi", "Machan"],
        "associate": ["Surya", "Kutti", "Pinky", "Bala", "Ravi", "Manja",
                      "Thumbi", "Sunny", "Kuttappa", "Chinna", "Motta", "Velu"],
    }
    budget = config.NUM_ALIASES
    for p in candidates:
        if budget <= 0:
            break
        pool = alias_pools[p["person_role"]]
        n = min(rng.randint(1, 3), budget)
        budget -= n
        for _ in range(n):
            rows.append({
                "id": core.next_id("AL"),
                "person_id": p["id"],
                "alias_name": rng.choice(pool) + str(rng.randint(10, 99)),
                "created_at": core.now_utc(),
            })
    for r in rows:
        core.add_row("aliases", r)
    alias_map = {a["alias_name"].lower(): a for a in rows}
    return {"aliases": rows, "alias_map": alias_map}


# --------------------------------------------------------------------------
# phones / vehicles / accounts
# --------------------------------------------------------------------------
def make_phones(person_ctx):
    seen = set()

    def gen_number():
        return f"{core.rng.randint(6, 9)}{''.join(str(core.rng.randint(0, 9)) for _ in range(9))}"

    rows = []

    def give_phone(person):
        num = _unique_number(seen, gen_number)
        rows.append({
            "id": core.next_id("PH"),
            "number": num,
            "owner_person_id": person["id"],
            "data_source": config.DATA_SOURCE,
            "created_at": core.now_utc(),
        })

    rng = core.rng
    n = 0
    for p in person_ctx["persons"]:
        role = p["person_role"]
        if role == "criminal":
            if p["id"] in person_ctx["assigned"]:
                gang_id, role_in_gang = person_ctx["assigned"][p["id"]]
                mult = 2 if role_in_gang == "coordinator" else (2 if rng.random() < 0.18 else 1)
            else:
                mult = 1 if rng.random() < 0.75 else 2
            for _ in range(mult):
                give_phone(p)
                n += 1
        elif role == "associate" and rng.random() < 0.5:
            give_phone(p); n += 1
        elif role in ("victim", "witness") and rng.random() < 0.35:
            give_phone(p); n += 1

    # burners: coordinators get a spare extra
    for p in person_ctx["persons"]:
        if n >= config.NUM_PHONES:
            break
        if p["id"] in person_ctx["assigned"]:
            gid, roleg = person_ctx["assigned"][p["id"]]
            if roleg in ("coordinator", "financier") and rng.random() < 0.5:
                give_phone(p)
                n += 1

    for r in rows:
        core.add_row("phones", r)
    phone_by_num = {r["number"]: r for r in rows}
    return {"phones": rows, "phone_by_num": phone_by_num}


def make_vehicles(person_ctx):
    rng = core.rng
    seen = set()

    def plate_for(district):
        prefix = RTO_BY_DISTRICT.get(district, "38")
        series = f"TN{prefix} {''.join(rng.choice('ABCDEFGHJKLMNPRSTUVWXYZ') for _ in range(2))} " \
                 f"{rng.randint(1000, 9999)}"
        return series

    rows = []

    def give_vehicle(person):
        district = rng.choice([d for d, _, _ in DISTRICTS])
        reg = _unique_number(seen, lambda: plate_for(district))
        vtype = rng.choices(*list(zip(*VEHICLE_TYPES)))[0]
        rows.append({
            "id": core.next_id("VH"),
            "registration_number": reg,
            "owner_person_id": person["id"],
            "vehicle_type": vtype,
            "data_source": config.DATA_SOURCE,
            "created_at": core.now_utc(),
        })

    n = 0
    for p in person_ctx["persons"]:
        role = p["person_role"]
        if role == "criminal":
            give = rng.random() < 0.62
            if p["id"] in person_ctx["assigned"]:
                gid, roleg = person_ctx["assigned"][p["id"]]
                if roleg in ("driver", "coordinator"):
                    give = True
            if give:
                give_vehicle(p); n += 1
        elif role == "associate" and rng.random() < 0.28:
            give_vehicle(p); n += 1
        elif role in ("victim", "witness") and rng.random() < 0.16:
            give_vehicle(p); n += 1

    for r in rows:
        core.add_row("vehicles", r)
    vehicle_by_reg = {r["registration_number"]: r for r in rows}
    return {"vehicles": rows, "vehicle_by_reg": vehicle_by_reg}


def make_accounts(person_ctx, org_ctx):
    rng = core.rng
    seen = set()

    def gen_masked():
        return f"XXXX{core.rng.randint(1000, 9999) if False else core.rng.randint(1000, 9999)}"

    rows = []

    def acc_for(person, bank=None):
        masked = _unique_number(seen, lambda: f"XXXX{core.rng.randint(1000, 9999)}")
        rows.append({
            "id": core.next_id("AC"),
            "account_number_masked": masked,
            "owner_person_id": person["id"],
            "bank_name": bank or rng.choice(BANKS),
            "data_source": config.DATA_SOURCE,
            "created_at": core.now_utc(),
        })

    n = 0
    for p in person_ctx["persons"]:
        role = p["person_role"]
        if role == "criminal":
            count = 1
            if p["id"] in person_ctx["assigned"]:
                gid, roleg = person_ctx["assigned"][p["id"]]
                if roleg == "financier":
                    count = rng.randint(2, 3)
                elif roleg == "coordinator":
                    count = 2
            for _ in range(count):
                acc_for(p); n += 1
        elif role == "associate" and rng.random() < 0.3:
            acc_for(p); n += 1
        elif role in ("victim", "witness") and rng.random() < 0.2:
            acc_for(p); n += 1

    # front-company accounts (unowned by person -> laundering sinks)
    for i, f in enumerate(org_ctx["fronts"]):
        if n >= config.NUM_ACCOUNTS:
            break
        for _ in range(rng.randint(1, 3)):
            rows.append({
                "id": core.next_id("AC"),
                "account_number_masked": _unique_number(
                    seen, lambda: f"XXXX{core.rng.randint(1000, 9999)}"),
                "owner_person_id": None,
                "bank_name": rng.choice(BANKS),
                "data_source": config.DATA_SOURCE,
                "created_at": core.now_utc(),
            })
            n += 1
        # link front account to front org structurally in relationships.py

    for r in rows:
        core.add_row("financial_accounts", r)
    acc_by_masked = {r["account_number_masked"]: r for r in rows}
    return {"accounts": rows, "acc_by_masked": acc_by_masked}


# --------------------------------------------------------------------------
# crime cases
# --------------------------------------------------------------------------
CASE_TITLE_TEMPLATES = [
    "Operation {op} — {crime} probe ({district})",
    "{crime} racket dismantled in {district}",
    "{crime} syndicate linked to {gang}",
    "Investigation into {crime} at {area}",
    "{crime} corridor case — {district}",
]

OP_NAMES = ["Cobra", "Bluewater", "Northwind", "Redline", "Silverhawk",
            "Grayshield", "Ebonwing", "Bluefin", "Starlit", "Hardcourt",
            "Thunderstrike", "Blackpeak", "Windchime", "Sandstorm", "Ironbite"]


def make_cases(person_ctx):
    rng = core.rng
    preferred = ["Chennai", "Coimbatore", "Madurai", "Salem", "Vellore",
                 "Tiruchchirappalli", "Chengalpattu", "Erode", "Thanjavur",
                 "Kancheepuram", "Thoothukudi"]
    weights = [0.15, 0.13, 0.13, 0.08, 0.07, 0.07, 0.07, 0.05, 0.05, 0.05, 0.04]
    others = [d for d, _, _ in DISTRICTS if d not in preferred]
    crime_w, crime_t = list(zip(*[
        (0.15, "extortion"), (0.12, "smuggling"), (0.12, "narcotics trafficking"),
        (0.11, "robbery"), (0.10, "cybercrime"), (0.10, "money laundering"),
        (0.08, "murder"), (0.07, "vehicle theft"), (0.06, "counterfeiting"),
        (0.05, "kidnapping"), (0.04, "fraud"),
    ]))
    rows = []
    accused_per_case = []  # parallel list: person_ids per case
    for i in range(config.NUM_CASES):
        district = rng.choices(preferred + others, weights + [0.003] * len(others))[0] \
            if rng.random() < 0.87 else rng.choice(preferred + others)
        crime = rng.choices(crime_t, crime_w)[0]
        status = rng.choices(["open", "under_investigation", "closed"],
                             [0.55, 0.30, 0.15])[0]
        gang = None
        if crime in ("extortion", "smuggling", "narcotics trafficking",
                     "money laundering", "counterfeiting") and \
           rng.random() < 0.55 and person_ctx and person_ctx["gang_roles"]:
            gang = rng.choice(list(person_ctx["gang_roles"].keys()))
        opened = _rand_datetime()
        area = rng.choice(AREA_NAMES)
        title = CASE_TITLE_TEMPLATES[i % len(CASE_TITLE_TEMPLATES)].format(
            op=rng.choice(OP_NAMES), crime=crime.title(), district=district,
            gang=(person_ctx and {g["id"]: g["name"] for g in person_ctx.get("gangs", [])}
                  .get(gang, "") if gang else ""), area=area)
        if not gang:
            title = title.replace(f" linked to ", f" in " if "linked" in title else "")
        case = {
            "id": core.next_id("CS"),
            "case_number": f"CASE-{i + 1:04d}",
            "title": title,
            "crime_type": crime,
            "district": district,
            "status": status,
            "opened_at": opened,
            "data_source": config.DATA_SOURCE,
            "created_at": core.now_utc(),
        }
        rows.append(case)

        # choose accused
        pool = [p["id"] for p in person_ctx["persons"] if p["person_role"] == "criminal"]
        assoc_pool = [p["id"] for p in person_ctx["persons"] if p["person_role"] == "associate"]
        n_acc = rng.randint(2, 6)
        if gang:
            members = [pid for pid, (gid, _rol) in person_ctx["assigned"].items() if gid == gang]
            chosen = rng.sample(members, min(n_acc - 1, len(members))) if members else []
            fill = rng.sample([x for x in pool if x not in chosen],
                              max(0, n_acc - 1 - len(chosen)))
            chosen = (chosen + fill)[:n_acc]
        else:
            chosen = rng.sample(pool, min(n_acc - 1, len(pool)))
            if rng.random() < 0.25 and assoc_pool:
                chosen.append(rng.choice(assoc_pool))
            chosen = chosen[:n_acc]
        accused_per_case.append(chosen)

    for r in rows:
        core.add_row("crime_cases", r)
    ctx = {
        "cases": rows,
        "cases_by_id": {r["id"]: r for r in rows},
        "cases_by_number": {r["case_number"]: r for r in rows},
        "accused_per_case": accused_per_case,
    }
    return ctx


def generate(org_ctx=None):
    ctx = {}
    ctx["locations"] = make_locations()
    ctx["organizations"] = org_ctx or make_organizations()
    ctx["persons"] = make_persons(ctx["organizations"])
    ctx["aliases"] = make_aliases(ctx["persons"])
    ctx["phones"] = make_phones(ctx["persons"])
    ctx["vehicles"] = make_vehicles(ctx["persons"])
    ctx["accounts"] = make_accounts(ctx["persons"], ctx["organizations"])
    ctx["cases"] = make_cases(ctx["persons"])
    return ctx
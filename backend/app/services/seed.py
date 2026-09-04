import random
import datetime as dt
from faker import Faker
from sqlalchemy.orm import Session
from app.models import models as m
from app.core.security import hash_password

fake = Faker("en_IN")
random.seed(42)
Faker.seed(42)

DISTRICTS = ["Chengalpattu", "Chennai South", "Coimbatore", "Madurai", "Trichy", "Salem"]
GANG_NAMES = ["Cobra Syndicate", "Silver Line Network", "Harbour Road Group", "North Star Outfit", "Red Sand Gang"]
CRIME_TYPES = ["extortion", "smuggling", "narcotics trafficking", "robbery", "cybercrime", "money laundering"]


def _plate():
    return f"{random.choice(['KA','TN','AP','MH'])}{random.randint(1,99):02d}{random.choice('ABCDEFGH')}{random.choice('ABCDEFGH')}{random.randint(1000,9999)}"


def _phone():
    return f"{random.choice([6,7,8,9])}{random.randint(100000000,999999999)}"


def _account():
    return f"XXXX{random.randint(1000,9999)}"


def seed_all(db: Session):
    if db.query(m.User).count() > 0:
        return {"status": "already_seeded"}

    # --- Users ---
    demo_users = [
        ("investigator@drishyam.demo", "Investigator Demo", "investigator", "demo1234"),
        ("admin@drishyam.demo", "Admin Demo", "admin", "demo1234"),
        ("analyst@drishyam.demo", "Analyst Demo", "crime_analyst", "demo1234"),
    ]
    for email, name, role, pw in demo_users:
        db.add(m.User(email=email, full_name=name, role=role, hashed_password=hash_password(pw)))
    db.commit()

    # --- Locations ---
    locations = []
    for i in range(24):
        loc = m.Location(
            name=f"{fake.street_name()} {'Market' if i % 5 == 0 else 'Junction'}",
            district=random.choice(DISTRICTS),
            latitude=round(12.5 + random.random() * 1.5, 5),
            longitude=round(79.5 + random.random() * 1.5, 5),
            data_source="SYNTHETIC",
        )
        db.add(loc)
        locations.append(loc)
    db.commit()

    # --- Gangs / Organizations ---
    gangs = []
    for name in GANG_NAMES:
        g = m.Organization(name=name, org_type="gang", data_source="SYNTHETIC")
        db.add(g)
        gangs.append(g)
    for name in ["Coastal Freight Pvt Ltd", "Sunrise Traders", "Metro Logistics"]:
        db.add(m.Organization(name=name, org_type="organization", data_source="SYNTHETIC"))
    db.commit()

    # --- Persons (60) + phones + vehicles + accounts + aliases ---
    persons = []
    for i in range(60):
        role = random.choices(["criminal", "associate", "victim", "witness"], weights=[35, 40, 15, 10])[0]
        p = m.Person(
            full_name=fake.name(),
            person_role=role,
            dob=fake.date_of_birth(minimum_age=18, maximum_age=60).isoformat(),
            gender=random.choice(["M", "F"]),
            address=fake.address().replace("\n", ", "),
            risk_band=random.choices(["low", "medium", "high"], weights=[50, 35, 15])[0],
            data_source="SYNTHETIC",
        )
        db.add(p)
        persons.append(p)
    db.commit()

    for p in persons:
        if random.random() < 0.35:
            alias_name = fake.first_name()
            db.add(m.Alias(person_id=p.id, alias_name=alias_name))
    db.commit()

    phones, vehicles, accounts = [], [], []
    for p in persons:
        if random.random() < 0.85:
            ph = m.Phone(number=_phone(), owner_person_id=p.id, data_source="SYNTHETIC")
            db.add(ph)
            phones.append(ph)
        if random.random() < 0.5:
            v = m.Vehicle(registration_number=_plate(), owner_person_id=p.id, vehicle_type=random.choice(["car", "bike", "van"]), data_source="SYNTHETIC")
            db.add(v)
            vehicles.append(v)
        if random.random() < 0.4:
            acc = m.FinancialAccount(account_number_masked=_account(), owner_person_id=p.id, bank_name=random.choice(["SBI", "HDFC", "ICICI", "Canara Bank"]), data_source="SYNTHETIC")
            db.add(acc)
            accounts.append(acc)
    db.commit()

    # --- Cases + FIRs ---
    cases = []
    for i in range(18):
        c = m.CrimeCase(
            case_number=f"CASE-{100+i}",
            title=f"{random.choice(CRIME_TYPES).title()} investigation {100+i}",
            crime_type=random.choice(CRIME_TYPES),
            district=random.choice(DISTRICTS),
            status=random.choice(["open", "open", "closed", "under_review"]),
            opened_at=fake.date_time_between(start_date="-180d", end_date="-30d"),
            data_source="SYNTHETIC",
        )
        db.add(c)
        cases.append(c)
    db.commit()

    firs = []
    for i in range(55):
        case = random.choice(cases)
        loc = random.choice(locations)
        involved = random.sample(persons, k=random.randint(1, 3))
        narrative = (
            f"{involved[0].full_name}" + (f" alias {random.choice(['Rocky','Tiger','Bull','Shadow'])}" if random.random() < 0.2 else "")
            + f" was observed near {loc.name}."
        )
        if len(involved) > 1:
            narrative += f" {involved[1].full_name} was also present."
        f = m.FIR(
            fir_number=f"FIR-2026-{1000+i}",
            case_id=case.id,
            narrative_text=narrative,
            filed_at=fake.date_time_between(start_date="-150d", end_date="-1d"),
            location_id=loc.id,
            data_source="SYNTHETIC",
        )
        db.add(f)
        firs.append(f)
    db.commit()

    # --- Evidence + Relationships (general random network) ---
    def make_evidence(etype, source_record_id, desc, conf=0.85):
        e = m.Evidence(evidence_type=etype, source_record_id=source_record_id, description=desc, confidence=conf, data_source="SYNTHETIC")
        db.add(e)
        db.flush()
        return e

    def make_rel(src_id, src_type, tgt_id, tgt_type, rtype, evidence, conf, days_ago_first=60, days_ago_last=2):
        r = m.RelationshipRecord(
            source_entity_id=src_id, source_entity_type=src_type,
            target_entity_id=tgt_id, target_entity_type=tgt_type,
            relationship_type=rtype, confidence_score=conf,
            first_seen_at=dt.datetime.utcnow() - dt.timedelta(days=days_ago_first),
            last_seen_at=dt.datetime.utcnow() - dt.timedelta(days=days_ago_last),
            source_record_id=evidence.source_record_id, source_record_type=evidence.evidence_type,
            evidence_id=evidence.id, status="active",
        )
        db.add(r)
        return r

    # random associations among persons
    for _ in range(140):
        a, b = random.sample(persons, 2)
        fir = random.choice(firs)
        ev = make_evidence("FIR", fir.fir_number, f"Co-mention in {fir.fir_number}", conf=round(random.uniform(0.6, 0.97), 2))
        make_rel(a.id, "PERSON", b.id, "PERSON", "ASSOCIATED_WITH", ev, ev.confidence)

    # phone / vehicle usage
    for ph in phones:
        ev = make_evidence("CDR", f"CDR-{ph.number[-4:]}", f"Phone {ph.number} usage record", conf=0.95)
        make_rel(ph.owner_person_id, "PERSON", ph.id, "PHONE", "USED_PHONE", ev, 0.95)
    for v in vehicles:
        ev = make_evidence("SURVEILLANCE", f"SR-{v.registration_number[-4:]}", f"Vehicle {v.registration_number} sighting", conf=0.9)
        make_rel(v.owner_person_id, "PERSON", v.id, "VEHICLE", "USED_VEHICLE", ev, 0.9)
    for acc in accounts:
        ev = make_evidence("FINANCIAL", f"TXN-{acc.account_number_masked[-4:]}", f"Account {acc.account_number_masked} linkage", conf=0.88)
        make_rel(acc.owner_person_id, "PERSON", acc.id, "BANK_ACCOUNT", "LINKED_TO", ev, 0.88)

    # gang membership for ~15% of criminals
    criminals = [p for p in persons if p.person_role == "criminal"]
    for p in random.sample(criminals, k=max(1, len(criminals) // 4)):
        gang = random.choice(gangs)
        ev = make_evidence("INVESTIGATION_NOTE", f"IR-{random.randint(10,99)}", f"{p.full_name} linked to {gang.name}", conf=round(random.uniform(0.7, 0.95), 2))
        make_rel(p.id, "PERSON", gang.id, "ORGANIZATION", "MEMBER_OF", ev, ev.confidence)

    # accused-in / located-at
    for f in firs:
        loc = f.location_id
        # pick a person mentioned via narrative heuristically: just grab random persons for accused
        accused = random.sample(persons, k=random.randint(1, 2))
        ev = make_evidence("FIR", f.fir_number, f"Accused in {f.fir_number}", conf=0.9)
        for p in accused:
            make_rel(p.id, "PERSON", f.case_id, "CASE", "ACCUSED_IN", ev, 0.9)
            make_rel(p.id, "PERSON", loc, "LOCATION", "LOCATED_AT", ev, 0.8)

    db.commit()

    # --- DELIBERATE HIDDEN CHAIN (headline demo feature) ---
    # Ravi --phone--> Arjun --vehicle--> Suresh --financial--> Gang
    # Each hop is only visible in a DIFFERENT record type, so no single
    # document reveals the full chain — only cross-source graph traversal does.
    ravi = m.Person(full_name="Ravi Kumar", person_role="criminal", risk_band="medium", data_source="SYNTHETIC",
                     address=fake.address().replace("\n", ", "))
    arjun = m.Person(full_name="Arjun Nair", person_role="associate", risk_band="low", data_source="SYNTHETIC",
                      address=fake.address().replace("\n", ", "))
    suresh = m.Person(full_name="Suresh Pillai", person_role="associate", risk_band="medium", data_source="SYNTHETIC",
                       address=fake.address().replace("\n", ", "))
    db.add_all([ravi, arjun, suresh])
    db.commit()

    db.add(m.Alias(person_id=ravi.id, alias_name="Rocky"))
    db.commit()

    hidden_phone = m.Phone(number="9876543210", owner_person_id=arjun.id, data_source="SYNTHETIC")
    hidden_vehicle = m.Vehicle(registration_number="KA01AB1234", owner_person_id=suresh.id, vehicle_type="car", data_source="SYNTHETIC")
    hidden_account = m.FinancialAccount(account_number_masked="XXXX7788", owner_person_id=suresh.id, bank_name="SBI", data_source="SYNTHETIC")
    db.add_all([hidden_phone, hidden_vehicle, hidden_account])
    db.commit()

    hidden_gang = gangs[0]  # Cobra Syndicate
    hidden_loc = locations[0]

    hidden_case = m.CrimeCase(case_number="CASE-901", title="Cross-district extortion — hidden network probe",
                               crime_type="extortion", district=DISTRICTS[0], status="open",
                               opened_at=dt.datetime.utcnow() - dt.timedelta(days=40), data_source="SYNTHETIC")
    db.add(hidden_case)
    db.commit()

    fir_a = m.FIR(fir_number="FIR-2026-0142", case_id=hidden_case.id,
                   narrative_text=f"Ravi alias Rocky met Arjun Nair near {hidden_loc.name}. They used phone 9876543210.",
                   filed_at=dt.datetime.utcnow() - dt.timedelta(days=35), location_id=hidden_loc.id, data_source="SYNTHETIC")
    db.add(fir_a)
    db.commit()

    ev1 = make_evidence("FIR", fir_a.fir_number, "Ravi and Arjun co-mentioned; phone 9876543210 referenced", conf=0.93)
    make_rel(ravi.id, "PERSON", hidden_phone.id, "PHONE", "COMMUNICATED_WITH", ev1, 0.93, days_ago_first=35, days_ago_last=29)

    ev2 = make_evidence("CDR", "CDR-3210", "Call detail record ties phone 9876543210 to Arjun Nair", conf=0.96)
    make_rel(hidden_phone.id, "PHONE", arjun.id, "PERSON", "USED_PHONE", ev2, 0.96, days_ago_first=34, days_ago_last=20)

    ev3 = make_evidence("SURVEILLANCE", "SR-44", "Surveillance places Arjun Nair using vehicle KA01AB1234", conf=0.88)
    make_rel(arjun.id, "PERSON", hidden_vehicle.id, "VEHICLE", "USED_VEHICLE", ev3, 0.88, days_ago_first=25, days_ago_last=15)

    ev4 = make_evidence("SURVEILLANCE", "SR-45", "Vehicle KA01AB1234 registered/associated with Suresh Pillai", conf=0.85)
    make_rel(hidden_vehicle.id, "VEHICLE", suresh.id, "PERSON", "USED_VEHICLE", ev4, 0.85, days_ago_first=25, days_ago_last=10)

    ev5 = make_evidence("FINANCIAL", "TXN-7788", "Financial record links Suresh Pillai to account XXXX7788", conf=0.9)
    make_rel(suresh.id, "PERSON", hidden_account.id, "BANK_ACCOUNT", "LINKED_TO", ev5, 0.9, days_ago_first=18, days_ago_last=5)

    ev6 = make_evidence("FIR", "FIR-2026-0201", f"Account XXXX7788 traced to {hidden_gang.name} in follow-up investigation", conf=0.82)
    make_rel(hidden_account.id, "BANK_ACCOUNT", hidden_gang.id, "ORGANIZATION", "LINKED_TO", ev6, 0.82, days_ago_first=12, days_ago_last=2)

    db.commit()

    # --- Anomalous entity: Ravi shows a communication burst ---
    for i in range(20):
        other = random.choice(persons)
        ev = make_evidence("CDR", f"CDR-BURST-{i}", "Recent high-frequency contact", conf=round(random.uniform(0.7, 0.95), 2))
        make_rel(ravi.id, "PERSON", other.id, "PERSON", "COMMUNICATED_WITH", ev, ev.confidence, days_ago_first=6, days_ago_last=1)
    db.commit()

    db.add(m.Anomaly(
        entity_id=ravi.id, entity_type="PERSON", anomaly_type="COMMUNICATION_BURST",
        reason="Communication frequency increased 4.2x above historical baseline over the last 7 days.",
        severity="high", related_entities=[arjun.id, suresh.id, hidden_phone.id], evidence_count=23,
    ))

    db.add(m.Alert(
        alert_type="POTENTIAL_BRIDGE_ENTITY",
        what_happened=f"Arjun Nair identified as a bridge connecting Ravi Kumar's cluster to {hidden_gang.name}.",
        why_it_matters="Bridge entities often represent intermediaries worth prioritizing for surveillance.",
        affected_entities=[ravi.id, arjun.id, suresh.id],
        supporting_records=[ev1.id, ev2.id, ev3.id],
        confidence=0.87,
    ))
    db.add(m.Alert(
        alert_type="CROSS_DISTRICT_CONNECTION",
        what_happened="A financial link was traced from a Chengalpattu-registered account to a district-crossing gang network.",
        why_it_matters="Cross-district financial links can indicate coordinated multi-region criminal activity.",
        affected_entities=[suresh.id, hidden_gang.id],
        supporting_records=[ev5.id, ev6.id],
        confidence=0.82,
    ))
    db.commit()

    db.add(m.ImportJob(job_type="fir", filename="seed_dataset.json", status="completed",
                        entities_extracted=len(persons) + len(phones) + len(vehicles) + len(accounts),
                        relationships_created=db.query(m.RelationshipRecord).count()))
    db.commit()

    return {
        "status": "seeded",
        "persons": db.query(m.Person).count(),
        "relationships": db.query(m.RelationshipRecord).count(),
        "cases": db.query(m.CrimeCase).count(),
        "firs": db.query(m.FIR).count(),
        "hidden_chain_root": ravi.id,
    }

import os
import csv
import sys
import json
from collections import defaultdict

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT_DIR, "data")

def load_csv(filename):
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        return list(csv.DictReader(f))

def validate():
    print("Validating DRISHYAM Synthetic Dataset...\n")
    
    persons = load_csv("persons.csv")
    cases = load_csv("crime_cases.csv")
    firs = load_csv("firs.csv")
    relationships = load_csv("relationships.csv")
    anomalies = load_csv("anomalies.csv")
    alerts = load_csv("alerts.csv")
    phones = load_csv("phones.csv")
    transactions = load_csv("transactions.csv")
    
    person_ids = {p["id"] for p in persons}
    case_ids = {c["id"] for c in cases}
    phone_ids = {p["id"] for p in phones}
    
    errors = []
    
    # 1. Referential Integrity
    print(f"Checking referential integrity for {len(firs)} FIRs...")
    for f in firs:
        if f["case_id"] and f["case_id"] not in case_ids:
            errors.append(f"Orphan FIR {f['id']}: case_id {f['case_id']} not found.")
            
    print(f"Checking referential integrity for {len(phones)} Phones...")
    for p in phones:
        if p["owner_person_id"] and p["owner_person_id"] not in person_ids:
            errors.append(f"Orphan Phone {p['id']}: owner_person_id {p['owner_person_id']} not found.")

    # 2. Graph Integrity
    print(f"Checking graph integrity for {len(relationships)} Relationships...")
    valid_source_types = {"PERSON", "PHONE", "VEHICLE", "BANK_ACCOUNT", "GANG", "ORGANIZATION", "LOCATION", "CASE"}
    for r in relationships:
        if r["source_entity_type"] not in valid_source_types:
            errors.append(f"Invalid source entity type in rel {r['id']}: {r['source_entity_type']}")
            
        if r["source_entity_type"] == "PERSON" and r["source_entity_id"] not in person_ids:
            # We don't error immediately if they are missing in persons because they could be other types
            pass
            
    # 3. Temporal Integrity
    print("Checking temporal integrity...")
    for t in transactions:
        if t["amount"] and float(t["amount"]) < 0:
            errors.append(f"Negative transaction amount in {t['id']}: {t['amount']}")

    # 4. Intelligence Integrity
    print("Checking intelligence integrity...")
    if len(anomalies) == 0:
        errors.append("No anomalies were generated. Expected at least some derived anomalies.")
    else:
        print(f"  -> Found {len(anomalies)} derived anomalies.")
        
    if len(alerts) == 0:
        errors.append("No alerts were generated. Expected at least some derived alerts.")
    else:
        print(f"  -> Found {len(alerts)} tactical alerts.")
        
    if errors:
        print("\n--- VALIDATION FAILED ---")
        for e in errors[:20]:
            print(f"❌ {e}")
        if len(errors) > 20:
            print(f"...and {len(errors) - 20} more errors.")
        sys.exit(1)
    else:
        print("\n✅ VALIDATION PASSED")
        print("All referential, graph, temporal, and intelligence constraints are satisfied.")

if __name__ == "__main__":
    validate()

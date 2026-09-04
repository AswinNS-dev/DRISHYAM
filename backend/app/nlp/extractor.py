"""
DRISHYAM entity extraction engine.

Uses a layered rule-based + gazetteer approach rather than a black-box model:
regex patterns for structured identifiers (phone, vehicle, FIR/case numbers,
bank accounts, dates), a curated location/organization gazetteer for the demo
dataset, and capitalization + trigger-word heuristics for PERSON/ALIAS.

This is intentionally explainable: every extraction can point to the exact
pattern/rule that fired, which is required for the "confidence + provenance"
requirements of DRISHYAM. Swap in spaCy/transformers behind the same
`extract_entities()` interface for a production deployment.
"""
import re
from dataclasses import dataclass, field
from typing import List


@dataclass
class ExtractedEntity:
    text: str
    entity_type: str
    confidence: float
    start: int
    end: int
    rule: str


PHONE_RE = re.compile(r"\b(?:\+?91[-\s]?)?[6-9]\d{9}\b")
VEHICLE_RE = re.compile(r"\b[A-Z]{2}[-\s]?\d{1,2}[-\s]?[A-Z]{1,2}[-\s]?\d{4}\b")
FIR_RE = re.compile(r"\bFIR[-\s]?\d{2,4}[-\s]?\d{2,6}\b", re.IGNORECASE)
CASE_RE = re.compile(r"\bCASE[-\s]?\d{2,6}\b", re.IGNORECASE)
ACCOUNT_RE = re.compile(r"\b(?:A/C|ACCOUNT|ACC)[-\s#:]*[Xx*]{2,}\d{2,6}\b", re.IGNORECASE)
DATE_RE = re.compile(r"\b\d{1,2}[/-][A-Za-z]{3,9}[/-]?\d{0,4}\b|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b")
ALIAS_TRIGGER_RE = re.compile(r"\b([A-Z][a-z]+)\s+(?:alias|aka|a\.k\.a\.?|@)\s+([A-Z][a-zA-Z]+)\b")
PERSON_CANDIDATE_RE = re.compile(r"\b([A-Z][a-z]{2,}(?:\s[A-Z][a-z]{2,}){0,2})\b")

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

LEGAL_SECTION_RE = re.compile(r"\b(?:Section|Sec\.?|U/S)\s?\d{2,4}[A-Za-z]?(?:\s?(?:IPC|CrPC|NDPS))?\b", re.IGNORECASE)


def extract_entities(text: str) -> List[ExtractedEntity]:
    entities: List[ExtractedEntity] = []
    seen_spans = set()

    def add(match_text, etype, conf, start, end, rule):
        key = (start, end)
        if key in seen_spans:
            return
        seen_spans.add(key)
        entities.append(ExtractedEntity(match_text.strip(), etype, conf, start, end, rule))

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
            add(text[idx:idx + len(kw)], "CRIME_TYPE", 0.75, idx, idx + len(kw), "crime_keyword_gazetteer")

    for m in PERSON_CANDIDATE_RE.finditer(text):
        candidate = m.group(1)
        first_word = candidate.split()[0]
        if candidate in PRONOUNS or first_word in PRONOUNS:
            continue
        if first_word in STOPWORDS_AS_NAMES:
            # Likely an org/location phrase, e.g. "Central Market"
            window = text[max(0, m.start() - 20):m.start()].lower()
            etype = "ORGANIZATION" if any(k in lower_text[m.end():m.end() + 15] for k in ORG_GANG_KEYWORDS) else "LOCATION"
            conf = 0.7
            add(candidate, etype, conf, m.start(), m.end(), "capitalized_phrase_heuristic")
            continue
        # crude org/gang detection: capitalized phrase followed by "gang"/"organization"
        after = lower_text[m.end():m.end() + 15]
        if any(k in after for k in ORG_GANG_KEYWORDS):
            add(candidate, "GANG" if "gang" in after else "ORGANIZATION", 0.82, m.start(), m.end(), "gang_org_suffix_heuristic")
            continue
        add(candidate, "PERSON", 0.78, m.start(), m.end(), "capitalized_name_heuristic")

    entities.sort(key=lambda e: e.start)
    return entities

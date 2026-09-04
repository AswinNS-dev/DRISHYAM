"""
Entity resolution: decides whether a newly-extracted PERSON mention refers to
an existing Person record, so DRISHYAM does not create duplicate nodes for
"Ravi Kumar", "Ravi K.", "Ravi", "Rocky" (alias), etc.

Never silently merges — always returns a scored candidate list with a status
(CONFIRMED / PROBABLE / POSSIBLE / UNRESOLVED) for investigator review.
"""
from dataclasses import dataclass, field
from typing import List, Optional
from rapidfuzz import fuzz


@dataclass
class MatchCandidate:
    candidate_person_id: str
    candidate_name: str
    score: float
    status: str
    supporting_evidence: List[str] = field(default_factory=list)
    method: str = "fuzzy+context"


def classify_status(score: float) -> str:
    if score >= 0.9:
        return "CONFIRMED"
    if score >= 0.75:
        return "PROBABLE"
    if score >= 0.55:
        return "POSSIBLE"
    return "UNRESOLVED"


def resolve_person(
    candidate_name: str,
    existing_people: list,           # list of dicts: {id, full_name, aliases: [str]}
    shared_phone: Optional[bool] = False,
    shared_vehicle: Optional[bool] = False,
    shared_location: Optional[bool] = False,
    same_case: Optional[bool] = False,
) -> List[MatchCandidate]:
    results: List[MatchCandidate] = []
    name_norm = candidate_name.strip().lower()

    for person in existing_people:
        evidence = []
        best_text_score = fuzz.token_sort_ratio(name_norm, person["full_name"].lower()) / 100.0

        alias_hit = False
        for alias in person.get("aliases", []):
            alias_score = fuzz.token_sort_ratio(name_norm, alias.lower()) / 100.0
            if alias_score > best_text_score:
                best_text_score = alias_score
            if alias_score >= 0.85:
                alias_hit = True

        if best_text_score >= 0.55:
            evidence.append(f"Name similarity {best_text_score:.0%}")
        if alias_hit:
            evidence.append("Alias relationship")

        # Contextual boosts — each corroborating shared identifier raises confidence
        boost = 0.0
        if shared_phone:
            boost += 0.15
            evidence.append("Same phone number")
        if shared_vehicle:
            boost += 0.15
            evidence.append("Same vehicle")
        if shared_location:
            boost += 0.08
            evidence.append("Same location")
        if same_case:
            boost += 0.08
            evidence.append("Same case history")

        final_score = min(0.99, best_text_score + boost)

        if final_score < 0.4 and not evidence:
            continue  # not a plausible candidate at all

        results.append(MatchCandidate(
            candidate_person_id=person["id"],
            candidate_name=person["full_name"],
            score=round(final_score, 2),
            status=classify_status(final_score),
            supporting_evidence=evidence,
            method="fuzzy_name+alias+context",
        ))

    results.sort(key=lambda r: r.score, reverse=True)
    return results

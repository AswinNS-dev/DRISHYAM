from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
import datetime as dt
import math

from app.database.db import get_db
from app.core.security import get_current_user
from app.models import models as m
from app.services import graph_data

router = APIRouter(prefix="/api/v2/locations", tags=["locations"])

# Deterministic District to State mapping for Indian administrative jurisdictions
DISTRICT_STATE_MAP: Dict[str, str] = {
    "chengalpattu": "Tamil Nadu",
    "chennai south": "Tamil Nadu",
    "coimbatore": "Tamil Nadu",
    "madurai": "Tamil Nadu",
    "trichy": "Tamil Nadu",
    "salem": "Tamil Nadu",
    "bengaluru urban": "Karnataka",
    "bengaluru rural": "Karnataka",
    "mysuru": "Karnataka",
    "mangaluru": "Karnataka",
    "mumbai city": "Maharashtra",
    "mumbai suburban": "Maharashtra",
    "pune": "Maharashtra",
    "thane": "Maharashtra",
    "new delhi": "Delhi",
    "central delhi": "Delhi",
    "south delhi": "Delhi",
    "hyderabad": "Telangana",
    "cyberabad": "Telangana",
}


def get_state_for_district(district: Optional[str]) -> str:
    if not district:
        return "Tamil Nadu"
    return DISTRICT_STATE_MAP.get(district.strip().lower(), "Tamil Nadu")


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes great-circle distance between two GPS coordinates using the Haversine formula."""
    R = 6371.0  # Earth's radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def compute_deterministic_hotspots(
    locations: List[Dict[str, Any]], cluster_radius_km: float = 40.0
) -> List[Dict[str, Any]]:
    """
    Groups locations deterministically into geographic hotspot clusters based on spatial proximity
    and ranks them by incident density.
    
    Clustering logic:
    1. Filter locations with valid geographic coordinates.
    2. Sort candidate locations deterministically by (event_count DESC, threat_score DESC, name ASC)
       so seeds are consistent.
    3. Greedily group locations within cluster_radius_km (default 40 km) into a cluster.
    4. Compute weighted centroid coordinates, aggregate events, calculate density score,
       and assign severity based on event concentration.
    5. Rank clusters deterministically by event count DESC, then density score DESC.
    """
    valid_locs = [
        loc for loc in locations
        if loc.get("latitude") is not None and loc.get("longitude") is not None
    ]
    if not valid_locs:
        return []

    # Sort deterministically
    sorted_locs = sorted(
        valid_locs,
        key=lambda l: (l.get("fir_count", 0), l.get("threat_score", 0), l.get("name", "")),
        reverse=True
    )

    clusters: List[Dict[str, Any]] = []
    assigned_ids = set()

    for seed in sorted_locs:
        if seed["id"] in assigned_ids:
            continue

        seed_lat = seed["latitude"]
        seed_lon = seed["longitude"]
        members = [seed]
        assigned_ids.add(seed["id"])

        for other in sorted_locs:
            if other["id"] in assigned_ids:
                continue
            dist = haversine_distance_km(seed_lat, seed_lon, other["latitude"], other["longitude"])
            if dist <= cluster_radius_km:
                members.append(other)
                assigned_ids.add(other["id"])

        # Compute cluster metrics
        total_events = sum(m.get("fir_count", 0) for m in members)
        primary_district = seed.get("district") or "Central"
        state = seed.get("state") or get_state_for_district(primary_district)

        # Weighted centroid (weighted by event count, fallback to simple mean)
        weights = [max(1, m.get("fir_count", 0)) for m in members]
        total_weight = sum(weights)
        centroid_lat = sum(m["latitude"] * w for m, w in zip(members, weights)) / total_weight
        centroid_lon = sum(m["longitude"] * w for m, w in zip(members, weights)) / total_weight

        # Density score: event count with bonus for multi-node clustering
        density_score = round(total_events * 1.5 + len(members) * 2.0, 2)
        max_threat = max(m.get("threat_score", 0) for m in members)

        if total_events >= 8 or max_threat >= 70:
            severity = "CRITICAL"
        elif total_events >= 4 or max_threat >= 40:
            severity = "HIGH"
        elif total_events >= 2:
            severity = "MODERATE"
        else:
            severity = "LOW"

        clusters.append({
            "id": f"hotspot-{primary_district.lower().replace(' ', '-')}-{len(clusters) + 1}",
            "region": f"{primary_district} Corridor",
            "district": primary_district,
            "state": state,
            "latitude": round(centroid_lat, 5),
            "longitude": round(centroid_lon, 5),
            "event_count": total_events,
            "location_count": len(members),
            "density_score": density_score,
            "threat_score": max_threat,
            "severity": severity,
            "location_ids": [m["id"] for m in members],
            "locations": [
                {
                    "id": m["id"],
                    "name": m["name"],
                    "district": m.get("district"),
                    "fir_count": m.get("fir_count", 0),
                    "threat_score": m.get("threat_score", 0),
                }
                for m in members
            ],
        })

    # Rank clusters deterministically
    clusters.sort(key=lambda c: (c["event_count"], c["density_score"], c["location_count"], c["region"]), reverse=True)
    for idx, c in enumerate(clusters, start=1):
        c["rank"] = idx

    return clusters


@router.get("")
def list_locations(
    state: Optional[str] = None,
    district: Optional[str] = None,
    crime_type: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    severity: Optional[str] = None,
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    List all mapped geographic coordinates, incident hotspots, and entity clusters.
    Uses real database records and applies optional filters for date range, jurisdiction, and crime type.
    """
    locations = db.query(m.Location).all()
    all_firs = db.query(m.FIR).all()
    all_cases = {c.id: c for c in db.query(m.CrimeCase).all()}
    lookup = graph_data.node_lookup(db)

    # Pre-group FIRs by location_id
    firs_by_location: Dict[str, List[m.FIR]] = {}
    for f in all_firs:
        if f.location_id:
            firs_by_location.setdefault(f.location_id, []).append(f)

    # Pre-group relationships by location_id
    all_rels = db.query(m.RelationshipRecord).filter(
        (m.RelationshipRecord.target_entity_type == "LOCATION")
        | (m.RelationshipRecord.source_entity_type == "LOCATION")
    ).all()
    rels_by_location: Dict[str, List[m.RelationshipRecord]] = {}
    for r in all_rels:
        if r.target_entity_type == "LOCATION":
            rels_by_location.setdefault(r.target_entity_id, []).append(r)
        if r.source_entity_type == "LOCATION":
            rels_by_location.setdefault(r.source_entity_id, []).append(r)

    results: List[Dict[str, Any]] = []

    for loc in locations:
        loc_district = loc.district or "Central"
        loc_state = get_state_for_district(loc_district)

        # Apply state filter
        if state and loc_state.lower() != state.lower():
            continue

        # Apply district filter
        if district and loc_district.lower() != district.lower():
            continue

        # Apply text search filter
        if q:
            term = q.lower()
            if not (term in loc.name.lower() or term in loc_district.lower() or term in loc_state.lower()):
                continue

        # Get FIRs for this location
        raw_firs = firs_by_location.get(loc.id, [])
        filtered_events: List[Dict[str, Any]] = []

        for f in raw_firs:
            case = all_cases.get(f.case_id)
            fir_crime_type = (case.crime_type if case and case.crime_type else "incident").lower()

            # Crime type filter
            if crime_type and crime_type.lower() != "all" and fir_crime_type != crime_type.lower():
                continue

            # Date range filter
            filed_at_iso = f.filed_at.isoformat() if f.filed_at else None
            if from_date and filed_at_iso and filed_at_iso < from_date:
                continue
            if to_date and filed_at_iso and filed_at_iso > to_date:
                continue

            filtered_events.append({
                "id": f.id,
                "fir_number": f.fir_number,
                "case_id": f.case_id,
                "case_number": case.case_number if case else None,
                "case_title": case.title if case else None,
                "crime_type": case.crime_type if case else "incident",
                "title": f"FIR Registered: {f.fir_number}",
                "description": f.narrative_text[:200] + ("..." if len(f.narrative_text) > 200 else ""),
                "timestamp": filed_at_iso,
                "severity": "CRITICAL" if fir_crime_type in ["extortion", "narcotics trafficking"] else "HIGH",
            })

        # If a crime_type or date filter was active and no events match, exclude location
        if (crime_type and crime_type.lower() != "all") or from_date or to_date:
            if not filtered_events:
                continue

        # Linked entities from relationships
        loc_rels = rels_by_location.get(loc.id, [])
        linked_entities: List[Dict[str, Any]] = []
        for r in loc_rels:
            other_id = r.source_entity_id if r.target_entity_id == loc.id else r.target_entity_id
            info = lookup.get(other_id, {})
            if info:
                linked_entities.append({
                    "id": other_id,
                    "name": info.get("name"),
                    "type": info.get("type"),
                    "relationship": r.relationship_type,
                    "confidence": r.confidence_score,
                })

        # Calculate threat score
        fir_count = len(filtered_events) if (crime_type or from_date or to_date) else len(raw_firs)
        threat_score = min(100, int((fir_count * 25) + (len(linked_entities) * 15)))

        risk_category = "CRITICAL" if threat_score >= 70 else ("HIGH" if threat_score >= 40 else "MODERATE")
        if fir_count == 0 and threat_score < 20:
            risk_category = "LOW"

        # Apply severity filter
        if severity and severity.upper() != "ALL" and risk_category != severity.upper():
            continue

        results.append({
            "id": loc.id,
            "name": loc.name,
            "district": loc_district,
            "state": loc_state,
            "latitude": loc.latitude,
            "longitude": loc.longitude,
            "fir_count": fir_count,
            "threat_score": threat_score,
            "risk_category": risk_category,
            "events": filtered_events,
            "linked_entities": linked_entities[:5],
            "recent_fir": filtered_events[0]["fir_number"] if filtered_events else (raw_firs[0].fir_number if raw_firs else None),
            "created_at": loc.created_at.isoformat() if loc.created_at else None,
        })

    # Compute deterministic hotspot clusters on the active filtered results
    hotspots = compute_deterministic_hotspots(results)

    return {
        "locations": results,
        "total_locations": len(results),
        "hotspots": hotspots,
        "filters_applied": {
            "state": state,
            "district": district,
            "crime_type": crime_type,
            "from_date": from_date,
            "to_date": to_date,
            "severity": severity,
            "q": q,
        },
    }


@router.get("/hotspots")
def list_hotspots(
    state: Optional[str] = None,
    district: Optional[str] = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Returns ranked hotspot clusters computed deterministically from active location records."""
    loc_res = list_locations(state=state, district=district, db=db, user=user)
    return {
        "hotspots": loc_res.get("hotspots", []),
        "total_hotspots": len(loc_res.get("hotspots", [])),
    }


@router.get("/{location_id}")
def get_location_detail(location_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Comprehensive Location Intelligence Dossier."""
    loc = db.query(m.Location).filter(m.Location.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location record not found")

    firs = db.query(m.FIR).filter(m.FIR.location_id == loc.id).order_by(m.FIR.filed_at.desc()).all()
    all_cases = {c.id: c for c in db.query(m.CrimeCase).all()}
    lookup = graph_data.node_lookup(db)

    # Format FIR events
    fir_events = []
    case_ids = set()
    event_types_count: Dict[str, int] = {}

    for f in firs:
        case = all_cases.get(f.case_id)
        if f.case_id:
            case_ids.add(f.case_id)

        c_type = case.crime_type if case and case.crime_type else "Incident"
        event_types_count[c_type] = event_types_count.get(c_type, 0) + 1

        fir_events.append({
            "id": f.id,
            "fir_number": f.fir_number,
            "case_id": f.case_id,
            "case_number": case.case_number if case else None,
            "case_title": case.title if case else None,
            "crime_type": c_type,
            "narrative": f.narrative_text,
            "filed_at": f.filed_at.isoformat() if f.filed_at else None,
        })

    # Related cases deduplicated
    related_cases = []
    for cid in case_ids:
        c = all_cases.get(cid)
        if c:
            related_cases.append({
                "id": c.id,
                "case_number": c.case_number,
                "title": c.title,
                "crime_type": c.crime_type,
                "district": c.district,
                "status": c.status,
                "opened_at": c.opened_at.isoformat() if c.opened_at else None,
            })

    # Relationships pointing to or originating from this location
    rels = db.query(m.RelationshipRecord).filter(
        (m.RelationshipRecord.target_entity_id == loc.id) | (m.RelationshipRecord.source_entity_id == loc.id)
    ).all()

    linked_entities = []
    for r in rels:
        other_id = r.source_entity_id if r.target_entity_id == loc.id else r.target_entity_id
        info = lookup.get(other_id, {})
        if info:
            linked_entities.append({
                "id": other_id,
                "name": info.get("name"),
                "type": info.get("type"),
                "relationship": r.relationship_type,
                "confidence": r.confidence_score,
            })

    threat_score = min(100, int((len(firs) * 25) + (len(linked_entities) * 15)))
    loc_district = loc.district or "Central"
    loc_state = get_state_for_district(loc_district)

    return {
        "location": {
            "id": loc.id,
            "name": loc.name,
            "district": loc_district,
            "state": loc_state,
            "latitude": loc.latitude,
            "longitude": loc.longitude,
            "event_count": len(firs),
            "threat_score": threat_score,
            "risk_category": "CRITICAL" if threat_score >= 70 else ("HIGH" if threat_score >= 40 else "MODERATE"),
            "firs": fir_events,
            "event_timeline": fir_events,
            "related_cases": related_cases,
            "event_types": event_types_count,
            "linked_entities": linked_entities,
            "coordinates": {
                "latitude": loc.latitude,
                "longitude": loc.longitude,
            },
        }
    }

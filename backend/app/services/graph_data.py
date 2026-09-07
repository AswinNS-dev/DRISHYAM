"""Graph data loading with process-level caching.

These loaders back the network graph, centrality, communities, dossier,
timeline, insights and dashboard endpoints. Every value is derived from the
database; the cache only avoids re-fetching identical data on every request
(important because each Supabase round-trip costs ~100-300ms over WAN).
All loaders go through app.services.cache (TTL + explicit invalidation).
"""
from sqlalchemy.orm import Session
from app.models import models as m
from app.services import cache


def _label(entity_type, obj):
    if entity_type == "PERSON":
        return obj.full_name
    if entity_type == "PHONE":
        return obj.number
    if entity_type == "VEHICLE":
        return obj.registration_number
    if entity_type == "LOCATION":
        return obj.name
    if entity_type == "ORGANIZATION":
        return obj.name
    if entity_type == "BANK_ACCOUNT":
        return obj.account_number_masked
    if entity_type == "CASE":
        return obj.title
    return str(getattr(obj, "id", "?"))


def load_all_nodes(db: Session):
    def _q():
        nodes = []
        for p in db.query(m.Person).all():
            nodes.append({"id": p.id, "type": "PERSON", "name": p.full_name, "risk_band": p.risk_band,
                          "person_role": p.person_role, "data_source": p.data_source})
        for ph in db.query(m.Phone).all():
            nodes.append({"id": ph.id, "type": "PHONE", "name": ph.number, "data_source": ph.data_source})
        for v in db.query(m.Vehicle).all():
            nodes.append({"id": v.id, "type": "VEHICLE", "name": v.registration_number, "data_source": v.data_source})
        for loc in db.query(m.Location).all():
            nodes.append({"id": loc.id, "type": "LOCATION", "name": loc.name, "district": loc.district,
                          "latitude": loc.latitude, "longitude": loc.longitude, "data_source": loc.data_source})
        for org in db.query(m.Organization).all():
            nodes.append({"id": org.id, "type": org.org_type.upper(), "name": org.name, "data_source": org.data_source})
        for acc in db.query(m.FinancialAccount).all():
            nodes.append({"id": acc.id, "type": "BANK_ACCOUNT", "name": acc.account_number_masked, "data_source": acc.data_source})
        for c in db.query(m.CrimeCase).all():
            nodes.append({"id": c.id, "type": "CASE", "name": c.title, "case_number": c.case_number, "data_source": c.data_source})
        return nodes
    return cache.cached("graph:nodes", ttl=60, producer=_q)


def load_all_edges(db: Session):
    def _q():
        edges = []
        for r in db.query(m.RelationshipRecord).filter(m.RelationshipRecord.status == "active").all():
            edges.append({
                "id": r.id,
                "source_entity_id": r.source_entity_id,
                "target_entity_id": r.target_entity_id,
                "relationship_type": r.relationship_type,
                "confidence_score": float(r.confidence_score or 0.8),
                "evidence_id": r.evidence_id,
                "first_seen_at": r.first_seen_at.isoformat() if r.first_seen_at else None,
                "last_seen_at": r.last_seen_at.isoformat() if r.last_seen_at else None,
                "source_record_id": r.source_record_id,
                "source_record_type": r.source_record_type,
            })
        return edges
    return cache.cached("graph:edges", ttl=60, producer=_q)


def node_lookup(db: Session):
    return {n["id"]: n for n in load_all_nodes(db)}


def load_cached_analytics(db: Session):
    """Pre-computed centrality + communities from network_analysis /
    network_communities (populated by the synthetic data generator or any
    offline analysis job). Returns (centrality_map, community_map) or
    (None, None) when the cache is empty, so callers fall back to live
    computation."""
    centrality = cache.get("graph:centrality")
    communities = cache.get("graph:communities")
    if centrality is not None and communities is not None:
        return centrality, communities

    try:
        na_rows = db.query(m.NetworkAnalysis).all()
    except Exception:
        return None, None
    if not na_rows:
        return None, None

    centrality = {
        r.entity_id: {
            "degree_centrality": float(r.degree_centrality or 0.0),
            "betweenness_centrality": float(r.betweenness_centrality or 0.0),
            "pagerank": float(r.pagerank or 0.0),
        }
        for r in na_rows
    }
    communities = {}
    try:
        for r in db.query(m.NetworkCommunity).all():
            communities[r.entity_id] = r.community_label
    except Exception:
        communities = {}

    cache.set("graph:centrality", centrality, ttl=300)
    cache.set("graph:communities", communities, ttl=300)
    return centrality, communities


def invalidate_graph_cache():
    cache.invalidate_all()

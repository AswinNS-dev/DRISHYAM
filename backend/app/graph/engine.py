"""
Graph intelligence engine. Builds an in-memory NetworkX multigraph from the
`relationships` table (Postgres/Supabase or SQLite — same schema either way)
and runs the standard investigative graph algorithms.

Kept Neo4j-free per the "Supabase-first, Neo4j optional" requirement: the
graph is derived on read from relational data, which is enough for the
demo-scale dataset (thousands of nodes/edges) and keeps the whole project
runnable with zero extra infrastructure.
"""
import networkx as nx
from typing import List, Dict, Any


def build_graph(nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> nx.MultiDiGraph:
    g = nx.MultiDiGraph()
    for n in nodes:
        g.add_node(n["id"], **n)
    for e in edges:
        g.add_edge(
            e["source_entity_id"], e["target_entity_id"],
            key=e["id"], relationship_type=e["relationship_type"],
            confidence=e["confidence_score"], evidence_id=e.get("evidence_id"),
            first_seen=e.get("first_seen_at"), last_seen=e.get("last_seen_at"),
        )
    return g


def compute_centrality(g: nx.MultiDiGraph) -> Dict[str, Dict[str, float]]:
    ug = nx.Graph(g)  # collapse to simple undirected graph for centrality
    if ug.number_of_nodes() == 0:
        return {}
    degree = nx.degree_centrality(ug)
    try:
        betweenness = nx.betweenness_centrality(ug, k=min(200, ug.number_of_nodes()) or None)
    except Exception:
        betweenness = {n: 0.0 for n in ug.nodes}
    try:
        pagerank = nx.pagerank(ug, alpha=0.85)
    except Exception:
        pagerank = {n: 0.0 for n in ug.nodes}

    result = {}
    for n in ug.nodes:
        result[n] = {
            "degree_centrality": round(degree.get(n, 0.0), 4),
            "betweenness_centrality": round(betweenness.get(n, 0.0), 4),
            "pagerank": round(pagerank.get(n, 0.0), 4),
        }
    return result


def label_entity_role(score_row: Dict[str, float]) -> str:
    """Neutral terminology — never 'kingpin' from a single score."""
    if score_row["betweenness_centrality"] > 0.15:
        return "Bridge entity"
    if score_row["pagerank"] > 0.05 or score_row["degree_centrality"] > 0.2:
        return "High-centrality entity"
    return "Standard entity"


def detect_communities(g: nx.MultiDiGraph) -> Dict[str, int]:
    ug = nx.Graph(g)
    if ug.number_of_nodes() == 0:
        return {}
    communities = nx.algorithms.community.greedy_modularity_communities(ug)
    mapping = {}
    for idx, community in enumerate(communities):
        for node in community:
            mapping[node] = idx
    return mapping


def connected_components(g: nx.MultiDiGraph) -> List[List[str]]:
    ug = nx.Graph(g)
    return [list(c) for c in nx.connected_components(ug)]


def shortest_path(g: nx.MultiDiGraph, source: str, target: str):
    ug = nx.Graph(g)
    try:
        path = nx.shortest_path(ug, source=source, target=target)
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        return None
    edges_on_path = []
    for a, b in zip(path[:-1], path[1:]):
        edge_data = g.get_edge_data(a, b) or g.get_edge_data(b, a) or {}
        first_edge = list(edge_data.values())[0] if edge_data else {}
        edges_on_path.append({"from": a, "to": b, **first_edge})
    return {"path": path, "hops": len(path) - 1, "edges": edges_on_path}


def discover_hidden_links(g: nx.MultiDiGraph, source: str, max_hops: int = 5, min_hop_count: int = 3):
    """
    Finds paths between `source` and any other node that are NOT direct
    (i.e., go through >= min_hop_count intermediate entity types), surfacing
    connections that would not be obvious from any single source record.
    """
    ug = nx.Graph(g)
    if source not in ug:
        return []
    findings = []
    lengths = nx.single_source_shortest_path_length(ug, source, cutoff=max_hops)
    for target, dist in lengths.items():
        if target == source or dist < min_hop_count:
            continue
        path = nx.shortest_path(ug, source=source, target=target)
        record_sources = set()
        for a, b in zip(path[:-1], path[1:]):
            edge_data = g.get_edge_data(a, b) or g.get_edge_data(b, a) or {}
            for e in edge_data.values():
                if e.get("evidence_id"):
                    record_sources.add(e["evidence_id"])
        findings.append({
            "target": target,
            "hop_count": dist,
            "path": path,
            "distinct_evidence_records": len(record_sources) or dist,
        })
    findings.sort(key=lambda f: (-f["hop_count"], -f["distinct_evidence_records"]))
    return findings

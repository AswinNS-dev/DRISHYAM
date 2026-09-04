"""
AI Investigation Assistant.

Design principle (mandatory per spec): the assistant NEVER free-associates
facts. It always retrieves structured evidence from the graph/DB first, then
either (a) hands that retrieved context to a real LLM provider with strict
instructions to only use what was retrieved, or (b) if no provider is
configured, formats the retrieved evidence into a structured
CLAIM -> RETRIEVED RECORDS -> EVIDENCE VALIDATION -> ANSWER response itself
(the "template" provider). Both paths go through the same retrieval step, so
the fallback is a genuine degraded mode, not a different feature.
"""
import re
from typing import Dict, Any, List
from app.core.config import settings


SYSTEM_INSTRUCTIONS = """You are DRISHYAM's investigation assistant. You must ONLY use the
RETRIEVED_EVIDENCE provided below. Never invent people, cases, phone numbers, vehicles,
locations, or accusations. If the evidence does not support an answer, say so explicitly.
Label each statement as FACT, INFERENCE, POSSIBLE CONNECTION, ANOMALY, or RECOMMENDATION."""


def _no_evidence_response(question: str) -> Dict[str, Any]:
    return {
        "question": question,
        "answer": "No supporting evidence was found in the available records.",
        "claims": [],
        "evidence": [],
        "confidence": None,
    }


def _format_template_answer(question: str, retrieved: Dict[str, Any]) -> Dict[str, Any]:
    """Deterministic, evidence-grounded formatting — used when no LLM key is configured."""
    kind = retrieved.get("kind")

    if kind == "no_evidence":
        return _no_evidence_response(question)

    if kind == "connections":
        entity = retrieved["entity_name"]
        rows = retrieved["connections"]
        if not rows:
            return _no_evidence_response(question)
        lines = [f"{r['name']} ({r['relationship_type']}, confidence {r['confidence']:.0%})" for r in rows[:10]]
        answer = (
            f"[FACT] {entity} has {len(rows)} direct recorded connection(s). "
            f"Strongest links: " + "; ".join(lines[:5]) + "."
        )
        return {
            "question": question, "answer": answer,
            "claims": [{"type": "FACT", "text": answer}],
            "evidence": rows, "confidence": round(sum(r['confidence'] for r in rows) / len(rows), 2),
        }

    if kind == "path":
        path = retrieved["path_result"]
        a, b = retrieved["entity_a"], retrieved["entity_b"]
        if not path:
            return {
                "question": question,
                "answer": f"[FACT] No connection path was found between {a} and {b} in the available records.",
                "claims": [], "evidence": [], "confidence": None,
            }
        hop_desc = " -> ".join(path["path_names"])
        answer = (
            f"[FACT] {a} and {b} are connected through {path['hops']} hop(s): {hop_desc}. "
            f"[INFERENCE] This connection is supported by {path['distinct_evidence']} distinct evidence record(s)."
        )
        return {
            "question": question, "answer": answer,
            "claims": [{"type": "FACT", "text": answer}],
            "evidence": path["edges"], "confidence": path.get("confidence"),
        }

    if kind == "anomaly_reason":
        a = retrieved["anomaly"]
        if not a:
            return _no_evidence_response(question)
        answer = f"[ANOMALY] {retrieved['entity_name']} was flagged: {a['reason']} Severity: {a['severity']}."
        return {
            "question": question, "answer": answer,
            "claims": [{"type": "ANOMALY", "text": answer}],
            "evidence": [a], "confidence": None,
        }

    if kind == "edge_evidence":
        edges = retrieved["edges"]
        if not edges:
            return _no_evidence_response(question)
        parts = [f"{e['relationship_type']} (confidence {e['confidence']:.0%}, source {e.get('source_record_id','n/a')})" for e in edges]
        answer = f"[FACT] Relationship evidence between {retrieved['entity_a']} and {retrieved['entity_b']}: " + "; ".join(parts) + "."
        return {
            "question": question, "answer": answer,
            "claims": [{"type": "FACT", "text": answer}],
            "evidence": edges, "confidence": round(sum(e['confidence'] for e in edges) / len(edges), 2),
        }

    if kind == "bridge_entities":
        rows = retrieved["rows"]
        if not rows:
            return _no_evidence_response(question)
        names = ", ".join(f"{r['name']} (betweenness {r['betweenness_centrality']:.2f})" for r in rows[:8])
        answer = f"[FACT] The following entities act as bridges between otherwise separate parts of the network: {names}."
        return {
            "question": question, "answer": answer,
            "claims": [{"type": "FACT", "text": answer}],
            "evidence": rows, "confidence": None,
        }

    if kind == "network_summary":
        s = retrieved["summary"]
        answer = (
            f"[FACT] {retrieved['entity_name']} is connected to {s['connection_count']} entities "
            f"across {s['case_count']} case(s). "
            f"[INFERENCE] Network role: {s['role_label']} "
            f"(degree centrality {s['degree_centrality']:.2f}, betweenness {s['betweenness_centrality']:.2f})."
        )
        return {
            "question": question, "answer": answer,
            "claims": [{"type": "FACT", "text": answer}, {"type": "INFERENCE", "text": s['role_label']}],
            "evidence": s.get("evidence", []), "confidence": None,
        }

    return _no_evidence_response(question)


def answer_question(question: str, retrieved: Dict[str, Any]) -> Dict[str, Any]:
    """
    Single entry point used by the /ai/chat route. `retrieved` is always
    produced by the retrieval layer in routes/ai.py BEFORE this function is
    called — this function only ever formats/reasons over what was retrieved.
    """
    if settings.AI_PROVIDER == "template" or not _provider_key_present():
        return _format_template_answer(question, retrieved)

    # Real LLM path: still constrained to RETRIEVED_EVIDENCE only.
    try:
        return _call_llm_provider(question, retrieved)
    except Exception as exc:
        fallback = _format_template_answer(question, retrieved)
        fallback["provider_error"] = str(exc)
        return fallback


def _provider_key_present() -> bool:
    return bool(
        (settings.AI_PROVIDER == "groq" and settings.GROQ_API_KEY)
        or (settings.AI_PROVIDER == "gemini" and settings.GEMINI_API_KEY)
        or (settings.AI_PROVIDER == "openai" and settings.OPENAI_API_KEY)
    )


def _call_llm_provider(question: str, retrieved: Dict[str, Any]) -> Dict[str, Any]:
    """
    Thin abstraction so swapping Groq/Gemini/OpenAI is a config change.
    Left as an explicit integration point: wire your preferred SDK here.
    The prompt MUST include SYSTEM_INSTRUCTIONS + the retrieved evidence
    verbatim, and nothing else, to preserve hallucination control.
    """
    raise NotImplementedError(
        "Configure AI_PROVIDER credentials and implement the provider call here. "
        "Falling back to template mode."
    )

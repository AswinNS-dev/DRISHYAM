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
    Calls Gemini, Groq, or OpenAI REST APIs with structured evidence grounding.
    Falls back gracefully to template answer if network or provider fails.
    """
    import json
    import urllib.request
    import urllib.error

    provider = settings.AI_PROVIDER.lower()
    prompt = f"{SYSTEM_INSTRUCTIONS}\n\nRETRIEVED_EVIDENCE:\n{json.dumps(retrieved, indent=2)}\n\nQUESTION: {question}\n\nProvide an evidence-backed answer strictly based on the retrieved records."

    if provider == "gemini" and settings.GEMINI_API_KEY:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
        data = json.dumps({
            "contents": [{"parts": [{"text": prompt}]}]
        }).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=12) as response:
            res_json = json.loads(response.read().decode("utf-8"))
            answer_text = res_json["candidates"][0]["content"]["parts"][0]["text"]
            return {
                "question": question,
                "answer": answer_text,
                "claims": [{"type": "AI_SYNTHESIS", "text": answer_text}],
                "evidence": retrieved.get("connections") or retrieved.get("rows") or [],
                "confidence": 0.95,
                "provider": "gemini",
            }

    elif provider == "groq" and settings.GROQ_API_KEY:
        url = "https://api.groq.com/openai/v1/chat/completions"
        data = json.dumps({
            "model": "llama-3.3-70b-versatile",
            "messages": [
                {"role": "system", "content": SYSTEM_INSTRUCTIONS},
                {"role": "user", "content": f"RETRIEVED_EVIDENCE:\n{json.dumps(retrieved)}\n\nQUESTION: {question}"}
            ],
            "temperature": 0.2
        }).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings.GROQ_API_KEY}"
        })
        with urllib.request.urlopen(req, timeout=10) as response:
            res_json = json.loads(response.read().decode("utf-8"))
            answer_text = res_json["choices"][0]["message"]["content"]
            return {
                "question": question,
                "answer": answer_text,
                "claims": [{"type": "AI_SYNTHESIS", "text": answer_text}],
                "evidence": retrieved.get("connections") or [],
                "confidence": 0.92,
                "provider": "groq",
            }

    elif provider == "openai" and settings.OPENAI_API_KEY:
        url = "https://api.openai.com/v1/chat/completions"
        data = json.dumps({
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": SYSTEM_INSTRUCTIONS},
                {"role": "user", "content": f"RETRIEVED_EVIDENCE:\n{json.dumps(retrieved)}\n\nQUESTION: {question}"}
            ],
            "temperature": 0.2
        }).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}"
        })
        with urllib.request.urlopen(req, timeout=12) as response:
            res_json = json.loads(response.read().decode("utf-8"))
            answer_text = res_json["choices"][0]["message"]["content"]
            return {
                "question": question,
                "answer": answer_text,
                "claims": [{"type": "AI_SYNTHESIS", "text": answer_text}],
                "evidence": retrieved.get("connections") or [],
                "confidence": 0.94,
                "provider": "openai",
            }

    return _format_template_answer(question, retrieved)

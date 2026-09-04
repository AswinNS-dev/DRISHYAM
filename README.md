# DRISHYAM — AI-Powered Criminal Network Intelligence System

Built for **SIH26189** (Ministry of Home Affairs) — transforms fragmented,
multi-source law-enforcement records into an evidence-backed criminal
network that investigators can explore, analyze, and act on.

> All data in this build is **SYNTHETIC / DEMO DATA — NOT REAL POLICE DATA**.

## What's implemented

- **Multi-source ingestion**: FIR/report text import with live NLP extraction
- **NLP entity extraction**: PERSON, ALIAS, PHONE, VEHICLE, LOCATION, ORGANIZATION,
  GANG, CASE/FIR numbers, DATE, BANK_ACCOUNT, LEGAL_SECTION — each with a
  confidence score and the rule that fired
- **Entity resolution**: fuzzy name + alias + shared-identifier scoring,
  returns CONFIRMED / PROBABLE / POSSIBLE / UNRESOLVED — never silently merges
- **Evidence-backed relationship graph**: every edge carries source record,
  evidence id, and confidence
- **Graph intelligence**: degree/betweenness centrality, PageRank, community
  detection (greedy modularity), shortest path, connected components
- **Hidden-link discovery** (flagship feature): surfaces multi-hop chains
  that no single record reveals — verified working against a deliberately
  buried 5-hop chain in the seed data (person → phone → person → vehicle →
  person → account → gang)
- **Anomaly detection**: z-score based communication-burst / network-expansion
  detection, every anomaly ships with a numeric reason
- **Dossier 360**: full per-entity intelligence overview — identity, network
  position, connections, anomalies, evidence-backed insights
- **Case-centric workspace**: case → FIRs → accused entities → sub-network
- **Evidence-grounded AI investigation assistant**: retrieval-then-answer
  architecture; works with zero API key (deterministic template mode) or a
  real LLM (Groq/Gemini/OpenAI — abstraction point provided, not wired to a
  live key since none was supplied)
- **RBAC + JWT auth**, audit logging, intelligence alerts, report generation
- **Supabase-first schema** (`database/drishyam_supabase.sql`) with RLS,
  triggers, views, and seed data, with a zero-config SQLite fallback so the
  whole thing runs immediately without any cloud setup

## What's NOT yet built (scoped out of this pass — see note below)

`/firs`, `/intelligence`, `/timeline`, `/locations`, `/admin`, `/settings` as
separate pages; Neo4j adapter (intentionally optional per spec — the graph
is derived from Postgres/SQLite via NetworkX); geospatial map view; PDF/DOCX
report file export (report *content* generation works, file rendering
doesn't yet); real LLM provider wiring (the abstraction point exists in
`backend/app/ai/assistant.py::_call_llm_provider`, but needs your API key).

This was a deliberate scope cut to ship a fully-working, fully-tested core
rather than a wider surface of half-wired screens — every page and button
that exists does real work end-to-end. Ask and I'll build out any of the
above next.

## Quickstart (zero setup)

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
# → runs on http://localhost:8000, auto-creates SQLite DB, auto-seeds demo data

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
# → runs on http://localhost:5173
```

Log in with any of the seeded demo accounts (password `demo1234`):
- `investigator@drishyam.demo`
- `admin@drishyam.demo`
- `analyst@drishyam.demo`

## Try the flagship hidden-link discovery

1. Log in → **Network Intelligence**
2. Search "Ravi" → click the **Ravi Kumar** node
3. The right panel shows **Hidden Connection Discovered** — click it to
   highlight the 5-hop cross-source chain (phone record → surveillance →
   financial record → FIR) connecting him to Cobra Syndicate
4. Ask the AI assistant: *"Summarize the network around Ravi"* or
   *"Why was Ravi flagged as anomalous?"*

## Moving to Supabase

See `database/SUPABASE_SETUP.md`. tl;dr: run
`database/drishyam_supabase.sql` in the Supabase SQL Editor, fill in
`backend/.env` from `.env.example`, restart the backend — it detects the
Supabase credentials and switches off SQLite automatically.

## Architecture

```
React + TS + Vite + Tailwind  →  FastAPI  →  PostgreSQL (Supabase) / SQLite
                                     ↓
                        NetworkX graph engine (derived on read)
                                     ↓
                   NLP extraction · Entity resolution · Anomaly detection
```

See `backend/app/` for the full module breakdown (core, database, models,
routes, services, graph, nlp, entity_resolution, anomaly, ai).

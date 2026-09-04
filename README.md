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

## Features & Pages Overview

- **Cyberpunk Intelligence UI**: Glassmorphic HUD theme, glowing neon accents, particle network background, animated telemetry counters, and Recharts analytics.
- **Dashboard (`/dashboard`)**: Tactical intelligence overview, animated metric counters, entity radar, risk distribution breakdown, and activity sparklines.
- **Network Intel (`/network`)**: High-performance Canvas 2D force simulation graph, minimap, type-coded neon nodes, pulsating selection rings, path tracer particles, tactical dossier drawer, and evidence-grounded AI assistant.
- **Entities (`/entities`)**: Comprehensive entity registry with type filter tabs, risk badges, search, and slide-out 360-degree tactical dossiers.
- **Cases (`/cases`)**: Case management workspace linking FIRs, accused entities, and sub-networks.
- **FIRs (`/firs`)**: First Information Report browser with inline NLP entity highlighting (persons, phones, vehicles, locations).
- **Intelligence (`/intelligence`)**: Tri-tab operational intelligence center featuring Leads, Classified Reports, and Hidden Multi-Hop Links.
- **Timeline (`/timeline`)**: Chronological event stream visualizing case filings, communications, and movements along a vertical neon timeline.
- **Locations (`/locations`)**: Tactical radar hotspot monitor displaying coordinates, threat scores, and territorial crime cluster correlation.
- **Data Import (`/data-import`)**: Multi-source ingestion workspace with live NLP entity extraction and confidence metrics.
- **Alerts (`/alerts`)**: Critical anomaly feeds, cross-district syndicate alerts, and bridge entity detections.
- **Admin (`/admin`)**: RBAC user management, system telemetry indicators, and tamper-evident audit log ledger.
- **Settings (`/settings`)**: System calibration panel with AI provider configuration, confidence thresholds, and PII redaction settings.
- **Tactical Dossier Export**: Formatted, printable classified dossiers generated on demand.

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

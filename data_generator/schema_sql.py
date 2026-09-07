"""Canonical DDL for database/drishyam_complete.sql.

Based on the drishyam_supabase.sql baseline schema (same tables, columns,
relationships, views, triggers and RLS intent) with two compatibility changes
so the FastAPI backend (SQLAlchemy String columns + SQLite dev mode) and the
synthetic ID scheme (readable prefixed IDs) both work on PostgreSQL/Supabase:

* primary/foreign keys use TEXT with `gen_random_uuid()::text` defaults;
* RLS policies are wrapped so vanilla PostgreSQL (no `auth.role()`) also
  executes the script cleanly.

Everything is rerunnable: enums/types are guarded, policies are dropped first,
inserts use ON CONFLICT DO NOTHING.
"""

SCHEMA_DDL = """
-- =====================================================================
-- DRISHYAM - AI-Powered Criminal Network Intelligence System
-- Complete PostgreSQL / Supabase schema + synthetic seed dataset
--
-- Paste this ENTIRE file into: Supabase -> SQL Editor -> New Query -> Run
-- (or: psql -f drishyam_complete.sql on a fresh PostgreSQL database)
--
-- ALL ROWS ARE SYNTHETIC INTELLIGENCE - NOT REAL POLICE DATA.
-- =====================================================================

-- ---------- 1. EXTENSIONS ----------
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "pg_trgm";    -- fuzzy text search speedups

-- ---------- 2. ENUM TYPES ----------
do $$ begin
  create type user_role as enum
    ('admin','investigator','crime_analyst','inspector','policymaker','forensic','viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type data_source_type as enum ('LIVE','DEMO','SYNTHETIC','UNKNOWN');
exception when duplicate_object then null; end $$;

do $$ begin
  create type match_status_type as enum ('CONFIRMED','PROBABLE','POSSIBLE','REJECTED','UNRESOLVED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type severity_type as enum ('low','medium','high');
exception when duplicate_object then null; end $$;

-- ---------- 3. HELPER FUNCTIONS ----------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------- 4. AUTHENTICATION / ADMINISTRATION ----------
create table if not exists users (
  id text primary key default gen_random_uuid()::text,
  email text unique not null,
  full_name text not null,
  hashed_password text not null,
  role user_role not null default 'viewer',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists officers (
  id text primary key default gen_random_uuid()::text,
  user_id text references users(id) on delete set null,
  badge_number text unique,
  rank text,
  district text,
  created_at timestamptz not null default now()
);

-- ---------- 5. CORE ENTITY TABLES ----------
create table if not exists persons (
  id text primary key default gen_random_uuid()::text,
  full_name text not null,
  person_role text not null default 'associate'
    check (person_role in ('criminal','associate','victim','witness')),
  dob text,
  gender text,
  address text,
  risk_band text not null default 'unknown'
    check (risk_band in ('low','medium','high','unknown')),
  data_source data_source_type not null default 'SYNTHETIC',
  created_at timestamptz not null default now()
);
create index if not exists idx_persons_name_trgm on persons using gin (full_name gin_trgm_ops);

create table if not exists aliases (
  id text primary key default gen_random_uuid()::text,
  person_id text not null references persons(id) on delete cascade,
  alias_name text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_aliases_person on aliases(person_id);
create index if not exists idx_aliases_name_trgm on aliases using gin (alias_name gin_trgm_ops);

create table if not exists victims (
  id text primary key default gen_random_uuid()::text,
  person_id text not null references persons(id) on delete cascade,
  case_id text,
  created_at timestamptz not null default now()
);
create index if not exists idx_victims_person on victims(person_id);

create table if not exists phones (
  id text primary key default gen_random_uuid()::text,
  number text not null,
  owner_person_id text references persons(id) on delete set null,
  data_source data_source_type not null default 'SYNTHETIC',
  created_at timestamptz not null default now()
);
create index if not exists idx_phones_owner on phones(owner_person_id);
create index if not exists idx_phones_number on phones(number);

create table if not exists vehicles (
  id text primary key default gen_random_uuid()::text,
  registration_number text not null,
  owner_person_id text references persons(id) on delete set null,
  vehicle_type text,
  data_source data_source_type not null default 'SYNTHETIC',
  created_at timestamptz not null default now()
);
create index if not exists idx_vehicles_owner on vehicles(owner_person_id);
create index if not exists idx_vehicles_reg on vehicles(registration_number);

create table if not exists locations (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  district text,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  data_source data_source_type not null default 'SYNTHETIC',
  created_at timestamptz not null default now()
);
create index if not exists idx_locations_district on locations(district);

create table if not exists organizations (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  org_type text not null default 'organization' check (org_type in ('organization','gang')),
  data_source data_source_type not null default 'SYNTHETIC',
  created_at timestamptz not null default now()
);

create table if not exists gangs (
  id text primary key default gen_random_uuid()::text,
  organization_id text references organizations(id) on delete cascade,
  territory text,
  created_at timestamptz not null default now()
);

create table if not exists financial_accounts (
  id text primary key default gen_random_uuid()::text,
  account_number_masked text not null,
  owner_person_id text references persons(id) on delete set null,
  bank_name text,
  data_source data_source_type not null default 'SYNTHETIC',
  created_at timestamptz not null default now()
);
create index if not exists idx_financial_accounts_owner on financial_accounts(owner_person_id);

-- ---------- 6. FINANCIAL ----------
create table if not exists transactions (
  id text primary key default gen_random_uuid()::text,
  from_account_id text references financial_accounts(id) on delete set null,
  to_account_id text references financial_accounts(id) on delete set null,
  amount numeric(14,2) check (amount is null or amount >= 0),
  txn_date timestamptz,
  data_source data_source_type not null default 'SYNTHETIC',
  created_at timestamptz not null default now()
);
create index if not exists idx_transactions_from on transactions(from_account_id);
create index if not exists idx_transactions_to on transactions(to_account_id);
create index if not exists idx_transactions_date on transactions(txn_date);

-- ---------- 7. INVESTIGATION ----------
create table if not exists crime_cases (
  id text primary key default gen_random_uuid()::text,
  case_number text unique not null,
  title text not null,
  crime_type text,
  district text,
  status text not null default 'open'
    check (status in ('open','under_investigation','under_review','closed')),
  opened_at timestamptz not null default now(),
  data_source data_source_type not null default 'SYNTHETIC',
  created_at timestamptz not null default now()
);

create table if not exists firs (
  id text primary key default gen_random_uuid()::text,
  fir_number text unique not null,
  case_id text references crime_cases(id) on delete set null,
  narrative_text text not null,
  filed_at timestamptz not null default now(),
  location_id text references locations(id) on delete set null,
  data_source data_source_type not null default 'SYNTHETIC',
  created_at timestamptz not null default now()
);
create index if not exists idx_firs_case on firs(case_id);
create index if not exists idx_firs_filed on firs(filed_at);

create table if not exists investigation_notes (
  id text primary key default gen_random_uuid()::text,
  case_id text references crime_cases(id) on delete cascade,
  author_officer_id text references officers(id) on delete set null,
  note_text text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_notes_case on investigation_notes(case_id);

create table if not exists evidence (
  id text primary key default gen_random_uuid()::text,
  evidence_type text not null,
    -- FIR, CDR, SURVEILLANCE, FINANCIAL, INVESTIGATION_NOTE, ...
  source_record_id text,
  description text,
  storage_path text,
  storage_url text,
  file_hash text,
  mime_type text,
  confidence numeric(4,3) not null default 0.900 check (confidence between 0 and 1),
  data_source data_source_type not null default 'SYNTHETIC',
  created_at timestamptz not null default now()
);
create index if not exists idx_evidence_source on evidence(source_record_id);
create index if not exists idx_evidence_type on evidence(evidence_type);

create table if not exists evidence_metadata (
  id text primary key default gen_random_uuid()::text,
  evidence_id text not null references evidence(id) on delete cascade,
  key text not null,
  value text
);
create index if not exists idx_evidence_metadata_evidence on evidence_metadata(evidence_id);

create table if not exists chain_of_custody (
  id text primary key default gen_random_uuid()::text,
  evidence_id text not null references evidence(id) on delete cascade,
  handled_by text references officers(id) on delete set null,
  action text not null,
  occurred_at timestamptz not null default now()
);
create index if not exists idx_custody_evidence on chain_of_custody(evidence_id);

create table if not exists surveillance_records (
  id text primary key default gen_random_uuid()::text,
  location_id text references locations(id) on delete set null,
  person_id text references persons(id) on delete set null,
  vehicle_id text references vehicles(id) on delete set null,
  observed_at timestamptz not null default now(),
  notes text,
  data_source data_source_type not null default 'SYNTHETIC'
);
create index if not exists idx_surveillance_person on surveillance_records(person_id);
create index if not exists idx_surveillance_vehicle on surveillance_records(vehicle_id);
create index if not exists idx_surveillance_time on surveillance_records(observed_at);

create table if not exists cdr_records (
  id text primary key default gen_random_uuid()::text,
  phone_id text references phones(id) on delete set null,
  counterparty_number text,
  call_time timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  data_source data_source_type not null default 'SYNTHETIC'
);
create index if not exists idx_cdr_phone on cdr_records(phone_id);
create index if not exists idx_cdr_counterparty on cdr_records(counterparty_number);
create index if not exists idx_cdr_time on cdr_records(call_time);

-- ---------- 8. INTELLIGENCE ----------
create table if not exists entity_mentions (
  id text primary key default gen_random_uuid()::text,
  source_record_id text,
  source_record_type text, -- FIR, CDR, SURVEILLANCE, FINANCIAL
  entity_text text not null,
  entity_type text not null,
  confidence numeric(4,3) not null default 0.800 check (confidence between 0 and 1),
  span_start integer,
  span_end integer,
  extraction_model text default 'drishyam-ner-v1',
  resolved_entity_id text,
  created_at timestamptz not null default now()
);
create index if not exists idx_entity_mentions_source on entity_mentions(source_record_id);
create index if not exists idx_entity_mentions_resolved on entity_mentions(resolved_entity_id);

create table if not exists entity_matches (
  id text primary key default gen_random_uuid()::text,
  source_entity_id text not null,
  candidate_entity_id text not null,
  match_score numeric(4,3) not null check (match_score between 0 and 1),
  match_status match_status_type not null default 'UNRESOLVED',
  matching_method text,
  supporting_evidence jsonb default '[]'::jsonb,
  reviewed_by text references users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_entity_matches_status on entity_matches(match_status);

create table if not exists relationships (
  id text primary key default gen_random_uuid()::text,
  source_entity_id text not null,
  source_entity_type text not null
    check (source_entity_type in ('PERSON','PHONE','VEHICLE','BANK_ACCOUNT',
                                  'ORGANIZATION','GANG','LOCATION','CASE')),
  target_entity_id text not null,
  target_entity_type text not null
    check (target_entity_type in ('PERSON','PHONE','VEHICLE','BANK_ACCOUNT',
                                  'ORGANIZATION','GANG','LOCATION','CASE')),
  relationship_type text not null,
  confidence_score numeric(4,3) not null default 0.800 check (confidence_score between 0 and 1),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  source_record_id text,
  source_record_type text,
  evidence_id text references evidence(id) on delete set null,
  status text not null default 'active' check (status in ('active','archived','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_relationships_source on relationships(source_entity_id);
create index if not exists idx_relationships_target on relationships(target_entity_id);
create index if not exists idx_relationships_type on relationships(relationship_type);
create index if not exists idx_relationships_status on relationships(status);

create table if not exists network_analysis (
  id text primary key default gen_random_uuid()::text,
  entity_id text not null,
  degree_centrality numeric(6,4),
  betweenness_centrality numeric(6,4),
  pagerank numeric(6,4),
  computed_at timestamptz not null default now()
);
create index if not exists idx_network_analysis_entity on network_analysis(entity_id);

create table if not exists network_communities (
  id text primary key default gen_random_uuid()::text,
  community_label integer not null,
  entity_id text not null,
  computed_at timestamptz not null default now()
);
create index if not exists idx_network_communities_entity on network_communities(entity_id);

create table if not exists network_events (
  id text primary key default gen_random_uuid()::text,
  event_type text not null, -- NEW_ASSOCIATION, COMMUNICATION_BURST, HIDDEN_CHAIN_DISCOVERED...
  entity_id text,
  description text,
  occurred_at timestamptz not null default now()
);

create table if not exists anomalies (
  id text primary key default gen_random_uuid()::text,
  entity_id text not null,
  entity_type text not null default 'PERSON',
  anomaly_type text not null,
    -- COMMUNICATION_BURST, FINANCIAL_SPIKE, UNUSUAL_LOCATION,
    -- RAPID_VEHICLE_MOVEMENT, SUDDEN_NETWORK_EXPANSION, UNUSUAL_CALL_TIME
  reason text not null,
  severity severity_type not null default 'medium',
  related_entities jsonb default '[]'::jsonb,
  evidence_count integer not null default 0 check (evidence_count >= 0),
  created_at timestamptz not null default now()
);
create index if not exists idx_anomalies_entity on anomalies(entity_id);

create table if not exists intelligence_leads (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  description text,
  related_entities jsonb default '[]'::jsonb,
  confidence numeric(4,3),
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists intelligence_reports (
  id text primary key default gen_random_uuid()::text,
  report_type text not null,
  entity_id text,
  case_id text references crime_cases(id) on delete set null,
  title text not null,
  content_json jsonb default '{}'::jsonb,
  created_by text references users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- 9. APPLICATION ----------
create table if not exists notifications (
  id text primary key default gen_random_uuid()::text,
  user_id text references users(id) on delete cascade,
  title text not null,
  body text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists alerts (
  id text primary key default gen_random_uuid()::text,
  alert_type text not null,
  what_happened text not null,
  why_it_matters text not null,
  affected_entities jsonb default '[]'::jsonb,
  supporting_records jsonb default '[]'::jsonb,
  confidence numeric(4,3) not null default 0.800 check (confidence between 0 and 1),
  created_at timestamptz not null default now()
);

create table if not exists reports (
  id text primary key default gen_random_uuid()::text,
  report_id text references intelligence_reports(id) on delete cascade,
  file_format text not null, -- pdf, docx, csv, xlsx
  storage_path text,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id text primary key default gen_random_uuid()::text,
  user_id text references users(id) on delete set null,
  action text not null,
  details jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists import_jobs (
  id text primary key default gen_random_uuid()::text,
  job_type text not null, -- fir, cdr, financial, surveillance
  filename text,
  status text not null default 'completed',
  entities_extracted integer default 0,
  relationships_created integer default 0,
  created_at timestamptz not null default now()
);

create table if not exists model_metadata (
  id text primary key default gen_random_uuid()::text,
  model_name text not null,
  version text not null,
  purpose text,
  training_dataset text,
  features jsonb default '[]'::jsonb,
  training_date date,
  evaluation_metrics jsonb default '{}'::jsonb,
  is_demo_model boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------- 10. TRIGGERS ----------
drop trigger if exists trg_relationships_updated on relationships;
create trigger trg_relationships_updated
before update on relationships
for each row execute function set_updated_at();

-- ---------- 11. VIEWS ----------
create or replace view v_high_confidence_relationships as
  select * from relationships where confidence_score >= 0.85 and status = 'active';

create or replace view v_open_cases as
  select * from crime_cases where status = 'open';

create or replace view v_network_summary as
  select
    (select count(*) from persons) as total_persons,
    (select count(*) from relationships where status = 'active') as total_relationships,
    (select count(*) from anomalies) as total_anomalies,
    (select count(*) from alerts) as total_alerts,
    (select count(*) from crime_cases where status = 'open') as open_cases;

create or replace view v_dashboard_summary as
  select
    (select count(*) from persons)                                   as total_persons,
    (select count(*) from crime_cases where status = 'open')          as active_investigations,
    (select count(*) from firs)                                       as total_firs,
    (select count(*) from persons where risk_band = 'high')           as high_risk_entities,
    (select count(*) from cdr_records)                                as total_calls,
    (select count(*) from transactions)                               as total_transactions,
    (select count(*) from vehicles)                                   as total_vehicles,
    (select count(*) from financial_accounts)                         as total_accounts,
    (select count(*) from evidence)                                   as total_evidence,
    (select count(distinct community_label) from network_communities) as active_networks,
    (select count(*) from anomalies)                                  as detected_anomalies,
    (select count(*) from alerts)                                     as new_alerts;

-- ---------- 12. ROW LEVEL SECURITY ----------
-- The FastAPI backend connects with direct DB credentials (service role),
-- which bypass RLS by design. These policies protect direct anon client
-- access via the Supabase REST API. `auth.role()` only exists on Supabase,
-- so policy creation is guarded for vanilla PostgreSQL compatibility.
do $do$
begin
  if to_regproc('auth.role') is not null then
    execute $e$ alter table persons enable row level security $e$;
    execute $e$ alter table relationships enable row level security $e$;
    execute $e$ alter table evidence enable row level security $e$;
    execute $e$ alter table anomalies enable row level security $e$;
    execute $e$ alter table alerts enable row level security $e$;
    execute $e$ alter table audit_logs enable row level security $e$;
    execute $e$ alter table intelligence_reports enable row level security $e$;
    execute $e$ drop policy if exists authenticated_read_persons on persons $e$;
    execute $e$ create policy authenticated_read_persons on persons
      for select using (auth.role() = 'authenticated') $e$;
    execute $e$ drop policy if exists authenticated_read_relationships on relationships $e$;
    execute $e$ create policy authenticated_read_relationships on relationships
      for select using (auth.role() = 'authenticated') $e$;
    execute $e$ drop policy if exists authenticated_read_evidence on evidence $e$;
    execute $e$ create policy authenticated_read_evidence on evidence
      for select using (auth.role() = 'authenticated') $e$;
    execute $e$ drop policy if exists authenticated_read_anomalies on anomalies $e$;
    execute $e$ create policy authenticated_read_anomalies on anomalies
      for select using (auth.role() = 'authenticated') $e$;
    execute $e$ drop policy if exists authenticated_read_alerts on alerts $e$;
    execute $e$ create policy authenticated_read_alerts on alerts
      for select using (auth.role() = 'authenticated') $e$;
    execute $e$ drop policy if exists authenticated_read_reports on intelligence_reports $e$;
    execute $e$ create policy authenticated_read_reports on intelligence_reports
      for select using (auth.role() = 'authenticated') $e$;
    execute $e$ drop policy if exists service_role_only_audit on audit_logs $e$;
    execute $e$ create policy service_role_only_audit on audit_logs
      for all using (auth.role() = 'service_role') $e$;
  end if;
end $do$;
"""

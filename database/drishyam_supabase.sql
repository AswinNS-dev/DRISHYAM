-- =====================================================================
-- DRISHYAM — AI-Powered Criminal Network Intelligence System
-- Supabase / PostgreSQL initialization script
--
-- Paste this ENTIRE file into: Supabase -> SQL Editor -> New Query -> Run
-- After execution the complete DRISHYAM database is ready, including
-- demo/synthetic seed data (clearly marked as such — NOT real police data).
-- =====================================================================

-- ---------- EXTENSIONS ----------
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "pg_trgm";    -- fuzzy text search / ILIKE speedups

-- ---------- ENUM TYPES ----------
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

-- ---------- CORE APPLICATION TABLES ----------

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text not null,
  hashed_password text not null,
  role user_role not null default 'viewer',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists officers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  badge_number text unique,
  rank text,
  district text,
  created_at timestamptz not null default now()
);

-- ---------- ENTITY TABLES ----------

create table if not exists persons (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  person_role text not null default 'associate', -- criminal, associate, victim, witness
  dob text,
  gender text,
  address text,
  risk_band text not null default 'unknown',      -- low, medium, high, unknown
  data_source data_source_type not null default 'SYNTHETIC',
  created_at timestamptz not null default now()
);
create index if not exists idx_persons_name_trgm on persons using gin (full_name gin_trgm_ops);

create table if not exists aliases (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references persons(id) on delete cascade,
  alias_name text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_aliases_person on aliases(person_id);
create index if not exists idx_aliases_name_trgm on aliases using gin (alias_name gin_trgm_ops);

create table if not exists victims (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references persons(id) on delete cascade,
  case_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists phones (
  id uuid primary key default gen_random_uuid(),
  number text not null,
  owner_person_id uuid references persons(id) on delete set null,
  data_source data_source_type not null default 'SYNTHETIC',
  created_at timestamptz not null default now()
);
create index if not exists idx_phones_owner on phones(owner_person_id);
create index if not exists idx_phones_number on phones(number);

create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  registration_number text not null,
  owner_person_id uuid references persons(id) on delete set null,
  vehicle_type text,
  data_source data_source_type not null default 'SYNTHETIC',
  created_at timestamptz not null default now()
);
create index if not exists idx_vehicles_owner on vehicles(owner_person_id);
create index if not exists idx_vehicles_reg on vehicles(registration_number);

create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  district text,
  latitude double precision,
  longitude double precision,
  data_source data_source_type not null default 'SYNTHETIC',
  created_at timestamptz not null default now()
);
create index if not exists idx_locations_district on locations(district);

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  org_type text not null default 'organization', -- organization | gang
  data_source data_source_type not null default 'SYNTHETIC',
  created_at timestamptz not null default now()
);

create table if not exists gangs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  territory text,
  created_at timestamptz not null default now()
);

create table if not exists financial_accounts (
  id uuid primary key default gen_random_uuid(),
  account_number_masked text not null,
  owner_person_id uuid references persons(id) on delete set null,
  bank_name text,
  data_source data_source_type not null default 'SYNTHETIC',
  created_at timestamptz not null default now()
);
create index if not exists idx_financial_accounts_owner on financial_accounts(owner_person_id);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  from_account_id uuid references financial_accounts(id) on delete set null,
  to_account_id uuid references financial_accounts(id) on delete set null,
  amount numeric(14,2),
  txn_date timestamptz,
  data_source data_source_type not null default 'SYNTHETIC',
  created_at timestamptz not null default now()
);

-- ---------- INVESTIGATION TABLES ----------

create table if not exists crime_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text unique not null,
  title text not null,
  crime_type text,
  district text,
  status text not null default 'open',
  opened_at timestamptz not null default now(),
  data_source data_source_type not null default 'SYNTHETIC'
);

create table if not exists firs (
  id uuid primary key default gen_random_uuid(),
  fir_number text unique not null,
  case_id uuid references crime_cases(id) on delete set null,
  narrative_text text not null,
  filed_at timestamptz not null default now(),
  location_id uuid references locations(id) on delete set null,
  data_source data_source_type not null default 'SYNTHETIC'
);
create index if not exists idx_firs_case on firs(case_id);

create table if not exists investigation_notes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references crime_cases(id) on delete cascade,
  author_officer_id uuid references officers(id) on delete set null,
  note_text text not null,
  created_at timestamptz not null default now()
);

create table if not exists evidence (
  id uuid primary key default gen_random_uuid(),
  evidence_type text not null, -- FIR, CDR, SURVEILLANCE, FINANCIAL, INVESTIGATION_NOTE
  source_record_id text,
  description text,
  storage_path text,
  storage_url text,
  file_hash text,
  mime_type text,
  confidence numeric(4,3) not null default 0.900,
  data_source data_source_type not null default 'SYNTHETIC',
  created_at timestamptz not null default now()
);

create table if not exists evidence_metadata (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references evidence(id) on delete cascade,
  key text not null,
  value text
);

create table if not exists chain_of_custody (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references evidence(id) on delete cascade,
  handled_by uuid references officers(id) on delete set null,
  action text not null,
  occurred_at timestamptz not null default now()
);

create table if not exists surveillance_records (
  id uuid primary key default gen_random_uuid(),
  location_id uuid references locations(id) on delete set null,
  person_id uuid references persons(id) on delete set null,
  vehicle_id uuid references vehicles(id) on delete set null,
  observed_at timestamptz not null default now(),
  notes text,
  data_source data_source_type not null default 'SYNTHETIC'
);

create table if not exists cdr_records (
  id uuid primary key default gen_random_uuid(),
  phone_id uuid references phones(id) on delete set null,
  counterparty_number text,
  call_time timestamptz,
  duration_seconds integer,
  data_source data_source_type not null default 'SYNTHETIC'
);

-- ---------- INTELLIGENCE TABLES ----------

create table if not exists entity_mentions (
  id uuid primary key default gen_random_uuid(),
  source_record_id text,
  source_record_type text, -- FIR, CDR, SURVEILLANCE, FINANCIAL
  entity_text text not null,
  entity_type text not null,
  confidence numeric(4,3) not null default 0.800,
  span_start integer,
  span_end integer,
  extraction_model text default 'drishyam-ner-v1',
  resolved_entity_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_entity_mentions_source on entity_mentions(source_record_id);

create table if not exists entity_matches (
  id uuid primary key default gen_random_uuid(),
  source_entity_id text not null,
  candidate_entity_id text not null,
  match_score numeric(4,3) not null,
  match_status match_status_type not null default 'UNRESOLVED',
  matching_method text,
  supporting_evidence jsonb default '[]'::jsonb,
  reviewed_by uuid references users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_entity_matches_status on entity_matches(match_status);

create table if not exists relationships (
  id uuid primary key default gen_random_uuid(),
  source_entity_id text not null,
  source_entity_type text not null,
  target_entity_id text not null,
  target_entity_type text not null,
  relationship_type text not null,
  confidence_score numeric(4,3) not null default 0.800,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  source_record_id text,
  source_record_type text,
  evidence_id uuid references evidence(id) on delete set null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_relationships_source on relationships(source_entity_id);
create index if not exists idx_relationships_target on relationships(target_entity_id);
create index if not exists idx_relationships_type on relationships(relationship_type);

create table if not exists network_analysis (
  id uuid primary key default gen_random_uuid(),
  entity_id text not null,
  degree_centrality numeric(6,4),
  betweenness_centrality numeric(6,4),
  pagerank numeric(6,4),
  computed_at timestamptz not null default now()
);

create table if not exists network_communities (
  id uuid primary key default gen_random_uuid(),
  community_label integer not null,
  entity_id text not null,
  computed_at timestamptz not null default now()
);

create table if not exists network_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null, -- NEW_ASSOCIATION, COMMUNICATION_BURST, etc.
  entity_id text,
  description text,
  occurred_at timestamptz not null default now()
);

create table if not exists anomalies (
  id uuid primary key default gen_random_uuid(),
  entity_id text not null,
  entity_type text not null default 'PERSON',
  anomaly_type text not null,
  reason text not null,
  severity severity_type not null default 'medium',
  related_entities jsonb default '[]'::jsonb,
  evidence_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists intelligence_leads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  related_entities jsonb default '[]'::jsonb,
  confidence numeric(4,3),
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists intelligence_reports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null,
  entity_id text,
  case_id uuid references crime_cases(id) on delete set null,
  title text not null,
  content_json jsonb default '{}'::jsonb,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- APPLICATION TABLES ----------

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  title text not null,
  body text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  alert_type text not null,
  what_happened text not null,
  why_it_matters text not null,
  affected_entities jsonb default '[]'::jsonb,
  supporting_records jsonb default '[]'::jsonb,
  confidence numeric(4,3) not null default 0.800,
  created_at timestamptz not null default now()
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references intelligence_reports(id) on delete cascade,
  file_format text not null, -- pdf, docx, csv, xlsx
  storage_path text,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  action text not null,
  details jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists import_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null, -- fir, cdr, financial, surveillance
  filename text,
  status text not null default 'completed',
  entities_extracted integer default 0,
  relationships_created integer default 0,
  created_at timestamptz not null default now()
);

create table if not exists model_metadata (
  id uuid primary key default gen_random_uuid(),
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

-- ---------- TRIGGERS: keep updated_at fresh on relationships ----------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_relationships_updated on relationships;
create trigger trg_relationships_updated
before update on relationships
for each row execute function set_updated_at();

-- ---------- VIEWS ----------
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

-- ---------- ROW LEVEL SECURITY ----------
alter table persons enable row level security;
alter table relationships enable row level security;
alter table evidence enable row level security;
alter table anomalies enable row level security;
alter table alerts enable row level security;
alter table audit_logs enable row level security;
alter table intelligence_reports enable row level security;

-- Authenticated users (any assigned role) may read investigation data.
-- Viewer role is read-only everywhere; write policies restrict to
-- investigator/crime_analyst/admin via the application layer (service role),
-- since Supabase auth.uid()-based role mapping depends on your auth setup.
create policy "authenticated_read_persons" on persons
  for select using (auth.role() = 'authenticated');
create policy "authenticated_read_relationships" on relationships
  for select using (auth.role() = 'authenticated');
create policy "authenticated_read_evidence" on evidence
  for select using (auth.role() = 'authenticated');
create policy "authenticated_read_anomalies" on anomalies
  for select using (auth.role() = 'authenticated');
create policy "authenticated_read_alerts" on alerts
  for select using (auth.role() = 'authenticated');
create policy "authenticated_read_reports" on intelligence_reports
  for select using (auth.role() = 'authenticated');

-- audit_logs: readable by admins only (checked at application layer);
-- restrict direct table access to the service role.
create policy "service_role_only_audit" on audit_logs
  for all using (auth.role() = 'service_role');

-- NOTE: the FastAPI backend connects using the Postgres connection string
-- (service role / direct DB credentials), which bypasses RLS by design for
-- server-side business logic. RLS here protects against any direct
-- anon/authenticated client access via the Supabase client libraries.

-- =====================================================================
-- SEED / DEMO DATA
-- Everything below is SYNTHETIC INTELLIGENCE — NOT REAL POLICE DATA.
-- It exists purely to demonstrate the DRISHYAM pipeline end-to-end.
-- =====================================================================

insert into users (email, full_name, hashed_password, role) values
  ('investigator@drishyam.demo', 'Investigator Demo',
   '$2b$12$K8ZQXJ3H2n8p5nQeQ9m0aOe1v5r5s5r5s5r5s5r5s5r5s5r5s5r5u', 'investigator'),
  ('admin@drishyam.demo', 'Admin Demo',
   '$2b$12$K8ZQXJ3H2n8p5nQeQ9m0aOe1v5r5s5r5s5r5s5r5s5r5s5r5s5r5u', 'admin'),
  ('analyst@drishyam.demo', 'Analyst Demo',
   '$2b$12$K8ZQXJ3H2n8p5nQeQ9m0aOe1v5r5s5r5s5r5s5r5s5r5s5r5s5r5u', 'crime_analyst')
on conflict (email) do nothing;
-- NOTE: the placeholder bcrypt hashes above are NOT valid for login.
-- The FastAPI backend seeds working demo credentials on first startup via
-- app/services/seed.py (same three accounts, password: demo1234) so that
-- login works immediately whether you run against SQLite or this Supabase
-- schema. Re-hash and UPDATE these rows if you seed via SQL only.

insert into organizations (name, org_type, data_source) values
  ('Cobra Syndicate', 'gang', 'SYNTHETIC'),
  ('Silver Line Network', 'gang', 'SYNTHETIC'),
  ('Harbour Road Group', 'gang', 'SYNTHETIC'),
  ('North Star Outfit', 'gang', 'SYNTHETIC'),
  ('Red Sand Gang', 'gang', 'SYNTHETIC'),
  ('Coastal Freight Pvt Ltd', 'organization', 'SYNTHETIC'),
  ('Sunrise Traders', 'organization', 'SYNTHETIC')
on conflict do nothing;

insert into locations (name, district, latitude, longitude, data_source) values
  ('Central Market Junction', 'Chengalpattu', 12.6819, 79.9864, 'SYNTHETIC'),
  ('Harbour Road', 'Chennai South', 13.0827, 80.2707, 'SYNTHETIC'),
  ('North Bus Stand', 'Coimbatore', 11.0168, 76.9558, 'SYNTHETIC')
on conflict do nothing;

-- Deliberate hidden-chain demo entities (mirrors the FastAPI seed logic):
-- Ravi Kumar (alias Rocky) -> Phone -> Arjun Nair -> Vehicle -> Suresh Pillai
-- -> Financial Account -> Cobra Syndicate, each hop only visible in a
-- DIFFERENT record type/source, so only graph traversal reveals the chain.
do $$
declare
  v_ravi uuid; v_arjun uuid; v_suresh uuid;
  v_phone uuid; v_vehicle uuid; v_account uuid; v_gang uuid;
  v_case uuid; v_loc uuid;
  v_ev1 uuid; v_ev2 uuid; v_ev3 uuid; v_ev4 uuid; v_ev5 uuid; v_ev6 uuid;
begin
  select id into v_gang from organizations where name = 'Cobra Syndicate' limit 1;
  select id into v_loc from locations where name = 'Central Market Junction' limit 1;

  insert into persons (full_name, person_role, risk_band, data_source)
    values ('Ravi Kumar', 'criminal', 'medium', 'SYNTHETIC') returning id into v_ravi;
  insert into persons (full_name, person_role, risk_band, data_source)
    values ('Arjun Nair', 'associate', 'low', 'SYNTHETIC') returning id into v_arjun;
  insert into persons (full_name, person_role, risk_band, data_source)
    values ('Suresh Pillai', 'associate', 'medium', 'SYNTHETIC') returning id into v_suresh;

  insert into aliases (person_id, alias_name) values (v_ravi, 'Rocky');

  insert into phones (number, owner_person_id, data_source)
    values ('9876543210', v_arjun, 'SYNTHETIC') returning id into v_phone;
  insert into vehicles (registration_number, owner_person_id, vehicle_type, data_source)
    values ('KA01AB1234', v_suresh, 'car', 'SYNTHETIC') returning id into v_vehicle;
  insert into financial_accounts (account_number_masked, owner_person_id, bank_name, data_source)
    values ('XXXX7788', v_suresh, 'SBI', 'SYNTHETIC') returning id into v_account;

  insert into crime_cases (case_number, title, crime_type, district, status, data_source)
    values ('CASE-901', 'Cross-district extortion — hidden network probe', 'extortion',
            'Chengalpattu', 'open', 'SYNTHETIC') returning id into v_case;

  insert into firs (fir_number, case_id, narrative_text, location_id, data_source)
    values ('FIR-2026-0142', v_case,
            'Ravi alias Rocky met Arjun Nair near Central Market Junction. They used phone 9876543210.',
            v_loc, 'SYNTHETIC');

  insert into evidence (evidence_type, source_record_id, description, confidence, data_source)
    values ('FIR', 'FIR-2026-0142', 'Ravi and Arjun co-mentioned; phone 9876543210 referenced', 0.93, 'SYNTHETIC')
    returning id into v_ev1;
  insert into evidence (evidence_type, source_record_id, description, confidence, data_source)
    values ('CDR', 'CDR-3210', 'Call detail record ties phone 9876543210 to Arjun Nair', 0.96, 'SYNTHETIC')
    returning id into v_ev2;
  insert into evidence (evidence_type, source_record_id, description, confidence, data_source)
    values ('SURVEILLANCE', 'SR-44', 'Surveillance places Arjun Nair using vehicle KA01AB1234', 0.88, 'SYNTHETIC')
    returning id into v_ev3;
  insert into evidence (evidence_type, source_record_id, description, confidence, data_source)
    values ('SURVEILLANCE', 'SR-45', 'Vehicle KA01AB1234 associated with Suresh Pillai', 0.85, 'SYNTHETIC')
    returning id into v_ev4;
  insert into evidence (evidence_type, source_record_id, description, confidence, data_source)
    values ('FINANCIAL', 'TXN-7788', 'Financial record links Suresh Pillai to account XXXX7788', 0.90, 'SYNTHETIC')
    returning id into v_ev5;
  insert into evidence (evidence_type, source_record_id, description, confidence, data_source)
    values ('FIR', 'FIR-2026-0201', 'Account XXXX7788 traced to Cobra Syndicate in follow-up investigation', 0.82, 'SYNTHETIC')
    returning id into v_ev6;

  insert into relationships (source_entity_id, source_entity_type, target_entity_id, target_entity_type,
    relationship_type, confidence_score, evidence_id, source_record_id, source_record_type)
    values
    (v_ravi::text, 'PERSON', v_phone::text, 'PHONE', 'COMMUNICATED_WITH', 0.93, v_ev1, 'FIR-2026-0142', 'FIR'),
    (v_phone::text, 'PHONE', v_arjun::text, 'PERSON', 'USED_PHONE', 0.96, v_ev2, 'CDR-3210', 'CDR'),
    (v_arjun::text, 'PERSON', v_vehicle::text, 'VEHICLE', 'USED_VEHICLE', 0.88, v_ev3, 'SR-44', 'SURVEILLANCE'),
    (v_vehicle::text, 'VEHICLE', v_suresh::text, 'PERSON', 'USED_VEHICLE', 0.85, v_ev4, 'SR-45', 'SURVEILLANCE'),
    (v_suresh::text, 'PERSON', v_account::text, 'BANK_ACCOUNT', 'LINKED_TO', 0.90, v_ev5, 'TXN-7788', 'FINANCIAL'),
    (v_account::text, 'BANK_ACCOUNT', v_gang::text, 'ORGANIZATION', 'LINKED_TO', 0.82, v_ev6, 'FIR-2026-0201', 'FIR');

  insert into anomalies (entity_id, entity_type, anomaly_type, reason, severity, related_entities, evidence_count)
    values (v_ravi::text, 'PERSON', 'COMMUNICATION_BURST',
            'Communication frequency increased 4.2x above historical baseline over the last 7 days.',
            'high', jsonb_build_array(v_arjun::text, v_suresh::text, v_phone::text), 23);

  insert into alerts (alert_type, what_happened, why_it_matters, affected_entities, supporting_records, confidence)
    values ('POTENTIAL_BRIDGE_ENTITY',
            'Arjun Nair identified as a bridge connecting Ravi Kumar''s cluster to Cobra Syndicate.',
            'Bridge entities often represent intermediaries worth prioritizing for surveillance.',
            jsonb_build_array(v_ravi::text, v_arjun::text, v_suresh::text),
            jsonb_build_array(v_ev1::text, v_ev2::text, v_ev3::text), 0.87);
end $$;

insert into model_metadata (model_name, version, purpose, training_dataset, is_demo_model)
  values
  ('drishyam-ner-v1', '1.0', 'Rule-based entity extraction (PERSON/PHONE/VEHICLE/LOCATION/etc.)', 'Synthetic FIR corpus', true),
  ('drishyam-entity-resolution-v1', '1.0', 'Fuzzy + contextual identity resolution', 'Synthetic alias corpus', true),
  ('drishyam-anomaly-v1', '1.0', 'Z-score based interaction anomaly detection', 'Synthetic relationship timeline', true)
on conflict do nothing;

-- =====================================================================
-- END OF SCRIPT — DRISHYAM database is now initialized.
-- Next: configure Storage buckets (see SUPABASE_SETUP.md) and point the
-- FastAPI backend's .env at this project.
-- =====================================================================

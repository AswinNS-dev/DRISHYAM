# DRISHYAM — Supabase Setup

DRISHYAM runs with **zero setup** against a local SQLite database by default
(see the main README). Follow this guide only when you're ready to move to
a real Supabase-backed deployment.

## 1. Create a Supabase project
Go to https://supabase.com/dashboard → New Project. Note the database
password you set — you'll need it below.

## 2. Run the schema
1. Open your project → **SQL Editor** → **New Query**.
2. Open `database/drishyam_supabase.sql` from this repo.
3. Copy the entire file and paste it into the SQL editor.
4. Click **Run**.

You should see tables, indexes, RLS policies, and demo seed rows created.
Check **Table Editor** to confirm tables like `persons`, `relationships`,
`crime_cases` exist and contain rows (Ravi Kumar, Arjun Nair, Suresh Pillai,
etc. — the deliberately-hidden demo chain).

## 3. Configure Storage buckets
Go to **Storage** → **New bucket**. Create:
- `fir-documents` (private)
- `evidence-files` (private)
- `generated-reports` (private)

Leave all buckets **private**; the FastAPI backend accesses them with the
service-role key, never the anon key.

## 4. Get your connection credentials
**Project Settings → Database** gives you the host, port, database name,
and user. **Project Settings → API** gives you the project URL and
`service_role` key.

## 5. Configure the backend
Copy `backend/.env.example` to `backend/.env` and fill in:

```env
SUPABASE_DB_HOST=db.<your-project-ref>.supabase.co
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=<your-db-password>
SUPABASE_DB_SSLMODE=require

SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_SERVICE_KEY=<service-role-key>
```

**Never** put `SUPABASE_SERVICE_KEY` in the frontend or any client-side code.

## 6. Start the backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```
On startup the app detects `SUPABASE_DB_HOST` is set and connects to
Postgres instead of SQLite. Because the SQL script already seeded demo
data, `AUTO_SEED` will detect existing users and skip re-seeding.

## 7. Start the frontend
```bash
cd frontend
npm install
npm run dev
```

## 8. Log in
Use one of the seeded demo accounts (password `demo1234` for all):
- `investigator@drishyam.demo`
- `admin@drishyam.demo`
- `analyst@drishyam.demo`

> **Note:** the placeholder password hashes inserted by the raw SQL script
> are not valid bcrypt hashes for login (SQL alone can't compute bcrypt).
> The FastAPI backend's own seed routine creates working demo logins with
> the same emails/roles on first startup against any empty `users` table —
> so log in via the backend-seeded accounts. If you seed purely through SQL
> and skip the FastAPI auto-seed, re-hash and `UPDATE users SET
> hashed_password = ...` for each demo account first.

---

## Troubleshooting

**Connection errors ("could not connect to server")**
Check `SUPABASE_DB_HOST`/`PORT` are exactly as shown in Project Settings →
Database, and that `SUPABASE_DB_SSLMODE=require` is set — Supabase requires
SSL.

**RLS errors ("new row violates row-level security policy")**
The FastAPI backend connects with direct Postgres credentials (service
role equivalent) and bypasses RLS by design for server-side writes. RLS
errors mean you're hitting the DB through the anon/authenticated Supabase
client instead — that path is intentionally read-only per the policies in
`drishyam_supabase.sql`.

**Missing tables**
Re-run `drishyam_supabase.sql` — every statement uses `create table if not
exists` / `on conflict do nothing`, so it's safe to re-run.

**Storage permission errors**
Confirm the three buckets exist and are marked private, and that the
backend uses the `service_role` key (not `anon`) for any Storage writes.

**Invalid environment variables**
Compare your `.env` against `backend/.env.example` — a common mistake is
leaving `SUPABASE_DB_PASSWORD` blank, which silently falls back to SQLite
(by design, so a misconfigured `.env` never hard-crashes the app).

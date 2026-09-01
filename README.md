# AgriLink — SIH 2026 (PS 26132)

A market-linkage and price-discovery platform for smallholder farmers and FPOs in
Maharashtra. It aggregates government mandi prices, shows localised 7/30/90-day price
trends and a nearest-market comparison, and gives an **explainable** sell-now-vs-wait
recommendation (rule-based, every number shown) — in English, Hindi, or Marathi. Later
phases add phone-OTP auth, farmer↔buyer matching, deal tracking, and an Android (Cordova)
wrap. See `.planning/` for the full roadmap and phase history.

**Status:** Phase 1 (Price Discovery & i18n Shell) complete.

## Prerequisites

- **Docker** + **Docker Compose** (runs PostgreSQL 16)
- **Python 3.13** with the backend virtualenv already created at `backend/venv`
  (deps: `pip install -r backend/requirements.txt`)
- **Node.js** + **npm** with `frontend/node_modules` installed (`cd frontend && npm install`)

> On Windows the venv Python is `backend/venv/Scripts/python.exe`. On macOS/Linux use
> `backend/venv/bin/python` and adjust the commands below accordingly.

## Quickstart (local, offline-safe)

Run these in order. The app works with **no internet** — if the data.gov.in API is
unreachable it falls back to a committed Maharashtra snapshot, then to synthetic fixtures.

1. **Database** — `docker compose up -d db`
   Postgres 16 on host port **5433** (a native PostgreSQL install commonly holds 5432).
2. **Migrations** (first run, or after pulling new migrations) —
   `cd backend && venv/Scripts/python.exe -m alembic upgrade head`
   The API also runs this automatically on startup (idempotent); running it by hand first
   makes failures obvious.
3. **Backend API** —
   `cd backend && venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000`
4. **Frontend** —
   `cd frontend && node node_modules/next/dist/bin/next dev -p 3000`
   Use this, **not** `npm run dev` — the wrapper exits code 1 when backgrounded in a
   non-TTY shell on this setup.
5. Open **http://localhost:3000**

To reset the database from scratch, see [backend/README.md](backend/README.md) → Migrations.

## Tests

```bash
cd backend && venv/Scripts/python.exe -m pytest -q
```

```bash
cd frontend && npm run test
```

Both suites run offline. `npm run test` includes a locale key-parity check that fails if
`hi.json` / `mr.json` drift from `en.json`.

## Configuration

Copy `backend/.env.example` to `backend/.env` (gitignored — **never commit it**):

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Must point at **:5433**, e.g. `postgresql+psycopg2://agrilink:agrilink@localhost:5433/agrilink` |
| `DATA_GOV_IN_API_KEY` | Optional. Blank → ingestion uses the committed snapshot / fixtures |
| `INGEST_TRIGGER_SECRET` | Blank → `POST /api/ingest/run` is disabled (returns 403). Set a long random string to enable it; send it as the `X-Ingest-Secret` header |
| `ARRIVALS_SOURCE_URL` | Leave blank — no live arrivals source exists in Phase 1 (tracked as PRICE-07) |
| `CORS_ORIGINS` | Comma-separated allowed origins; default `http://localhost:3000` |

Frontend: `frontend/.env` (optional) — `NEXT_PUBLIC_API_URL` defaults to
`http://localhost:8000` when unset.

## Layout

```
backend/    FastAPI + SQLAlchemy 2.0 + Alembic + APScheduler   → backend/README.md
frontend/   Next.js 16 (App Router) + next-intl + recharts     → frontend/README.md
.planning/  GSD phase artifacts (roadmap, research, plans, summaries)
```

## More detail

- [backend/README.md](backend/README.md) — run, migrations & DB reset, tests, env vars, data sources, the arrivals limitation
- [frontend/README.md](frontend/README.md) — run, tests, i18n model, config

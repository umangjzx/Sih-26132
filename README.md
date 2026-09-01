# AgriLink — SIH 2026 (PS 26132)

A market-linkage and price-discovery platform for smallholder farmers and FPOs.
It aggregates government mandi prices, shows localised 7/30/90-day price trends
and a nearest-market comparison, and gives an **explainable** sell-now-vs-wait
recommendation (rule-based, every number shown) — in English, Hindi, or Marathi.
On top of prices it layers weather, MSP, crop-calendar, transport-adjusted
"best market", cold-storage / FPO discovery, price alerts, and a public
price-transparency dashboard. Phone-OTP auth connects farmers and buyers through
scored matches, offer threads, deal tracking, and a dispute + admin workflow.

Built Maharashtra-first (the SIH problem statement is Govt. of Maharashtra /
MSInS) but **location-aware across India** — pick or detect a location and prices
re-scope to that state; the curated directory covers the major producing states.

**Status:** Phases 1–3 complete (price discovery & i18n · auth & matching · deals,
disputes & admin), plus the v1.1 intelligence layer and v1.2 location awareness.
See `.planning/` for the full roadmap and phase history.

## Prerequisites

- **Docker** + **Docker Compose** (runs PostgreSQL 16)
- **Python 3.13** with the backend virtualenv at `backend/venv`
  (`pip install -r backend/requirements.txt`)
- **Node.js** + **npm** with `frontend/node_modules` installed (`cd frontend && npm install`)

> On Windows the venv Python is `backend/venv/Scripts/python.exe`. On macOS/Linux use
> `backend/venv/bin/python` and adjust the commands below accordingly.

## Quickstart (local, offline-safe)

Run these in order. The app works with **no internet** — if the data.gov.in API is
unreachable, ingestion falls back to a committed Maharashtra snapshot, then to
synthetic fixtures. Every external call (weather, routing, geocoding, holidays)
degrades to a neutral/empty result, so the UI never blanks.

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

## Features

**Prices (public, no login)**
- `/prices` — 7/30/90-day trend (area chart), min/modal/max, and a horizontal
  nearest-market comparison against the selected market.
- `/advisor` — the full sell / wait / hold call as a gauge, with every input
  shown: price momentum, weather pressure, MSP gap, crop-calendar phase, and the
  next mandi holiday.
- `/directory` — cold storage / warehouses and FPOs near a district, with
  distance and capacity.
- `/explore` — statewide price transparency: movers, average-price trend, and
  activity counters. Re-scopes to the chosen state.
- `/alerts` — price-crosses-target alerts + an in-app notification bell.

**Location awareness (v1.2)**
- Header location chip: browser geolocation, free-text place search, or an
  all-India state picker. Persisted in `localStorage`.
- Prices, options, and the public overview scope to the chosen state. Scheduled
  ingestion pulls `INGEST_STATES` (default `Maharashtra`); a user's state is
  pulled on demand (rate-limited) if not yet cached; `INGEST_STATES=ALL` pulls
  the whole national feed.
- Crop calendar stays Maharashtra-tuned (region-specific agronomy); MSP and the
  storage / FPO directory are all-India.

**Accounts & trade (phone-OTP auth)**
- `/farmer` list lots · `/buyer` post demands · scored matches (quantity + price
  overlap + distance) · offer threads · deal pipeline · disputes.
- `/admin` — dashboard with price trend, dispute queue, district price gaps, and
  price anomalies.

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
| `INGEST_TRIGGER_SECRET` | Blank → `POST /api/ingest/run` is disabled (403). Set a long random string to enable it; send it as the `X-Ingest-Secret` header |
| `INGEST_STATES` | States the scheduler ingests — comma-separated (e.g. `Maharashtra,Karnataka`), or `ALL` for the whole national feed. Default `Maharashtra` |
| `JWT_SECRET_KEY` | Required for auth — a long random string (`openssl rand -hex 32`). Blank → tokens fail to verify (local demo only) |
| `WEATHER_API_KEY` | Optional. Set an OpenWeatherMap key to enrich the forecast with current conditions; blank → keyless Open-Meteo only |
| `ARRIVALS_SOURCE_URL` | Leave blank — no live daily-arrivals source exists (tracked as PRICE-07) |
| `CORS_ORIGINS` | Comma-separated allowed origins; default `http://localhost:3000` |

Google Earth Engine variables (`GEE_*`) may be present in `.env` but are **not wired** —
satellite crop-health is deferred.

Frontend: `frontend/.env` (optional) — `NEXT_PUBLIC_API_URL` defaults to
`http://localhost:8000` when unset.

## Data sources

All free; all with an offline fallback.

| Source | Used for |
|---|---|
| data.gov.in AGMARKNET | mandi prices (state-filtered) |
| Open-Meteo | 7-day forecast + geocoding |
| OpenWeatherMap *(optional key)* | current conditions overlay |
| NASA POWER | rainfall vs 10-year normal |
| OSRM | road distance for transport-adjusted "best market" |
| BigDataCloud | reverse-geocode (lat/lon → state + district) |
| Nager.Date | upcoming mandi holidays |
| curated (`app/services/reference.py`) | MSP, crop calendar, cold storage / FPO directory |

## Layout

```
backend/    FastAPI + SQLAlchemy 2.0 + Alembic + APScheduler + httpx   → backend/README.md
frontend/   Next.js 16 (App Router) + next-intl + recharts + Tailwind  → frontend/README.md
.planning/  phase artifacts (roadmap, research, plans, summaries)
```

## More detail

- [backend/README.md](backend/README.md) — run, migrations & DB reset, tests, env vars, data sources, the arrivals limitation
- [frontend/README.md](frontend/README.md) — run, tests, i18n model, config

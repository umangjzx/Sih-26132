# AgriLink backend

FastAPI + SQLAlchemy 2.0 + Alembic + APScheduler. Serves Pillar A (price discovery):
`/api/options`, `/api/prices/trend`, `/api/prices/nearby`, `/api/prices/signal`,
`POST /api/ingest/run`, `/health`.

Windows paths below use `venv/Scripts/python.exe`; on macOS/Linux use `venv/bin/python`.

## Run

Prerequisite: the database container is up — `docker compose up -d db` from the repo root
(Postgres 16 on host port **5433**).

```bash
cd backend && venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The app runs `alembic upgrade head` automatically at startup (idempotent) before serving,
then seeds `PriceCache` if it is empty and starts the 6-hour ingestion scheduler.

## Migrations

Alembic is the single schema authority (there is no `create_all`). `Base` carries a
deterministic constraint naming convention; `alembic/env.py` imports `app.models` so all
tables register on `Base.metadata`.

```bash
# apply all migrations
cd backend && venv/Scripts/python.exe -m alembic upgrade head

# create a new migration after changing models
cd backend && venv/Scripts/python.exe -m alembic revision --autogenerate -m "describe change"
```

Always run `alembic` from `backend/` so pydantic-settings resolves `backend/.env`.

### Resetting / reconciling the database

- **Clean reset (primary path)** — Phase 1 persists only regenerable `price_cache`
  data, so recreating the volume is safe:
  ```bash
  docker compose down -v && docker compose up -d db
  cd backend && venv/Scripts/python.exe -m alembic upgrade head
  ```
- **Adopt an existing schema without recreating the volume** (schema already matches the
  models, data must be preserved):
  ```bash
  cd backend && venv/Scripts/python.exe -m alembic stamp head
  ```
- **Manual fallback** if the startup auto-upgrade fails: run `alembic upgrade head` by hand
  (same command as above).

## Tests

```bash
cd backend && venv/Scripts/python.exe -m pytest -q
```

Tests run against SQLite in-memory with a `get_db` override — no container needed. Tests
marked `pg` (the Postgres-only `on_conflict_do_update` upsert path) are opt-in:

```bash
cd backend && venv/Scripts/python.exe -m pytest -q -m "not pg"   # skip the Postgres-only test
```

Covered: `signal.compute_signal` (the 7 sell/wait/hold cases), `geo.district_distance_km`,
`ingestion.normalize_rows` and `resolve_ingestion_rows`, the live→snapshot→fixture
fallback, and one smoke test per `/api/prices/*` route plus the `POST /api/ingest/run`
403/200 pair.

## Data sources

Ingestion (`app/services/ingestion.py` → `resolve_ingestion_rows()`) tries, in order:

1. **Live** — data.gov.in AGMARKNET resource `9ef84268-d588-465a-a308-a864a43d0070`,
   Maharashtra, paginated. Requires `DATA_GOV_IN_API_KEY`. Never called on a user request —
   only from startup seeding and the scheduler.
2. **Committed snapshot** — `app/services/data/maharashtra_snapshot.csv` (the resource's
   exact 10-field schema; authentic Maharashtra market/commodity names and prices). Used
   ahead of fixtures **only when it is dense enough to stand alone** — at least
   `SNAPSHOT_MIN_SERIES_POINTS` (7) dated points for some market+crop series. The bundled
   sample is deliberately small, so in practice the offline path is fixtures.
3. **Synthetic fixtures** — `app/services/fixtures.py` (deterministic, seed 26132): 90 days
   across every market+crop, and the only source that carries `arrival_volume`. This is the
   normal offline seed and what the dashboard demo runs on.

**Arrivals limitation (PRICE-07):** the OGD price resource has **no arrivals/volume
field**, and no other data.gov.in JSON resource exposes daily arrivals. So `arrival_volume`
is `null` on live and snapshot rows, and the sell/wait signal's volume factor runs on
fixture data only — on real data it prints *"Arrival-volume data isn't available for this
market, so this factor was skipped."* rather than pretending. The `fetch_arrivals_rows()`
seam in `ingestion.py` is present but off unless `ARRIVALS_SOURCE_URL` is set; wiring a
non-OGD arrivals source is tracked as PRICE-07 (v2).

## Environment variables

Copy `.env.example` to `.env` (gitignored — never commit it). Placeholders only in docs.

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Must point at **:5433** — `postgresql+psycopg2://agrilink:agrilink@localhost:5433/agrilink` |
| `DATA_GOV_IN_API_KEY` | Optional. Blank → snapshot/fixture fallback |
| `INGEST_TRIGGER_SECRET` | Blank → `POST /api/ingest/run` returns 403 (disabled). Set it, then send `X-Ingest-Secret: <value>`; compared in constant time |
| `ARRIVALS_SOURCE_URL` | Leave blank in Phase 1 (see PRICE-07 above) |
| `CORS_ORIGINS` | Comma-separated; default `http://localhost:3000`. CORS is limited to `GET, POST` with no credentials until Phase 2 auth lands |

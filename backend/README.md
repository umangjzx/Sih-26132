# AgriLink backend

FastAPI + SQLAlchemy 2.0 + Alembic + APScheduler + httpx.

Route groups (all under `/api`):

| Group | Endpoints |
|---|---|
| Prices | `options`, `prices/trend`, `prices/nearby`, `prices/signal`, `POST ingest/run` |
| Intelligence (v1.1) | `weather/forecast`, `msp`, `calendar`, `storage/nearby`, `fpo/nearby`, `markets/best`, `holidays/upcoming` |
| Public | `public/overview` |
| Location (v1.2) | `location/resolve`, `location/states` |
| Auth | `auth/register`, `auth/login` (phone + PBKDF2 password), `auth/refresh`, `auth/me` |
| Trade | `lots`, `demands`, `matches`, `offers`, `deals`, `disputes`, `history` |
| Alerts | `alerts`, `notifications` |
| Admin | `admin/dashboard` |

Plus `/health`. Windows paths below use `venv/Scripts/python.exe`; on macOS/Linux use `venv/bin/python`.

## Run

Prerequisite: the database container is up — `docker compose up -d db` from the repo root
(Postgres 16 on host port **5433**).

```bash
cd backend && venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The app runs `alembic upgrade head` automatically at startup (idempotent) before serving,
then seeds `PriceCache` if it is empty and starts the 6-hour ingestion scheduler (which
also evaluates price alerts). Ingestion pulls the states named in `INGEST_STATES`
(default `Maharashtra`).

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

`tests/` covers the sell/wait signal cases and MSP/weather factors, geo distance and
`nearest_state`, ingestion normalize + live→snapshot→fixture fallback + state override,
the weather OpenWeather enrichment, location resolve / state-filtered options + overview,
the intelligence endpoints (MSP, calendar, storage/FPO, best-market), login + token
refresh, lots / demands / matching / offers / deals / disputes / history, alerts, and
the admin dashboard.

## Data sources

Ingestion (`app/services/ingestion.py` → `resolve_ingestion_rows()`) tries, in order:

1. **Live** — data.gov.in AGMARKNET resource `9ef84268-d588-465a-a308-a864a43d0070`,
   paginated, filtered to the states in `INGEST_STATES` (or unfiltered when `ALL`).
   Requires `DATA_GOV_IN_API_KEY`. Called from startup seeding, the scheduler, and the
   rate-limited on-demand pull when a user picks a state with no cached prices.
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

### Other external services (v1.1 / v1.2)

All keyless except OpenWeatherMap, all wrapped so a failure returns a neutral/empty result:
Open-Meteo (forecast + geocoding), NASA POWER (rainfall anomaly), OSRM (road distance),
BigDataCloud (reverse-geocode), Nager.Date (mandi holidays). MSP, the crop calendar, and
the cold-storage / FPO directory are curated in `app/services/reference.py` — Maharashtra
in detail plus a national sample of the major producing states.

## Environment variables

Copy `.env.example` to `.env` (gitignored — never commit it). Placeholders only in docs.

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Must point at **:5433** — `postgresql+psycopg2://agrilink:agrilink@localhost:5433/agrilink` |
| `DATA_GOV_IN_API_KEY` | Optional. Blank → snapshot/fixture fallback |
| `INGEST_TRIGGER_SECRET` | Blank → `POST /api/ingest/run` returns 403 (disabled). Set it, then send `X-Ingest-Secret: <value>`; compared in constant time |
| `INGEST_STATES` | Comma-separated states the scheduler ingests, or `ALL`. Default `Maharashtra` |
| `JWT_SECRET_KEY` | Required for auth — long random string. Blank → tokens fail to verify (local demo only). Also `JWT_ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS` |
| `WEATHER_API_KEY` | Optional OpenWeatherMap key — enriches the forecast with current conditions. Blank → Open-Meteo only |
| `TRANSPORT_COST_PER_QTL_KM` | ₹/quintal/km used by `markets/best`. Default `0.4` |
| `ARRIVALS_SOURCE_URL` | Leave blank (see PRICE-07 above) |
| `CORS_ORIGINS` | Comma-separated; default `http://localhost:3000` |

`GEE_*` variables may exist in `.env` but are not read — satellite crop-health is deferred.

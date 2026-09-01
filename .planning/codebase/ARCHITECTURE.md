# Architecture

**Analysis Date:** 2026-09-01

## Pattern Overview

**Overall:** Decoupled SPA + REST API + cached-external-data.

**Key Characteristics:**
- Next.js frontend is entirely client-rendered on the price route (`"use client"` down from `page.tsx`) — deliberately, so the same UI can wrap in a Cordova WebView with no Next.js server.
- FastAPI backend is a thin REST layer over SQLAlchemy models plus a few stateless service functions.
- Government price data is **pulled on a schedule into `PriceCache`** and served from the local DB — never fetched live during a user request.

## Layers

**Frontend — presentation (`src/components`, `src/app`):**
- Purpose: render dashboards, collect selections
- Contains: React client components, recharts wrappers, i18n via `useTranslations`
- Depends on: `src/lib/api.ts`, `src/i18n`
- Used by: the browser / (later) Cordova WebView

**Frontend — data access (`src/lib/api.ts`):**
- Purpose: typed `fetch` helpers to the REST API, base URL from `NEXT_PUBLIC_API_URL`
- Depends on: nothing (plain fetch)

**Backend — API (`app/api/prices.py`):**
- Purpose: HTTP routes, query params, response shaping via Pydantic schemas
- Depends on: models, services, `get_db`

**Backend — services (`app/services/*`):**
- Purpose: stateless logic — ingestion, fixtures, signal computation, geo distance
- Depends on: models + config; `ingestion` also depends on httpx + data.gov.in

**Backend — models (`app/models/*`):**
- Purpose: SQLAlchemy 2.0 declarative tables
- `PriceCache` is live (Pillar A). `User/Lot/Demand/Match/Offer/Deal/Dispute` exist but are unused scaffolding for Pillars B/C.

**Backend — core (`app/core/*`):**
- `config.py` (settings from `.env`), `database.py` (engine/session/Base/`get_db`)

## Data Flow

**Price dashboard load:**
1. `PriceDashboard` mounts → `fetchOptions()` → `GET /api/options` → distinct crop/market/district from `PriceCache`
2. On crop/market/days change → `Promise.all` of `GET /api/prices/trend`, `/api/prices/signal`, `/api/prices/nearby`
3. Backend queries `PriceCache`, `signal.compute_signal` derives the recommendation, `geo.district_distance_km` ranks nearby markets
4. Components render chart, signal card, table; skeletons show while the promise is pending

**Ingestion:**
1. App startup lifespan → `create_all` → if `PriceCache` empty, `run_ingestion(db)`
2. `run_ingestion`: if `DATA_GOV_IN_API_KEY` set → `fetch_maharashtra_rows` (paginated httpx) → `normalize_rows` → `upsert_price_rows` (PG `on_conflict_do_update` on the unique key). On any failure/empty → `generate_fixture_rows()`.
3. APScheduler repeats the job every 6 hours.

## Notable design choices
- **Explainability first**: `signal.py` returns a list of human-readable `reasons` with every number inlined; recommendation is a weighted integer score (price factor ×2, volume factor ×1) thresholded to `sell_now` / `wait` / `hold`.
- **Offline-safe geo**: hardcoded district centroids, haversine distance — no geocoding API.
- **Graceful degradation**: fixtures ensure the UI always has data; the signal drops the volume factor and says so when `arrival_volume` is null.

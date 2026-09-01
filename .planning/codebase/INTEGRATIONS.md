# Integrations

**Analysis Date:** 2026-09-01

## data.gov.in — AGMARKNET daily mandi prices (PRIMARY, live)
- **Resource ID:** `9ef84268-d588-465a-a308-a864a43d0070`
- **Endpoint:** `GET https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070`
- **Params used:** `api-key`, `format=json`, `offset`, `limit=1000`, `filters[state]=Maharashtra`
- **Auth:** free API key at data.gov.in → My Account → API Key. Stored in `backend/.env` as `DATA_GOV_IN_API_KEY` (a real key is already present). Never commit.
- **Client:** `app/services/ingestion.py` → `fetch_maharashtra_rows()` — httpx, 20s timeout, paginates until `offset >= total` or a short page.
- **Fields consumed:** `state, district, market, commodity, variety, arrival_date, min_price, max_price, modal_price` (lowercase snake_case — specific to this resource).
- **Known gap:** this resource has **no arrivals/volume field** → `arrival_volume` stored as `None` on every live row → the signal's volume factor never fires on live data.
- **Failure handling:** any exception, missing key, or zero usable rows → fall back to `fixtures.generate_fixture_rows()`. Last observed live call in this environment **timed out**, so the running app is on fixture data.
- **Cadence:** once at startup if `PriceCache` is empty, then every 6 hours (APScheduler). Not called on user requests.

## Fixture data (fallback, offline)
- `app/services/fixtures.py` — deterministic (`seed=26132`) synthetic 90-day random walk, 5 markets (Pune, Lasalgaon, Ahmednagar, Solapur, Nagpur) × 5 crops (Onion, Tur, Cotton, Soybean, Tomato), **with** synthetic `arrival_volume` and a weekly arrival cycle.
- Section 4.2 of the brief also allows a manual CSV/JSON export from the dataset page as a seed snapshot — not yet wired in.

## Geocoding / distance (static, offline)
- `app/services/geo.py` — hardcoded `DISTRICT_CENTROIDS` for ~36 Maharashtra districts + haversine. No external geo API. PostGIS not in use (may be added if match scoring needs real geo).

## PostgreSQL
- `docker-compose.yml` service `db` (`postgres:16`), host **5433**. `DATABASE_URL` in `backend/.env`.

## CORS
- `CORS_ORIGINS` env (comma-separated) → `app.main` `CORSMiddleware`. Default `http://localhost:3000`.

## Not yet integrated (future phases)
- SMS/OTP provider (Phase 2 auth — delivery stubbed for the demo)
- Payment gateway, logistics provider, KYC provider — all explicitly stubbed / out of scope

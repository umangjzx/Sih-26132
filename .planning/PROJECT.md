# AgriLink

## What This Is

A market-linkage and price-discovery platform for smallholder farmers and FPOs in
Maharashtra, built for SIH 2026 Problem Statement 26132 (Govt. of Maharashtra /
Maharashtra State Innovation Society). It aggregates government mandi prices, gives
localised price trends and an explainable sell-now-vs-wait signal, matches farmers/FPOs
with verified buyers, and tracks deals from match to payment with a lightweight dispute
flag.

## Core Value

A farmer opens the app and, in their own language, sees what their crop is worth in
nearby markets and a plain-language recommendation on whether to sell now or wait —
so they walk into a sale with better information than they had before.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. -->

- [ ] Pillar A — Price discovery: mandi price feed by crop + market + district from the
      real data.gov.in AGMARKNET dataset; 7/30/90-day trend charts; nearest-market
      comparison; rule-based, explainable sell-now-vs-wait signal
- [ ] i18n-first UI shell: English default, Hindi + Marathi locale files, visible
      language switcher, all strings as translation keys, Devanagari-capable fonts
- [ ] Pillar B — Lot creation (farmer/FPO), demand posting (buyer), rule-based match
      scoring, ranked matches, offer/counter-offer thread, buyer verification badge (stub)
- [ ] Pillar C — Deal record from accepted match, pipeline
      Matched → Offer Accepted → Logistics Arranged → Delivered → Paid → Closed,
      dispute flag per deal, per-user transaction history
- [ ] Roles: Farmer/FPO, Buyer, Admin (read-only oversight dashboard)
- [ ] Auth: JWT with phone-number OTP login
- [ ] Cordova Android wrap once the web app is stable

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Real payment gateway — hackathon scope; payment is status-tracking only
- Real logistics / fleet integration — "platform-arranged" is a stub mode
- Full KYC / document verification — `kyc_status` is a stub flag, not real verification
- ML price forecasting — signal must be rule-based and explainable
- Price feeds outside Maharashtra — problem statement is Maharashtra-scoped
- Live geocoding API — static Maharashtra district centroids keep distance calc free/offline

## Context

- **Users**: rural, sometimes low-literacy, sometimes low-bandwidth farmers/FPOs on
  Android phones, alongside professional buyers on desktop, plus MSInS/mandi admins.
- **Existing code**: Phase 1 (Pillar A) is substantially built already —
  - Backend (FastAPI): `PriceCache` model, daily ingestion job (live data.gov.in with
    fixture fallback), APScheduler 6h interval, endpoints `/api/options`,
    `/api/prices/trend`, `/api/prices/nearby`, `/api/prices/signal`, `/api/ingest/run`,
    `/health`. Rule-based signal in `app/services/signal.py`. Static district centroids
    in `app/services/geo.py`. Models for Pillars B/C already declared but have no
    endpoints/schemas/services yet.
  - Frontend (Next.js 16 App Router, Turbopack): client-rendered `PriceDashboard`,
    recharts trend chart, sell/wait card, nearby-markets table, `next-intl` with a
    client-side `LocaleProvider` (localStorage, no locale routing), en/hi/mr messages,
    Noto Sans + Noto Sans Devanagari, earthy green/ochre palette, 44px tap targets.
  - Infra: `docker-compose.yml` runs `postgres:16`. Real `DATA_GOV_IN_API_KEY` already
    in `backend/.env`.
- **Known local quirk**: a native PostgreSQL 18 service occupies host port 5432, so the
  Docker DB is mapped to **5433** and `backend/.env` points there.
- **No auth yet**, **no Alembic migrations** (uses `Base.metadata.create_all`), **no tests**.
- data.gov.in field names are lowercase snake_case for this resource; other resource IDs
  do not follow the same convention.
- The chosen data.gov.in resource has **no arrival-volume field**, so `arrival_volume`
  is always null on live rows and the signal's volume factor is inert on live data
  (fixtures do carry synthetic volume).

## Constraints

- **Tech stack**: Next.js (App Router, TypeScript) frontend, FastAPI (Python) backend,
  PostgreSQL, JWT + phone OTP auth, `next-intl` i18n — fixed by the problem brief.
- **Cordova compatibility**: Cordova-bound pages must be a standard client-rendered SPA
  calling the REST API — no Next.js server actions / server-only features on those routes,
  because a Cordova WebView cannot run a Next.js server.
- **Explainability**: the sell/wait signal must be rule-based and show its reasoning —
  no ML, no black box.
- **i18n from day one**: every UI string is a translation key; adding a language = adding
  a locale file. English fully built first, then Hindi + Marathi.
- **Low-bandwidth**: lightweight pages, skeleton loading, offline-tolerant lot-creation
  forms (queue and sync when back online).
- **Data**: price data is cached in `PriceCache` and refreshed by a scheduled job —
  never call data.gov.in live on a user request. API key stays in `.env`, never committed.
- **Timeline**: SIH 2026 hackathon — depth is "hackathon-demo", not production.

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Docker Postgres on host port 5433 | Native PG18 service holds 5432 on this machine | ✓ Good |
| Client-side `LocaleProvider` (no `[locale]` routing) | Keeps pages Cordova-safe (no server middleware) | — Pending |
| data.gov.in resource `9ef84268-…-a864a43d0070` as price source | Named in the problem brief; real official daily data | — Pending |
| Fixture fallback when live API missing/fails/empty | App must demo without depending on live API uptime | ✓ Good |
| Rule-based weighted signal (price 2x + volume 1x → sell_now/wait/hold) | Explainability constraint; every number shown in the reason | — Pending |
| Static district centroids for distance | Free, offline-safe, good enough for match scoring | — Pending |

## Evolution

**After each phase transition:**
1. Requirements invalidated? → move to Out of Scope with reason
2. Requirements validated? → move to Validated with phase reference
3. New requirements emerged? → add to Active
4. Decisions to log? → add to Key Decisions
5. "What This Is" still accurate? → update if drifted

---
*Last updated: 2026-09-01 after GSD onboarding*

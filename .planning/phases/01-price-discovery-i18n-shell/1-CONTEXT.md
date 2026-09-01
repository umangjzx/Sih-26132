# Phase 1: Price Discovery & i18n Shell - Context

**Gathered:** 2026-09-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver Pillar A (price discovery & market intelligence) end to end plus the
internationalised UI shell, hardened to demo quality. A farmer picks a crop and market
and sees: latest min/modal/max price, a 7/30/90-day modal-price trend chart, a
nearest-market comparison, and a rule-based, fully explainable sell-now / wait / hold
recommendation — in English, Hindi, or Marathi, switchable from the header.

Everything auth-related, lot/demand/matching (Pillar B), and deal tracking (Pillar C)
are OUT of this phase. Phase 1 is 100% public — price discovery needs no login.

Phase 1 is a **harden + complete** phase: the ingestion job, the four `/api/prices/*`
endpoints, the signal, the charts, and the en/hi/mr shell already exist in the codebase
(commit d12cc76). This phase closes gaps, adds a real arrivals data source, adds
migrations and focused tests, and ships a green local run + PR.

</domain>

<decisions>
## Implementation Decisions

### Price data source
- **D-01:** Keep the current primary resource `9ef84268-d588-465a-a308-a864a43d0070`
  (Variety-wise Daily Market Prices) for min/max/modal price + crop/market/district/date.
- **D-02 (REVISED 2026-09-01 after research):** There is **no data.gov.in JSON resource
  that exposes daily arrival volume** — a live call confirmed `9ef84268-…` returns only
  10 fields (no arrivals), and it IS the "Current Daily Price (Mandi)" dataset, so there
  is no distinct second resource to add. Arrivals exist only in non-OGD sources
  (CEDA Ashoka API, India Data Portal CKAN, agmarknet.gov.in HTML), none demo-verified.
  **Decision: implement the fallback.** Keep the volume factor in the signal, powered by
  fixture + committed-CSV-snapshot data only. On live data `arrival_volume` stays null
  and the signal's reason text says so explicitly (do NOT silently drop the factor —
  see D-07). Scaffold an **off-by-default** `fetch_arrivals_rows()` seam in
  `app/services/ingestion.py` (no live source wired) so a future phase can add a non-OGD
  arrivals source without restructuring. Record the limitation in code + README.
- **D-03:** Arrivals still merge onto `PriceCache` rows on (market, crop, date) with
  variety best-effort — this governs the fixture/snapshot volume population and the
  future `fetch_arrivals_rows()` seam. Volume rows never create price-less rows;
  unmatched volume is dropped.
- **D-04:** Ingestion stays scheduled-only (never on a user request). Seed/refresh
  order: **live API → committed Maharashtra CSV snapshot → synthetic fixtures**
  (`fixtures.generate_fixture_rows`, seed 26132, which carries synthetic
  `arrival_volume`). The CSV snapshot is a real Maharashtra data.gov.in export
  (authentic market/commodity names + prices, no arrivals) committed under the backend.
  Any source missing/failing/empty falls through to the next.
- **D-05:** Gate `POST /api/ingest/run` behind a shared-secret header (env
  `INGEST_TRIGGER_SECRET`) in Phase 1 — cheap protection for a write endpoint before
  real auth exists in Phase 2. 403 without the header.

### Sell/wait signal
- **D-06:** Keep the existing rule-based weighted model in `app/services/signal.py`
  (price factor ×2 + volume factor ×1 → integer score → `sell_now` / `wait` / `hold`),
  with every driving number inlined in `reasons`. No ML.
- **D-07 (REVISED):** Per revised D-02, the volume factor fires only on
  fixture/snapshot data. On live data every row has `arrival_volume = null`, so the
  signal MUST keep the existing "skip the volume factor and say so in the reason"
  behaviour (e.g. "Arrival-volume data isn't available for this market, so this factor
  was skipped."). The factor stays in the code, weighted and tested — it is dormant,
  not deleted.
- **D-08:** Add a short unit-test suite for `compute_signal` covering: sell_now,
  wait, hold, <7 days (None), 7–13 days (no MA-30), and volume present vs absent.

### Nearest-market comparison
- **D-09:** Add a distance cap of **≤ 200 km** and a **top-8** limit to
  `/api/prices/nearby`; keep "same crop, latest reported date for that crop" logic.
  Markets with unknown district centroid still sort last (current behaviour).
- **D-10:** Keep district-centroid haversine (`app/services/geo.py`); no PostGIS in
  Phase 1.

### Migrations
- **D-11:** Adopt **Alembic** in Phase 1. Generate an initial migration covering
  `price_cache` AND the already-declared-but-dormant Pillar B/C tables (users, lots,
  demands, matches, offers, deals, disputes) so Phase 2 auth work starts from a real
  migration baseline.
- **D-12:** Replace `Base.metadata.create_all` in `app/main.py` lifespan with
  "run `alembic upgrade head` on startup" (or document `alembic upgrade head` as a
  required step). Keep it idempotent for the demo.

### Testing
- **D-13:** Backend: **pytest**. Cover pure logic — `signal.compute_signal`,
  `geo.district_distance_km`, `ingestion.normalize_rows` (+ the new arrivals
  normaliser) — plus one FastAPI `TestClient` smoke test per `/api/prices/*` route
  against a seeded fixture DB (SQLite or a disposable schema). Add a `pytest` command
  to backend docs.
- **D-14:** Frontend: **vitest** + React Testing Library. Cover: `SellWaitSignalCard`
  renders each recommendation + its reasons; `LanguageSwitcher` changes locale and
  persists; a render test that `PriceDashboard` shows skeletons then data with
  `lib/api` mocked. Add `test` to `package.json` scripts.
- **D-15:** Not exhaustive — no e2e/Playwright, no coverage gate in Phase 1.

### i18n
- **D-16:** Keep the client-side `LocaleProvider` (localStorage, no `/[locale]`
  routing) — required to stay Cordova-safe. Add a mount-time guard so there's no
  visible English flash before the stored locale loads (render nothing / a skeleton
  until locale is resolved).
- **D-17:** Add a **key-parity check**: a script/test that fails if `hi.json` or
  `mr.json` is missing any key present in `en.json` (run in `npm test` / CI).
- **D-18:** Keep en/hi/mr. Do a light terminology pass on the Hindi/Marathi mandi
  terms (e.g. modal price, arrivals, "sell now") for plausibility — not a
  professional translation review.
- **D-19:** English remains the default and the source of truth for keys.

### Accessibility / performance
- **D-20:** Keep the earthy palette tokens, Noto Sans + Noto Sans Devanagari, global
  44px min tap target, focus-visible outlines, skeletons.
- **D-21:** Add a retry affordance to the dashboard error state (currently a static
  message). Keep payloads light; no heavy client libs beyond recharts.

### Ship
- **D-22:** Phase 1 "Ship" = green local run (documented start commands for
  Docker DB on :5433, backend on :8000, `node node_modules/next/dist/bin/next dev`
  for the frontend) + a PR to `origin` (`github.com/umangjzx/Sih-26132`). No
  deployment in Phase 1; hosting decided before Phase 4 (Cordova).

### Resolved after research (2026-09-01) — accepted recommendations
- **Alembic:** do BOTH — `command.upgrade(cfg, "head")` in the FastAPI lifespan (idempotent)
  AND document `alembic upgrade head` as the manual command in the backend README.
  Add a `MetaData(naming_convention=…)` to `Base` before the first autogen.
- **Seed order:** live API → committed Maharashtra CSV snapshot → synthetic fixtures (D-04).
- **i18n terminology:** Hindi/Marathi "modal price" rendering as "average price"
  (औसत भाव / सरासरी भाव) is acceptable for low-literacy users — note it in the D-18
  plausibility pass, do not treat as a bug.
- **pytest DB:** pure-function tests need no DB; the 4 read endpoints run on
  SQLite-in-memory + `get_db` override; extract `resolve_ingestion_rows()` so the
  Postgres-only `on_conflict_do_update` path is not exercised in tests; use a bare
  `TestClient(app)` (NOT the `with` form) so APScheduler doesn't boot.

### Claude's Discretion
- Exact Alembic `env.py` / `alembic.ini` layout and directory location.
- Test file organisation.
- The `fetch_arrivals_rows()` seam's internal shape (it has no live source in Phase 1).
- Chart/skeleton/error-state visual details within the existing design system.
- Whether the CSV-snapshot seed lives under `backend/app/services/` or a `backend/seeds/` dir.

</decisions>

<specifics>
## Specific Ideas

- The signal must read like advice from a knowledgeable neighbour: plain sentences,
  every rupee figure and percentage shown, no jargon, no hidden model. This is the
  product's core value — protect it.
- "The app always has something to show" — fixtures/snapshot fallback is a feature,
  not a dev convenience. A judge with no internet must still see a working dashboard.
- Keep the two-`<select>` crop/market picker for the demo. Typeahead + district filter
  for the hundreds of live markets is deferred to v2 (REQUIREMENTS.md v2).

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope & requirements
- `.planning/PROJECT.md` — scope, constraints, key decisions, out-of-scope list
- `.planning/REQUIREMENTS.md` — PRICE-01..06, I18N-01..05, A11Y-01..03, PERF-01 (this phase); v2 list
- `.planning/ROADMAP.md` §"Phase 1" — goal + 6 success criteria this phase is verified against

### Existing codebase (map)
- `.planning/codebase/ARCHITECTURE.md` — layers, data flow (dashboard load + ingestion), design choices
- `.planning/codebase/INTEGRATIONS.md` — data.gov.in resource `9ef84268-…`, params, field names, the no-arrivals gap, fixture generator
- `.planning/codebase/CONVENTIONS.md` — SQLAlchemy 2.0 style, router pattern, `useTranslations` rule, palette tokens
- `.planning/codebase/CONCERNS.md` — dead volume signal, `/nearby` ignoring day-window, exact-string crop matching, create_all/no-migrations, open ingest endpoint
- `.planning/codebase/STACK.md` — versions, run commands, the `npm run dev` background quirk
- `.planning/codebase/TESTING.md` — no tests today; recommended first targets

### Key backend files to modify
- `backend/app/services/ingestion.py` — add arrivals ingestion + snapshot seed
- `backend/app/services/signal.py` — keep model; ensure volume factor fires on live data
- `backend/app/api/prices.py` — `/nearby` cap+limit; `/ingest/run` secret gate
- `backend/app/main.py` — Alembic upgrade in lifespan instead of `create_all`
- `backend/app/models/price_cache.py` + all Pillar B/C models — initial Alembic migration

### Key frontend files to modify
- `frontend/src/i18n/LocaleProvider.tsx` — no-flash guard
- `frontend/src/i18n/messages/{en,hi,mr}.json` — key parity + terminology pass
- `frontend/src/components/PriceDashboard.tsx` — retry affordance

### External (Plan-phase research)
- data.gov.in catalog `current-daily-price-various-commodities-various-markets-mandi`
  — verify the exact resource ID and whether the JSON API exposes an arrivals field;
  confirm Maharashtra filtering and field names before wiring D-02.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/services/ingestion.py` `fetch_maharashtra_rows` / `normalize_rows` / `upsert_price_rows` — pattern to copy for the arrivals resource
- `app/services/fixtures.py` — already emits synthetic `arrival_volume`; the volume-signal tests can lean on it
- `app/services/signal.py` — volume-factor code path already written and dormant; D-02 just feeds it real data
- `app/services/geo.py` `district_distance_km` — reuse directly for the D-09 distance cap
- `frontend/src/lib/api.ts` — typed fetch helpers; mock target for vitest
- `frontend/src/app/globals.css` — palette + a11y tokens already defined; new UI reuses them

### Established Patterns
- One `APIRouter(prefix="/api")` per domain; `Depends(get_db)`; Pydantic `response_model`
- Models one-per-file, re-exported in `app/models/__init__.py` (Alembic `target_metadata` = `Base.metadata` will see them all)
- All frontend copy via `useTranslations("<ns>")`; snake_case JSON mirrored 1:1 in TS types

### Integration Points
- Alembic replaces `Base.metadata.create_all` in `app/main.py` lifespan
- Arrivals ingestion writes `arrival_volume` onto existing `PriceCache` rows
- `/api/prices/signal` output already carries `volume_trend_pct` / `days_of_data` — no schema change needed for D-02

</code_context>

<deferred>
## Deferred Ideas

- Typeahead / district-filtered crop+market picker for hundreds of live markets — v2 (REQUIREMENTS.md)
- Second AGMARKNET resource purely for forecasting inputs / ML — out of scope (explainable rules only)
- PostGIS geo queries — v2, only if centroid distance proves too coarse for Phase 2 match scoring
- Live public deployment + hosted Postgres + CORS/`NEXT_PUBLIC_API_URL` hardening — before Phase 4
- Real SMS OTP, KYC, payment, logistics — Phases 2–3 / out of scope
- `/[locale]` URL routing + SSR i18n — not while the Cordova constraint holds

</deferred>

---

*Phase: 01-price-discovery-i18n-shell*
*Context gathered: 2026-09-01*

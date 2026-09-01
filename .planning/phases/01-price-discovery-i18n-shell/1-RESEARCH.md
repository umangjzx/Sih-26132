# Phase 1: Price Discovery & i18n Shell - Research

**Researched:** 2026-09-01
**Domain:** Harden-and-complete of a FastAPI + SQLAlchemy 2.0 price-cache backend and a Next.js 16 / React 19 / next-intl client SPA — data ingestion, Alembic adoption, first test suites, i18n no-flash + key parity
**Confidence:** HIGH on tooling (Alembic, pytest, vitest, next-intl client pattern); HIGH on the arrivals finding (verified against the live API); MEDIUM on non-OGD arrivals alternatives (portal pages 403'd to automated fetch)

<user_constraints>
## User Constraints (from 1-CONTEXT.md)

### Locked Decisions (NON-NEGOTIABLE — copied verbatim)

**Price data source**
- **D-01:** Keep the current primary resource `9ef84268-d588-465a-a308-a864a43d0070`
  (Variety-wise Daily Market Prices) for min/max/modal price + crop/market/district/date.
- **D-02:** ADD a second data.gov.in AGMARKNET ingestion for **arrival volume**, so the
  signal's volume factor works on live data (not just fixtures). Candidate resource:
  the "Current daily price of various commodities from various markets (Mandi)" dataset
  (catalog `current-daily-price-various-commodities-various-markets-mandi`), which the
  portal documents as carrying arrivals. **The exact resource ID and whether the JSON
  API actually exposes an arrivals field is a Plan-phase research task** — data.gov.in
  field names and availability differ per resource; do not assume snake_case parity with
  D-01. If research finds no live resource that reliably exposes arrivals via API,
  fall back to: keep the volume factor powered by fixtures for the demo and log the
  limitation (do NOT silently drop it).
- **D-03:** Merge strategy — arrivals join onto `PriceCache` rows on
  (market, crop, variety, date). Arrivals ingestion is a separate function/job in
  `app/services/ingestion.py`; it updates `arrival_volume` on existing rows and does not
  create price-less rows. Name/variety mismatch between the two resources is expected —
  match on (market, crop, date) with variety best-effort; unmatched arrivals are dropped.
- **D-04:** Both ingestions stay scheduled-only (never on a user request). Keep the
  fixture fallback (`fixtures.generate_fixture_rows`, seed 26132, with synthetic volume)
  for any source that is missing/fails/empty. Also wire the §4.2 manual CSV/JSON export
  path: a committed Maharashtra snapshot the job can seed from offline.
- **D-05:** Gate `POST /api/ingest/run` behind a shared-secret header (env
  `INGEST_TRIGGER_SECRET`) in Phase 1 — cheap protection for a write endpoint before
  real auth exists in Phase 2. 403 without the header.

**Sell/wait signal**
- **D-06:** Keep the existing rule-based weighted model in `app/services/signal.py`
  (price factor ×2 + volume factor ×1 → integer score → `sell_now` / `wait` / `hold`),
  with every driving number inlined in `reasons`. No ML.
- **D-07:** With D-02 in place, the volume factor should fire on live data. Keep the
  "degrade gracefully + say so in the reason" behaviour for rows where `arrival_volume`
  is still null.
- **D-08:** Add a short unit-test suite for `compute_signal` covering: sell_now,
  wait, hold, <7 days (None), 7–13 days (no MA-30), and volume present vs absent.

**Nearest-market comparison**
- **D-09:** Add a distance cap of **≤ 200 km** and a **top-8** limit to
  `/api/prices/nearby`; keep "same crop, latest reported date for that crop" logic.
  Markets with unknown district centroid still sort last (current behaviour).
- **D-10:** Keep district-centroid haversine (`app/services/geo.py`); no PostGIS in
  Phase 1.

**Migrations**
- **D-11:** Adopt **Alembic** in Phase 1. Generate an initial migration covering
  `price_cache` AND the already-declared-but-dormant Pillar B/C tables (users, lots,
  demands, matches, offers, deals, disputes) so Phase 2 auth work starts from a real
  migration baseline.
- **D-12:** Replace `Base.metadata.create_all` in `app/main.py` lifespan with
  "run `alembic upgrade head` on startup" (or document `alembic upgrade head` as a
  required step). Keep it idempotent for the demo.

**Testing**
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

**i18n**
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

**Accessibility / performance**
- **D-20:** Keep the earthy palette tokens, Noto Sans + Noto Sans Devanagari, global
  44px min tap target, focus-visible outlines, skeletons.
- **D-21:** Add a retry affordance to the dashboard error state (currently a static
  message). Keep payloads light; no heavy client libs beyond recharts.

**Ship**
- **D-22:** Phase 1 "Ship" = green local run (documented start commands for
  Docker DB on :5433, backend on :8000, `node node_modules/next/dist/bin/next dev`
  for the frontend) + a PR to `origin` (`github.com/umangjzx/Sih-26132`). No
  deployment in Phase 1; hosting decided before Phase 4 (Cordova).

### Claude's Discretion
- Exact Alembic config layout and whether startup auto-upgrades vs. documents the command.
- Test file organisation and the throwaway-DB mechanism for API tests.
- The arrivals ingestion function's internal shape, retry/backoff parameters.
- Chart/skeleton/error-state visual details within the existing design system.
- Whether the CSV-snapshot seed lives in `backend/app/services/` data or a `seeds/` dir.

### Deferred Ideas (OUT OF SCOPE — do not research or plan)
- Typeahead / district-filtered crop+market picker for hundreds of live markets — v2.
- Second AGMARKNET resource purely for forecasting inputs / ML — out of scope.
- PostGIS geo queries — v2, only if centroid distance proves too coarse for Phase 2.
- Live public deployment + hosted Postgres + CORS/`NEXT_PUBLIC_API_URL` hardening — before Phase 4.
- Real SMS OTP, KYC, payment, logistics — Phases 2–3 / out of scope.
- `/[locale]` URL routing + SSR i18n — not while the Cordova constraint holds.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRICE-01 | Scheduled job pulls Maharashtra mandi prices, paginated, upserts `PriceCache` keyed on (market, crop, variety, date); never live on a user request | Already implemented in `ingestion.run_ingestion` / APScheduler. Harden: extract `resolve_ingestion_rows()` for testability (Q3); keep scheduled-only. |
| PRICE-02 | Fixture snapshot fallback when live API unavailable | Already implemented. Add committed CSV/JSON snapshot seed (`load_snapshot_rows()`) per D-04 (Q1). |
| PRICE-03 | Latest min/modal/max for selected crop+market | `/api/prices/trend` returns the series; dashboard reads the last point. No change needed; add smoke test. |
| PRICE-04 | 7/30/90-day modal-price trend chart | `/api/prices/trend?days=` (bounded `Query(30, ge=1, le=90)`) + recharts. No change; add render test with recharts stubbed (Q4). |
| PRICE-05 | Nearest-market comparison, distance + price, nearest first | `/api/prices/nearby` — add ≤200 km cap + top-8 (Q7, D-09). |
| PRICE-06 | Explainable sell/wait/hold with every driving number in a reason | `signal.compute_signal` already does this. Volume factor stays fixture-powered (Q1). Add D-08 unit tests. |
| I18N-01 | Every string a translation key | Enforced by convention + `useTranslations`; verify no literals in changed components. |
| I18N-02 | English default, fully translated | `en.json` is the source of truth (D-19). |
| I18N-03 | hi/mr cover every en key | Add vitest parity test (Q6, D-17). |
| I18N-04 | Visible switcher, persists choice | `LanguageSwitcher` + `LocaleProvider` localStorage. Add test (Q4). |
| I18N-05 | Devanagari + Latin render with no layout break on switch | `next/font` Noto Sans + Noto Sans Devanagari already wired in `layout.tsx`; `--font-sans` stacks both. No-flash guard (Q5) removes the English flash on load. |
| A11Y-01 | High contrast, ≥44px targets, icon+text nav | `globals.css` global `min-height: 44px` + `*:focus-visible`. No change; keep (D-20). |
| A11Y-02 | Skeleton loading states | `PriceDashboard` has skeletons; add `role="status"`/`data-testid` so tests and screen readers can see them (Q4). |
| A11Y-03 | Earthy palette, not startup-blue | Palette tokens in `globals.css` (`--color-brand` #2f5d3a, `--color-accent` #c97c1f). No change (D-20). |
| PERF-01 | Lightweight on patchy 3G | No new client libs beyond recharts (D-21); the no-flash guard renders a tiny neutral skeleton, not a heavy shell. |
</phase_requirements>

<architectural_responsibility_map>
## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Mandi price ingestion (paginated pull, normalise, upsert) | API/Backend | External (data.gov.in) | Stateless service `ingestion.py` + APScheduler in the FastAPI process; never a request path (PRICE-01). |
| Arrivals merge onto `PriceCache` | API/Backend | Database/Storage | Separate service function updating existing rows (D-03); no new request surface. |
| Fixture / CSV-snapshot fallback | API/Backend | — | `fixtures.py` + a new `load_snapshot_rows()`; a committed data file is a build artifact, logic stays in the service. |
| `/api/options`, `/api/prices/{trend,nearby,signal}` | API/Backend | Database/Storage | Thin routers over `PriceCache` SELECTs + pure services (`signal`, `geo`). |
| Sell/wait/hold computation | API/Backend | — | Pure function `signal.compute_signal`; no I/O, no ML (D-06). |
| Distance ranking | API/Backend | — | Pure `geo.district_distance_km` over a static centroid table (D-10). |
| `POST /api/ingest/run` protection | API/Backend | — | Shared-secret header check in the router (D-05); `secrets.compare_digest`. |
| Schema migrations | Database/Storage | API/Backend | Alembic scripts are the schema source of truth; backend runs `upgrade head` at startup (D-11/D-12). |
| Dashboard render, skeletons, retry affordance | Browser/Client | — | `"use client"` SPA route by Cordova constraint; no Frontend-Server tier in play. |
| Locale resolution, switch, persistence, no-flash gate | Browser/Client | — | `LocaleProvider` reads `localStorage["agrilink.locale"]`; must stay server-free (D-16). |
| Translation catalogs + key-parity gate | Browser/Client (build + test) | — | JSON under `src/i18n/messages/`; parity enforced by a vitest test (D-17). |
| Devanagari / Latin fonts | Browser/Client (build) | — | `next/font/google` in `layout.tsx`; self-hosted at build, no runtime fetch. |

**No Frontend-Server tier:** the price route is a client-rendered SPA by the Cordova constraint. **CDN/Static** only becomes relevant at the Phase 4 static export — out of scope here.
</architectural_responsibility_map>

<research_summary>
## Summary

Phase 1 is a harden-and-complete pass over code that already runs (commit d12cc76). Research targeted the seven open questions the planner flagged: the arrivals data source (D-02), Alembic adoption (D-11/D-12), first backend tests (D-13), first frontend tests (D-14), the i18n no-flash guard (D-16), the key-parity gate (D-17), and the `/nearby` cap (D-09).

**The critical finding is on D-02.** A live call to `api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070` on 2026-09-01 with `filters[state]=Maharashtra` returns a ten-field schema — `state, district, market, commodity, variety, grade, arrival_date, min_price, max_price, modal_price` — and **no arrivals field**. That UUID *is* the dataset titled "Current Daily Price of Various Commodities from Various Markets (Mandi)" whose catalog slug is `current-daily-price-various-commodities-various-markets-mandi` — i.e. the resource D-02 names as the arrivals *candidate* is the same resource D-01 already ingests. No other OGD (`api.data.gov.in`) resource was found that exposes daily mandi arrivals as JSON. Arrivals exist outside OGD (the CEDA Ashoka AgMarkNet API; India Data Portal's `apmc-arrivals-and-prices`; the agmarknet.gov.in "Daily Price and Arrival Report" page) but none is a reliable, keyless, daily `api.data.gov.in` JSON resource fit to be a demo dependency. **Recommendation: invoke the D-02 fallback** — keep the volume factor fixture/snapshot-powered, log the limitation in `ingestion.py`, and treat PRICE-07 (v2) as the real fix. This is a recommendation to soften D-02's premise, not a silent override (see Open Questions).

The rest is well-trodden. Alembic 1.19.x drops in cleanly against the sync psycopg2 engine: point `env.py` `target_metadata` at `Base.metadata`, `import app.models` so all eight tables register, set `sqlalchemy.url` from `settings.database_url`, add a constraint naming convention to `Base`, autogenerate one `0001_initial` against an empty Docker Postgres, and call `command.upgrade(cfg, "head")` in the FastAPI lifespan (idempotent) while also documenting the manual command. Backend tests use pytest with pure-function tests needing no DB and SQLite-in-memory + a `get_db` override for the four read endpoints; the Postgres-only `on_conflict_do_update` path stays DB-free by extracting `resolve_ingestion_rows()`. Frontend tests use vitest 4 + `@vitejs/plugin-react` + jsdom + Testing Library 16 (React 19-compatible), with `recharts`'s `ResponsiveContainer` stubbed and `@/lib/api` mocked. The no-flash guard is a `ready` state flipped in `useEffect` that renders a locale-neutral skeleton until `localStorage` is read — server and first-client render produce identical markup, so no hydration mismatch. Key parity is a ten-line recursive-flatten vitest test over the three JSON files. `/nearby` gets two bounded `Query` params (`max_distance_km=200`, `limit=8`) and a filter that keeps unknown-centroid markets sorting last.

**Primary recommendation:** Adopt Alembic + pytest + vitest exactly as sketched below; implement the D-02 *fallback* (fixtures + committed CSV snapshot + logged limitation) rather than wiring a live arrivals feed, and record the premise correction for the planner.
</research_summary>

<standard_stack>
## Standard Stack

### Core (already pinned — do not change)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fastapi | 0.115.6 | REST API | Problem-brief fixed |
| sqlalchemy | 2.0.36 | ORM / Core | `Mapped[...]` declarative style already used |
| psycopg2-binary | 2.9.10 | Postgres driver | Sync driver; `DATABASE_URL=postgresql+psycopg2://…` |
| pydantic / pydantic-settings | 2.10.4 / 2.7.0 | schemas + `.env` config | `Settings` reads `backend/.env` |
| httpx | 0.28.1 | data.gov.in client + test transport | Already the ingestion client; also backs `TestClient` |
| apscheduler | 3.11.0 | 6-hour ingestion job | `BackgroundScheduler` (3.x API) — **do not upgrade to 4.x**, different API |
| next / react / react-dom | 16.3.3 / 19.2.8 | client SPA | Problem-brief fixed |
| next-intl | 4.14.1 | i18n | Client-side, no routing (Cordova constraint) |
| recharts | 3.10.1 | trend chart | Only permitted heavy client lib (D-21) |
| tailwindcss (+ @tailwindcss/postcss) | 4.x | styling | Tokens in `globals.css` |

### Supporting — NEW this phase
| Library | Version (verified 2026-09-01) | Purpose | When to Use |
|---------|-------------------------------|---------|-------------|
| alembic | 1.19.1 (latest; 1.13+ fine) | schema migrations | D-11/D-12; add to `backend/requirements.txt` |
| pytest | 9.1.1 (latest; 8.4.x also safe) | backend test runner | D-13; add to `requirements.txt` (or `requirements-dev.txt`) |
| respx | 0.22.x | optional — HTTP-layer mocking for pagination assertions | Only if you want to assert URL/params across pages; otherwise monkeypatch the module boundary |
| vitest | 4.1.11 | frontend test runner | D-14; devDependency |
| @vitejs/plugin-react | 6.1.1 | JSX/TSX transform + Fast Refresh for tests | with vitest |
| jsdom | 30.0.1 | DOM environment | `test.environment: "jsdom"` |
| @testing-library/react | 16.3.3 | component render/query | React 19 needs v16+ |
| @testing-library/dom | 10.4.x | peer of the above (explicit install is harmless) | transitive; pin if lockfile noise |
| @testing-library/jest-dom | 7.0.1 | `toBeInTheDocument` etc. | import in `vitest.setup.ts` |
| @testing-library/user-event | 14.6.6 | realistic interactions (select change) | `LanguageSwitcher` test |
| vite-tsconfig-paths | 6.1.1 | resolve `@/*` alias in tests | tsconfig has `"@/*": ["./src/*"]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SQLite-in-memory for API tests | testcontainers-python (ephemeral PG) | Full PG fidelity incl. `on_conflict_do_update`, but adds a Docker-in-test dependency + ~seconds of startup per session; overkill for Phase 1 read-path smoke tests |
| SQLite-in-memory for API tests | transactional-rollback fixture vs the Docker PG on :5433 | Real dialect, but couples the test run to a running container and a clean schema; keep as an opt-in `@pytest.mark.pg` for the one upsert integration test only |
| monkeypatch the httpx call | `respx` / `httpx.MockTransport` | respx asserts real request URLs/params across pagination; monkeypatching `fetch_maharashtra_rows` is dependency-free and enough for D-13's fallback-path test |
| vitest | jest + next/jest | Jest works, but vitest is faster, ESM-native, and shares one config style with the Vite ecosystem; CONTEXT locks vitest (D-14) |
| no-flash `ready` gate | `useSyncExternalStore` reading localStorage | Cleaner store semantics, but the SSR snapshot is still `en`, so you still need a neutral-markup gate to kill the flash — net simpler to just use the `ready` boolean |
| Alembic autogenerate | hand-written initial DDL | Autogenerate over `Base.metadata` is accurate for greenfield tables and self-documents; hand DDL drifts from models |

**Installation:**
```bash
# backend/  (into backend/venv)
backend/venv/Scripts/python.exe -m pip install "alembic>=1.13" "pytest>=8.4"
#   then add matching pins to backend/requirements.txt:
#     alembic==1.19.1
#     pytest==9.1.1
#     respx==0.22.0        # optional

# frontend/
npm install -D vitest@4 @vitejs/plugin-react jsdom \
  @testing-library/react @testing-library/dom @testing-library/jest-dom \
  @testing-library/user-event vite-tsconfig-paths
```

**Version verification (run 2026-09-01):**
- `npm view` — vitest 4.1.11, @vitejs/plugin-react 6.1.1, @testing-library/react 16.3.3, @testing-library/jest-dom 7.0.1, @testing-library/user-event 14.6.6, jsdom 30.0.1, vite-tsconfig-paths 6.1.1, next-intl 4.14.1.
- `pip index versions` — alembic 1.19.1 (latest), pytest 9.1.1 (latest). Neither is currently present in `backend/venv/Scripts/` — both must be installed.
</standard_stack>

<package_legitimacy_audit>
## Package Legitimacy Audit

Seam: `gsd_run query package-legitimacy check` (2026-09-01). Every new package is a long-established, first-party project; the `SUS` verdicts below are **recency false positives** (`too-new` fires on frequent minor releases; `unknown-downloads` fires because PyPI does not expose weekly counts to the seam). Cross-checked repo ownership and npm weekly downloads manually.

| Package | Registry | Age / last release | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|--------------------|-----------|-------------|---------|-------------|
| alembic | PyPI | release 2026-08-08 | n/a (PyPI) | github.com/sqlalchemy/alembic | SUS (`too-new`, `unknown-downloads`) | Approved — official SQLAlchemy sub-project; de-facto standard migration tool. Planner: add a `checkpoint:human-verify` per protocol, expect trivial ACK. |
| pytest | PyPI | release 2026-06-19 | n/a (PyPI) | github.com/pytest-dev/pytest | SUS (`unknown-downloads`) | Approved — canonical Python test runner. Same checkpoint note. |
| respx (optional) | PyPI | release 2026-04-08 | n/a (PyPI) | lundberg.github.io/respx | SUS (`unknown-downloads`) | Approved *if used* — well-known httpx mocking lib; only pull if pagination assertions are wanted. |
| vitest | npm | release 2026-08-18 | ~99.9M/wk | github.com/vitest-dev/vitest | SUS (`too-new`) | Approved — top-tier test runner. |
| @vitejs/plugin-react | npm | release 2026-08-28 | ~83.6M/wk | github.com/vitejs/vite-plugin-react | SUS (`too-new`) | Approved — official Vite plugin. |
| @testing-library/react | npm | release 2026-08-27 | ~57.1M/wk | github.com/testing-library/react-testing-library | SUS (`too-new`) | Approved — standard RTL, v16 = React 19 support. |
| @testing-library/jest-dom | npm | release 2026-08-09 | ~63.2M/wk | github.com/testing-library/jest-dom | SUS (`too-new`) | Approved. |
| @testing-library/user-event | npm | release 2026-08-22 | ~51.0M/wk | github.com/testing-library/user-event | SUS (`too-new`) | Approved. |
| jsdom | npm | release 2026-07-29 | ~98.8M/wk | github.com/jsdom/jsdom | OK | Approved. |
| @testing-library/dom | npm | release 2025-07-27 | ~69.8M/wk | github.com/testing-library/dom-testing-library | OK | Approved (transitive peer). |
| vite-tsconfig-paths | npm | release 2026-02-11 | ~30.5M/wk | github.com/aleclarson/vite-tsconfig-paths | OK | Approved. |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged [SUS]:** alembic, pytest, respx, vitest, @vitejs/plugin-react, @testing-library/react, @testing-library/jest-dom, @testing-library/user-event — all recency false-positives on first-party projects with authoritative repos and (for npm) 50M–100M weekly downloads. Planner should still honour the protocol and add a single `checkpoint:human-verify` covering the batch before install, but no per-package investigation is warranted.
**No `postinstall` scripts** on any package (`postinstall: null` across the board).
</package_legitimacy_audit>

<architecture_patterns>
## Architecture Patterns

### System Architecture Diagram

```
                        ┌────────────────────────── data.gov.in ──────────────────────────┐
                        │  resource 9ef84268-…  (price only: min/max/modal, NO arrivals)  │
                        └───────────────▲─────────────────────────────────────────────────┘
                                        │ httpx, paginated, filters[state]=Maharashtra
                                        │ (fails/empty/no-key ─┐)
   APScheduler (6h) ──► run_ingestion ──┤                      ▼
   FastAPI lifespan  ──► (once if empty) │       resolve_ingestion_rows()  ─── "fixture" ──► generate_fixture_rows(seed=26132)   [has synthetic arrival_volume]
                                         │                      └────────── "snapshot" ──► load_snapshot_rows(committed CSV)     [price only]
                                         ▼
                              upsert_price_rows()  ── PG INSERT … ON CONFLICT (market,crop,variety,date) DO UPDATE
                                         ▼
                              ┌────────────────────┐
                              │  PriceCache table  │◄── (arrivals merge job: UPDATE arrival_volume on existing rows only — D-03)
                              └─────────▲──────────┘
                                        │ SELECT (portable ORM)
             ┌──────────────────────────┼───────────────────────────────┐
             │            /api/prices/* routers  (Depends(get_db))       │
   /api/options   /prices/trend    /prices/nearby            /prices/signal
   distinct       series → last     latest-date rows          series(60d)
   crop/mkt/dist  point = today     → geo.district_distance   → signal.compute_signal
                                    → filter ≤200km, top-8    → weighted score → sell_now/wait/hold + reasons[]
             └──────────────────────────┬───────────────────────────────┘
                                        │ JSON (snake_case)
                                        ▼
        Browser / Cordova WebView  ── src/lib/api.ts (fetch, NEXT_PUBLIC_API_URL) ──► PriceDashboard
                                        │
              LocaleProvider (localStorage["agrilink.locale"]) ─ ready-gate ─► NextIntlClientProvider(locale, messages)
              LanguageSwitcher ─ setLocale ─► re-render + persist + document.documentElement.lang

   POST /api/ingest/run ──► header X-Ingest-Secret == INGEST_TRIGGER_SECRET ?  yes → run_ingestion   no → 403
```

### Recommended Project Structure (additions only)

```
backend/
├── alembic.ini                 # script_location = alembic ; url overridden in env.py
├── alembic/
│   ├── env.py                  # target_metadata = Base.metadata ; import app.models ; url from settings
│   ├── script.py.mako
│   └── versions/
│       └── 0001_initial_schema.py
├── app/services/
│   ├── ingestion.py            # + resolve_ingestion_rows(), + fetch_arrivals_rows() [gated off], + merge_arrivals()
│   ├── snapshot.py             # load_snapshot_rows()  (or keep in ingestion.py — discretion)
│   └── data/maharashtra_snapshot.csv   # committed §4.2 export (discretion: seeds/ dir)
├── requirements.txt            # + alembic, pytest
├── pyproject.toml  or  pytest.ini      # [tool.pytest.ini_options] pythonpath=["."] testpaths=["tests"]
└── tests/
    ├── conftest.py             # sqlite engine fixture, get_db override, TestClient (no `with`)
    ├── test_signal.py          # D-08 cases
    ├── test_geo.py
    ├── test_ingestion_normalize.py
    ├── test_ingestion_fallback.py   # monkeypatch fetch_* -> raise/empty
    └── test_api_prices.py      # one smoke test per /api/prices/* + /api/options

frontend/
├── vitest.config.mts
├── vitest.setup.ts             # jest-dom, recharts ResponsiveContainer stub
├── src/test/render.tsx         # renderWithIntl() helper
└── src/
    ├── i18n/
    │   ├── LocaleProvider.tsx   # + ready gate (Q5)
    │   ├── messages/parity.test.ts   # D-17
    │   └── types.d.ts          # declare module "next-intl" { interface AppConfig { Messages: typeof en } }
    └── components/
        ├── SellWaitSignalCard.test.tsx
        ├── LanguageSwitcher.test.tsx
        └── PriceDashboard.test.tsx
```

### Pattern 1: Alembic `env.py` for a sync SQLAlchemy 2.0 app with pydantic-settings

**What:** Feed Alembic the same metadata and URL the app uses, with zero duplication.
**When to use:** the one-time `alembic init` in this phase.
**Example:**
```python
# backend/alembic/env.py  (essential lines)
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

from app.core.config import settings
from app.core.database import Base
import app.models  # noqa: F401  — imports every model so all 8 tables register on Base.metadata

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url)   # postgresql+psycopg2://…:5433/…
if config.config_file_name:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.", poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,            # catch column type changes on later autogens
            compare_server_default=True,
        )
        with context.begin_transaction():
            context.run_migrations()

run_migrations_online()   # offline mode not needed for this project
```

### Pattern 2: Constraint naming convention on `Base` (do once, before the initial autogen)

**What:** Deterministic names for indexes / FKs / unique constraints so future migrations and any SQLite test schema are stable.
**When to use:** edit `app/core/database.py` before generating `0001_initial`.
**Example:**
```python
# backend/app/core/database.py
from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
```
`price_cache` already names its unique constraint explicitly (`uq_price_cache_key`), so that name is preserved; the convention only fills in the currently-unnamed FKs on the Pillar B/C tables and the `users.phone` index/unique. `ingestion.upsert_price_rows` targets `index_elements=["market","crop","variety","date"]` (a column list, not a constraint name), so it is unaffected.

### Pattern 3: Run migrations at startup, idempotently (sync engine → trivial)

**What:** Replace `Base.metadata.create_all` with an `alembic upgrade head` that is a no-op when already current.
**When to use:** `app/main.py` lifespan.
**Example:**
```python
# app/main.py
from pathlib import Path
from alembic import command
from alembic.config import Config as AlembicConfig

ALEMBIC_INI = Path(__file__).resolve().parents[1] / "alembic.ini"   # backend/alembic.ini

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        command.upgrade(AlembicConfig(str(ALEMBIC_INI)), "head")     # idempotent
    except Exception:
        logger.exception("alembic upgrade failed — run `cd backend && alembic upgrade head` manually")
        raise
    # …existing initial-ingestion + scheduler start…
    yield
    scheduler.shutdown(wait=False)
```
Single-worker uvicorn for the demo means no migration race. Also document `cd backend && alembic upgrade head` in the README (D-22 green-run steps) so the auto-run is a convenience, not the only path.

### Pattern 4: next-intl client-only provider with a no-flash `ready` gate

**What:** Gate children on a `ready` boolean flipped in `useEffect`; render locale-neutral markup until then.
**When to use:** `src/i18n/LocaleProvider.tsx` (D-16).
**Example:**
```tsx
"use client";
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const next = stored && isLocale(stored) ? stored : defaultLocale;
    setLocaleState(next);
    document.documentElement.lang = next;
    setReady(true);
  }, []);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      <NextIntlClientProvider locale={locale} messages={messagesByLocale[locale]} timeZone="Asia/Kolkata">
        {ready ? children : <AppShellSkeleton />}   {/* no translated strings in the skeleton */}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}
```
Server render and first client render both compute `ready === false` → identical DOM (the skeleton) → **no hydration mismatch**. After mount, `locale` is already the stored value in the same commit → **no English paint**. Keep `<html lang="en">` in `layout.tsx`; `useEffect` corrects `documentElement.lang` immediately. A static export has no server to read a cookie, so a truly first-byte-correct `lang` is not achievable without breaking D-16 — accepted.

### Pattern 5: vitest config for Next 16 / React 19 (no Turbopack involved)

```ts
// frontend/vitest.config.mts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    css: false,
  },
});
```
```ts
// frontend/vitest.setup.ts
import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// recharts ResponsiveContainer measures layout; jsdom reports 0×0 so charts never draw.
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return { ...actual, ResponsiveContainer: ({ children }: { children: React.ReactNode }) => children };
});
```
```jsonc
// package.json  "scripts"
"test": "vitest run",
"test:watch": "vitest"
```

### Anti-Patterns to Avoid
- **Adding `src/i18n/request.ts`, the next-intl Next plugin, or middleware/proxy** to "do i18n properly." That is the routing-based setup; it needs a server, breaks the Phase 4 static export, and triggers the Next 16 "Unable to find next-intl locale" error. The explicit `NextIntlClientProvider locale={…} messages={…}` is the documented no-routing pattern and is correct here.
- **Keeping `Base.metadata.create_all` alongside Alembic.** Two schema authorities hide migration bugs. Remove it.
- **`with TestClient(app):` in route tests.** The context-manager form runs `lifespan` → starts APScheduler, runs `create_all` on the real engine, and fires initial ingestion against the real DB / network. Use bare `TestClient(app)` (no `with`) plus a `get_db` override.
- **Routing `on_conflict_do_update` through SQLite.** `sqlalchemy.dialects.postgresql.insert(...).on_conflict_do_update` raises `CompileError` on SQLite. Keep the upsert on Postgres or keep the tested code DB-free.
- **Treating D-02's named resource as new.** `current-daily-price-various-commodities-various-markets-mandi` → `9ef84268-…` → the resource already ingested. Wiring a "second" ingestion against it adds nothing.
- **Hand-writing the initial migration DDL.** Autogenerate against `Base.metadata` on an empty DB; review, then commit.
- **A no-flash gate that renders `null` on the server but a spinner on first client render** (or vice-versa) — hydration mismatch. Both must render the exact same neutral markup.
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema diffing / DDL | Hand-written `CREATE TABLE` migration, or `create_all` forever | `alembic revision --autogenerate` over `Base.metadata` | Autogen is accurate for greenfield tables, self-documents, and gives Phase 2 a real baseline (D-11) |
| Migrations at startup | Custom "check tables exist then create" | `alembic.command.upgrade(cfg, "head")` | Already idempotent; version table tracks state |
| HTTP mocking in tests | A fake `httpx.Client` subclass | `monkeypatch.setattr(ingestion, "fetch_maharashtra_rows", …)` or `respx` | Mock at the module boundary you own; respx if you need real-URL assertions |
| Distance between districts | New haversine, or pull `geopy` / add PostGIS | existing `geo.district_distance_km` | Already implemented over a static centroid table; D-10 forbids PostGIS in Phase 1 |
| i18n message load / format / plural | Custom `t()` / interpolation | `next-intl` `useTranslations` (already wired) | Locked (D-06 context); ICU, fallbacks, type-safety come free |
| Locale persistence / propagation | redux / zustand for one string | `localStorage` + the existing React context | One value; a store is overhead against PERF-01 |
| CSV snapshot parsing | Pull `pandas` | stdlib `csv` | A few thousand rows; pandas is a heavy dep for a one-shot seed |
| Test DB lifecycle | Manual connect/create/drop scripts | pytest fixture: `create_engine("sqlite://", poolclass=StaticPool)` + `Base.metadata.create_all` | Standard, fast, per-test isolation |

**OK to hand-roll (small, dependency-free):** the recursive key-flatten for the i18n parity test (~10 lines) — do **not** add `lodash` for `_.keys`/`_.get`.

**Key insight:** every hard problem this phase touches (migrations, HTTP mocking, i18n, geo distance) already has either a first-party library or existing project code. The phase's real work is wiring and tests, not new machinery.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Alembic autogenerate produces an empty migration
**What goes wrong:** `alembic revision --autogenerate` emits `pass` in `upgrade()`.
**Why it happens:** `env.py` never imports the model modules, so `Base.metadata` is empty when Alembic inspects it.
**How to avoid:** `import app.models  # noqa: F401` in `env.py` (the package `__init__.py` already imports all eight models). Confirm `target_metadata = Base.metadata`.
**Warning signs:** `0001_initial.py` has no `op.create_table` calls; `alembic upgrade head` creates only `alembic_version`.

### Pitfall 2: Alembic connects to the wrong database
**What goes wrong:** migrations run against `driver://user:pass@localhost/dbname` or a 5432 DB, not the Docker PG on 5433.
**Why it happens:** `alembic.ini` ships a placeholder `sqlalchemy.url`; or you run `alembic` from the repo root where pydantic-settings can't find `backend/.env`.
**How to avoid:** override in `env.py` with `config.set_main_option("sqlalchemy.url", settings.database_url)`; always run `alembic` from `backend/`.
**Warning signs:** connection refused; or migrations "work" but the app still sees no tables.

### Pitfall 3: Existing dev DB already has `create_all` tables when you first `alembic upgrade`
**What goes wrong:** `upgrade head` fails with "relation already exists," or silently diverges.
**Why it happens:** the app has been run before, so `create_all` built the schema with no `alembic_version` row.
**How to avoid:** for a clean baseline, `docker compose down -v && docker compose up -d` (price data is regenerable cache), then `alembic upgrade head`. If a DB must be preserved and its schema already matches the models exactly, `alembic stamp head` instead. Document both.
**Warning signs:** `DuplicateTable` on first upgrade.

### Pitfall 4: `TestClient` context manager boots the scheduler during tests
**What goes wrong:** tests start APScheduler, hit the network / real DB via initial ingestion, and hang or write junk.
**Why it happens:** `with TestClient(app):` runs FastAPI `lifespan` events.
**How to avoid:** use bare `TestClient(app)` (no `with`) for route tests; override `get_db`. Optionally gate the scheduler behind a `settings.enable_scheduler` flag tests set false.
**Warning signs:** test run pauses ~20s (httpx timeout); "Ingestion job finished" in test logs.

### Pitfall 5: Postgres upsert compiled against SQLite
**What goes wrong:** `CompileError: … ON CONFLICT … requires … PostgreSQL` when a test drives `upsert_price_rows` / `run_ingestion(db)` on the SQLite fixture.
**Why it happens:** `from sqlalchemy.dialects.postgresql import insert` is dialect-specific.
**How to avoid:** extract `resolve_ingestion_rows() -> tuple[str, list[dict]]` and unit-test *that* (no DB); keep any real upsert test behind `@pytest.mark.pg` against Docker PG. Read-only endpoints are fine on SQLite.
**Warning signs:** `CompileError` mentioning `on_conflict_do_update`.

### Pitfall 6: "Fixing" i18n by adding the routing setup
**What goes wrong:** app throws "Unable to find next-intl locale" on Next 16, or the Phase 4 static export breaks.
**Why it happens:** adding `i18n/request.ts` / the next-intl plugin / middleware assumes a server and locale segments.
**How to avoid:** keep the explicit `NextIntlClientProvider locale/messages` client pattern (D-16). The only change is the `ready` gate.
**Warning signs:** new `middleware.ts` or `i18n/request.ts` in the diff; build errors about `getRequestConfig`.

### Pitfall 7: Hydration mismatch from the no-flash gate
**What goes wrong:** React logs "Hydration failed" / content flickers.
**Why it happens:** the `ready === false` branch renders different markup on the server vs the first client render (e.g. `null` vs a spinner, or a translated string).
**How to avoid:** render one fixed, locale-neutral skeleton for `!ready`, identical on both passes; never call `useTranslations` inside it.
**Warning signs:** console hydration warning on first load; brief layout jump.

### Pitfall 8: recharts renders nothing under jsdom
**What goes wrong:** `PriceDashboard` / `PriceTrendChart` tests can't find chart content; width/height warnings.
**Why it happens:** `ResponsiveContainer` measures the parent, which is 0×0 in jsdom.
**How to avoid:** stub `ResponsiveContainer` to a passthrough in `vitest.setup.ts` (Pattern 5), or mock the whole `PriceTrendChart` module in the dashboard test. The chart's internals are not a Phase 1 test target (D-14).
**Warning signs:** `console.warn` about "width(0) and height(0)"; empty SVG.

### Pitfall 9: Arrivals unit confusion if a real feed is ever wired
**What goes wrong:** the signal reason says "qtl/day" but the feed reports tonnes (or vice-versa), so the number shown to farmers is 10× off.
**Why it happens:** AGMARKNET's portal "Prices and Arrivals" report is conventionally in tonnes; `fixtures.py` synthesises a "qtl/day" style number and `signal.py` hard-codes "qtl/day" in the reason text.
**How to avoid:** for Phase 1 the volume factor stays fixture/snapshot-powered, so this is latent — but if the planner adds any live arrivals source, normalise to one unit (recommend tonnes) and update the two reason strings in `signal.py`.
**Warning signs:** implausible arrival magnitudes in the signal card.

### Pitfall 10: Exact-string crop/market matching empties the dashboard on a source switch
**What goes wrong:** switching from fixtures to a live/snapshot source shows "No price data" until `/api/options` repopulates, because live AGMARKNET names ("Tomato" vs "Tomato(Local)", "Chhatrapati Sambhajinagar" vs "Aurangabad") don't match the previously selected string.
**Why it happens:** `PriceCache` lookups use `==` on human strings; the frontend keeps the last selection.
**How to avoid:** known/accepted for the demo (CONCERNS.md); if the committed snapshot uses live names, regenerate `/api/options` and don't hard-code selections. Relevant when authoring the §4.2 snapshot (D-04).
**Warning signs:** empty dashboard right after an ingestion source change.

### Pitfall 11: `@testing-library/react` older than v16 with React 19
**What goes wrong:** `act(...)` warnings, render errors, `createRoot` incompatibilities.
**Why it happens:** RTL < 16 predates the React 19 renderer API.
**How to avoid:** install `@testing-library/react@16` (16.3.3 verified). Prefer `findBy*` + async `userEvent` over `fireEvent` for state-updating interactions.
**Warning signs:** "The current testing environment is not configured to support act(...)".
</common_pitfalls>

<code_examples>
## Code Examples

### `/api/prices/nearby` — ≤200 km cap + top-8 (D-09)
```python
# app/api/prices.py
@router.get("/prices/nearby", response_model=list[NearestMarketComparison])
def nearby_markets(
    crop: str,
    district: str,
    max_distance_km: float = Query(200, gt=0, le=2000),
    limit: int = Query(8, ge=1, le=50),
    db: Session = Depends(get_db),
) -> list[NearestMarketComparison]:
    latest_date = db.execute(
        select(PriceCache.date).where(PriceCache.crop == crop)
        .order_by(PriceCache.date.desc()).limit(1)
    ).scalar_one_or_none()
    if latest_date is None:
        raise HTTPException(status_code=404, detail="No price data for this crop")

    rows = db.execute(
        select(PriceCache).where(PriceCache.crop == crop, PriceCache.date == latest_date)
    ).scalars().all()

    results = [
        NearestMarketComparison(
            market=r.market, district=r.district,
            distance_km=district_distance_km(district, r.district),
            modal_price=r.modal_price, date=r.date,
        )
        for r in rows
    ]
    # keep unknown-centroid markets (distance None); drop only known distances beyond the cap
    kept = [x for x in results if x.distance_km is None or x.distance_km <= max_distance_km]
    kept.sort(key=lambda i: (i.distance_km is None, i.distance_km or 0.0))  # None sorts last (D-09)
    return kept[:limit]
```
`src/lib/api.ts::fetchNearby` needs no change — defaults apply. Optionally exclude the currently-selected market by passing `market` and filtering `r.market != market` (discretion; not required by D-09).

### `POST /api/ingest/run` — shared-secret gate (D-05)
```python
import secrets
from fastapi import Header

@router.post("/ingest/run", response_model=IngestionResultResponse)
def trigger_ingestion(
    x_ingest_secret: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> IngestionResultResponse:
    expected = settings.ingest_trigger_secret
    if not expected or not x_ingest_secret or not secrets.compare_digest(x_ingest_secret, expected):
        raise HTTPException(status_code=403, detail="Forbidden")
    return IngestionResultResponse(**ingestion.run_ingestion(db))
```
Add `ingest_trigger_secret: str = ""` to `Settings`; add `INGEST_TRIGGER_SECRET=` to `backend/.env.example`. Use `secrets.compare_digest` (constant-time) — ASVS V6.

### Testable ingestion refactor (D-13 fallback path, no DB)
```python
# app/services/ingestion.py
def resolve_ingestion_rows() -> tuple[str, list[dict]]:
    """Pure: decides the source and returns rows. No DB, no side effects."""
    try:
        if not settings.data_gov_in_api_key:
            raise RuntimeError("DATA_GOV_IN_API_KEY not configured")
        rows = normalize_rows(fetch_maharashtra_rows(settings.data_gov_in_api_key))
        if not rows:
            raise RuntimeError("live API returned no usable rows")
        return "live", rows
    except Exception as exc:  # noqa: BLE001
        logger.warning("Live ingestion unavailable (%s); using fixture/snapshot data", exc)
        return "fixture", generate_fixture_rows()   # or load_snapshot_rows() first, then generate

def run_ingestion(db: Session) -> dict:
    source, rows = resolve_ingestion_rows()
    return {"source": source, "rows_upserted": upsert_price_rows(db, rows)}
```
```python
# tests/test_ingestion_fallback.py
def test_falls_back_to_fixture_when_live_raises(monkeypatch):
    monkeypatch.setattr(ingestion.settings, "data_gov_in_api_key", "x")
    monkeypatch.setattr(ingestion, "fetch_maharashtra_rows",
                        lambda key: (_ for _ in ()).throw(httpx.ConnectError("boom")))
    source, rows = ingestion.resolve_ingestion_rows()
    assert source == "fixture" and len(rows) > 0

def test_falls_back_when_live_empty(monkeypatch):
    monkeypatch.setattr(ingestion.settings, "data_gov_in_api_key", "x")
    monkeypatch.setattr(ingestion, "fetch_maharashtra_rows", lambda key: [])
    assert ingestion.resolve_ingestion_rows()[0] == "fixture"
```

### pytest `conftest.py` — SQLite + `get_db` override, no lifespan
```python
# tests/conftest.py
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.core.database import Base, get_db
from app.main import app
from app.models.price_cache import PriceCache
from app.services.fixtures import generate_fixture_rows

@pytest.fixture()
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    s = Session()
    try:
        yield s
    finally:
        s.close()

@pytest.fixture()
def seeded_db(db):
    db.add_all(PriceCache(**row) for row in generate_fixture_rows(days=40))
    db.commit()
    return db

@pytest.fixture()
def client(seeded_db):
    app.dependency_overrides[get_db] = lambda: seeded_db
    yield TestClient(app)          # NOTE: no `with` — lifespan/scheduler never start
    app.dependency_overrides.clear()
```
```python
# tests/test_api_prices.py
def test_options_ok(client):
    r = client.get("/api/options")
    assert r.status_code == 200 and len(r.json()) > 0

def test_trend_ok(client):
    r = client.get("/api/prices/trend", params={"crop": "Onion", "market": "Pune", "days": 30})
    assert r.status_code == 200 and r.json()["points"]

def test_signal_ok(client):
    r = client.get("/api/prices/signal", params={"crop": "Onion", "market": "Pune"})
    assert r.status_code == 200 and r.json()["recommendation"] in {"sell_now", "wait", "hold"}

def test_nearby_caps_and_limits(client):
    r = client.get("/api/prices/nearby", params={"crop": "Onion", "district": "Pune"})
    body = r.json()
    assert r.status_code == 200 and len(body) <= 8
    assert all(x["distance_km"] is None or x["distance_km"] <= 200 for x in body)
```

### `compute_signal` unit tests (D-08) — no ORM needed
```python
# tests/test_signal.py
from datetime import date, timedelta
from types import SimpleNamespace
from app.services.signal import compute_signal

def _rows(prices, volumes=None):
    start = date.today() - timedelta(days=len(prices) - 1)
    return [
        SimpleNamespace(date=start + timedelta(days=i), modal_price=p,
                        arrival_volume=(volumes[i] if volumes else None))
        for i, p in enumerate(prices)
    ]

def test_none_under_7_days():
    assert compute_signal(_rows([100, 101, 102, 103, 104, 105])) is None

def test_7_to_13_days_no_ma30_branch():
    sig = compute_signal(_rows([100] * 10))
    assert sig is not None and sig.ma_30 is None
    assert any("30-day comparison" in r for r in sig.reasons)

def test_sell_now_on_strong_price():
    prices = [100] * 25 + [112, 113, 114, 115, 116, 117, 118]  # last well above the 30d avg
    assert compute_signal(prices := _rows(prices)).recommendation == "sell_now"

def test_wait_on_depressed_price():
    prices = [100] * 25 + [88, 87, 86, 85, 84, 83, 82]
    assert compute_signal(_rows(prices)).recommendation == "wait"

def test_volume_reason_present_when_volumes_supplied():
    n = 20
    sig = compute_signal(_rows([100] * n, volumes=[100] * 13 + [130] * 7))  # +30% recent week
    assert any("Arrivals are up" in r for r in sig.reasons)

def test_volume_skipped_reason_when_absent():
    sig = compute_signal(_rows([100] * 20))
    assert any("Arrival-volume data isn't available" in r for r in sig.reasons)
```

### i18n key-parity vitest test (D-17)
```ts
// src/i18n/messages/parity.test.ts
import { describe, it, expect } from "vitest";
import en from "./en.json";
import hi from "./hi.json";
import mr from "./mr.json";

type Json = Record<string, unknown>;
const flat = (o: Json, p = ""): string[] =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === "object" ? flat(v as Json, `${p}${k}.`) : [`${p}${k}`]);

const enKeys = new Set(flat(en as Json));

describe.each([["hi", hi], ["mr", mr]] as const)("%s locale parity with en.json", (_name, msgs) => {
  const keys = new Set(flat(msgs as Json));
  it("contains every key present in en.json (D-19: en is source of truth)", () => {
    expect([...enKeys].filter((k) => !keys.has(k))).toEqual([]);
  });
  it("has no stray keys absent from en.json", () => {
    expect([...keys].filter((k) => !enKeys.has(k))).toEqual([]);
  });
});
```
```ts
// src/i18n/types.d.ts  — DX only (tsc catches missing keys *used in code*, not JSON parity)
import type en from "./messages/en.json";
declare module "next-intl" {
  interface AppConfig {
    Messages: typeof en;
  }
}
```

### `LanguageSwitcher` test — locale change + persistence (D-14, I18N-04)
```tsx
// src/components/LanguageSwitcher.test.tsx
import { afterEach, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { LanguageSwitcher } from "./LanguageSwitcher";

afterEach(() => localStorage.clear());

it("changes locale, persists it, and updates <html lang>", async () => {
  render(<LocaleProvider><LanguageSwitcher /></LocaleProvider>);
  await userEvent.selectOptions(await screen.findByLabelText(/language/i), "hi");
  expect(localStorage.getItem("agrilink.locale")).toBe("hi");
  expect(document.documentElement.lang).toBe("hi");
});
```

### `PriceDashboard` skeleton→data test (D-14, A11Y-02)
```tsx
// src/components/PriceDashboard.test.tsx
import { expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/render";

vi.mock("@/lib/api", () => ({
  fetchOptions: vi.fn(), fetchTrend: vi.fn(), fetchSignal: vi.fn(), fetchNearby: vi.fn(),
}));
import * as api from "@/lib/api";
import { PriceDashboard } from "./PriceDashboard";

beforeEach(() => {
  vi.mocked(api.fetchOptions).mockResolvedValue([{ crop: "Onion", market: "Pune", district: "Pune" }]);
  vi.mocked(api.fetchTrend).mockResolvedValue({ crop: "Onion", market: "Pune", district: "Pune",
    points: [{ date: "2026-09-01", min_price: 1, max_price: 2, modal_price: 1.5, arrival_volume: null }] });
  vi.mocked(api.fetchSignal).mockResolvedValue({ recommendation: "hold", reasons: ["r"],
    current_price: 1.5, ma_7: 1.5, ma_30: null, volume_trend_pct: null, days_of_data: 10 });
  vi.mocked(api.fetchNearby).mockResolvedValue([]);
});

it("shows skeletons first, then data", async () => {
  renderWithIntl(<PriceDashboard />);
  expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);   // requires data-testid on <Skeleton>
  expect(await screen.findByText(/Onion/)).toBeInTheDocument();
});
```
Add `data-testid="skeleton"` and `role="status"` `aria-label` to the `Skeleton` component in `PriceDashboard.tsx` — doubles as an A11Y-02 improvement.
</code_examples>

<sota_updates>
## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `Base.metadata.create_all` on startup | Alembic autogenerate + `command.upgrade` in lifespan | this phase (D-11) | Real migration baseline for Phase 2 auth tables |
| `Base(DeclarativeBase): pass` | `Base` with `MetaData(naming_convention=…)` | SQLAlchemy 1.4+ recommended, still standard in 2.0 | Deterministic constraint names for future autogen + SQLite parity |
| jest + `next/jest` | vitest 4 + `@vitejs/plugin-react` + jsdom | 2023→ now default for new Vite-adjacent projects | Faster, ESM-native; CONTEXT locks vitest (D-14) |
| RTL ≤ 15 | `@testing-library/react` 16 | React 19 GA (2024) | v16 required for the React 19 renderer |
| next-intl 3 `NextIntlClientProvider` implicit messages | next-intl 4 — provider requires explicit `locale` + `messages` when no routing; `AppConfig`/`Messages` typing | next-intl 4 (2024) | Current code already passes both explicitly — compatible; add the `AppConfig` type augmentation for key safety |
| Next.js middleware-based i18n | For static/Cordova targets: client-only provider, no middleware | ongoing | Keeps the Phase 4 `cordova-android` static export viable (D-16) |

**Deprecated/outdated for this repo:**
- `create_all` as the schema mechanism — replaced by Alembic this phase.
- Any assumption that a "second data.gov.in resource" exposes arrivals — see Open Questions #1; the v2 requirement PRICE-07 already tracks the real fix.
- APScheduler 4.x / "APScheduler 6" API — the repo is on 3.11.0 (`BackgroundScheduler`); do not upgrade in Phase 1.
</sota_updates>

<open_questions>
## Open Questions

1. **D-02 premise: is there any data.gov.in JSON resource that exposes daily mandi arrivals?**
   - What we know: The canonical mandi resource `9ef84268-d588-465a-a308-a864a43d0070` — which *is* the dataset D-02 names as the candidate (`current-daily-price-various-commodities-various-markets-mandi`) — returns a 10-field schema with **no arrivals column** (verified via a live 2026-09-01 API call). Web search of the OGD catalog surfaced no other daily-updated `api.data.gov.in/resource/<id>` that includes arrivals. Arrivals *do* exist in non-OGD sources: the CEDA Ashoka AgMarkNet API (`agmarknet.ceda.ashoka.edu.in/api/`, JSON, daily prices + arrivals since 2001), India Data Portal's `apmc-arrivals-and-prices` CKAN resource `a83bd1ad-ba46-41c7-9a80-c75537ce1172` (field `arrivals_tonnes`), and the agmarknet.gov.in "Daily Price and Arrival Report" (HTML/ASPX).
   - What's unclear: whether any of the non-OGD sources is keyless (or free-registration), rate-tolerant, daily-fresh, and Maharashtra-complete enough to be a demo dependency. Their T&C / coverage pages returned HTTP 403 to automated fetch and were not independently verified this session.
   - Recommendation: **Implement the D-02 fallback, not a live arrivals ingestion.** Keep `arrival_volume` fixture/snapshot-powered; add a one-line `logger.warning` in `ingestion.py` stating "no live arrivals source — volume factor runs on fixture data only (see PRICE-07)". Optionally scaffold `fetch_arrivals_rows()` + `merge_arrivals()` behind an off-by-default `ARRIVALS_SOURCE_URL` env so a future source drops in without refactor (D-03 merge-on-(market,crop,date) already specified). Flag to the planner: **D-02's wording ("ADD a second data.gov.in AGMARKNET ingestion") should be recorded as not achievable in Phase 1** — this is a decision-softening recommendation, surfaced here rather than applied silently, per the researcher contract.

2. **Startup auto-upgrade vs documented manual step (D-12, Claude's discretion).**
   - What we know: sync engine makes `command.upgrade(cfg, "head")` in the lifespan safe and idempotent; single-worker demo has no race.
   - What's unclear: whether the team prefers explicit control (run `alembic upgrade head` by hand) for the demo.
   - Recommendation: do both — auto-run in lifespan wrapped in try/except with a clear failure log, AND document the manual command in the README green-run steps (D-22). Low risk, no downside.

3. **§4.2 committed snapshot: synthetic fixtures vs a real Maharashtra CSV export (D-04).**
   - What we know: `generate_fixture_rows(seed=26132)` already yields deterministic data *with* synthetic `arrival_volume`. A real CSV export from the dataset page would carry authentic crop/market names but **no arrivals** (same 10-field schema).
   - What's unclear: whether judges will scrutinise that fixture data is synthetic.
   - Recommendation: commit a real Maharashtra CSV snapshot for authenticity of names/prices and have `resolve_ingestion_rows()` prefer it over the synthetic generator; but keep the synthetic generator as the last resort because only it has `arrival_volume`, which the signal's volume factor needs for the demo. Order: live → snapshot CSV → synthetic fixtures.

4. **D-18 terminology pass (Hindi/Marathi).** Out of research scope (no translation authority), but note: current `hi.json`/`mr.json` use `औसत भाव` / `सरासरी भाव` for "modal price" (literally "average price"). "Modal" has no clean colloquial Devanagari term; "average/most-common price" is an acceptable plain-language rendering for low-literacy users. No blocker — flag for the light plausibility pass, not a fix.
</open_questions>

<runtime_state_inventory>
## Runtime State Inventory (Alembic adoption touches persisted schema state)

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `PriceCache` table in the Docker Postgres volume `agrilink_pgdata`, created by `Base.metadata.create_all`. No `alembic_version` table yet. Pillar B/C tables (`users, lots, demands, matches, offers, deals, disputes`) also already created by `create_all` but empty. | For a clean Alembic baseline: `docker compose down -v` (drops the volume — price data is regenerable cache) then `up`, then `alembic upgrade head`. Alternative for a preserved DB whose schema matches the models: `alembic stamp head`. Document both in the README. |
| Live service config | None. APScheduler jobs are defined in code (`main.py`), not persisted to a jobstore (default in-memory `BackgroundScheduler`). No external dashboards/tunnels. | None. |
| OS-registered state | None. No Task Scheduler / systemd / pm2 entries — the app runs via `uvicorn` and `next dev` in foreground shells (CONCERNS.md notes stale dev servers were killed manually). | None. |
| Secrets / env vars | `backend/.env` holds `DATABASE_URL` (points at :5433), a real `DATA_GOV_IN_API_KEY`, `CORS_ORIGINS`. `.env` is gitignored (root `.gitignore` `!.env.example` keeps the example). New: `INGEST_TRIGGER_SECRET` (D-05) and optionally `ARRIVALS_SOURCE_URL` (off by default). | Add both to `Settings` and `backend/.env.example`. Do not commit `.env`. CONCERNS.md flags rotating the API key if it ever entered git history. |
| Build artifacts | `backend/venv` has the runtime deps but **not** `alembic` or `pytest` (verified: absent from `venv/Scripts/`). `frontend/node_modules` has no test tooling. `.next/`, `__pycache__/`, `.pytest_cache/` are gitignored. | `pip install` alembic + pytest into `backend/venv` and add pins to `requirements.txt`; `npm i -D` the vitest set. No compiled artifacts carry stale names. |

**Canonical question — after every file is updated, what still holds old state?** Only the Postgres volume, which currently has a `create_all`-built schema and no `alembic_version`. Handle it with `down -v` + `upgrade head` (or `stamp head`). Everything else is code/env.
</runtime_state_inventory>

<validation_architecture>
## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Backend framework | pytest 9.1.1 (or 8.4.x) — **not yet installed**, Wave 0 |
| Backend config | `backend/pyproject.toml` `[tool.pytest.ini_options]` (`pythonpath=["."]`, `testpaths=["tests"]`, `markers=["pg: needs Docker Postgres"]`) — Wave 0 |
| Backend quick run | `cd backend && backend/venv/Scripts/python.exe -m pytest -q` |
| Backend full suite | `cd backend && backend/venv/Scripts/python.exe -m pytest` (add `-m "not pg"` in CI without a container) |
| Frontend framework | vitest 4.1.11 + @testing-library/react 16 + jsdom 30 — **not yet installed**, Wave 0 |
| Frontend config | `frontend/vitest.config.mts` + `frontend/vitest.setup.ts` — Wave 0 |
| Frontend quick run | `cd frontend && npm run test` → `vitest run` |
| Frontend watch | `cd frontend && npm run test:watch` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRICE-01 | scheduled ingestion upserts on the unique key | unit (resolve_ingestion_rows) + `@pytest.mark.pg` upsert | `pytest tests/test_ingestion_fallback.py -q` | ❌ Wave 0 |
| PRICE-02 | fixture/snapshot fallback on failure/empty/no-key | unit | `pytest tests/test_ingestion_fallback.py -q` | ❌ Wave 0 |
| PRICE-03 | latest min/modal/max surfaced | integration (SQLite) | `pytest tests/test_api_prices.py::test_trend_ok -q` | ❌ Wave 0 |
| PRICE-04 | 7/30/90-day trend series | integration | `pytest tests/test_api_prices.py::test_trend_ok -q` | ❌ Wave 0 |
| PRICE-05 | nearby: ≤200 km, top-8, nearest first, None last | integration | `pytest tests/test_api_prices.py::test_nearby_caps_and_limits -q` | ❌ Wave 0 |
| PRICE-06 | explainable sell/wait/hold, numbers in reasons | unit (D-08) | `pytest tests/test_signal.py -q` | ❌ Wave 0 |
| PRICE-06 | distance helper: known/unknown/symmetric | unit | `pytest tests/test_geo.py -q` | ❌ Wave 0 |
| PRICE-01/02 | `normalize_rows` drops bad rows, parses both date formats | unit | `pytest tests/test_ingestion_normalize.py -q` | ❌ Wave 0 |
| I18N-03 | hi/mr cover every en key (+ no strays) | unit (vitest) | `npm run test -- parity` | ❌ Wave 0 |
| I18N-04 | switcher changes + persists locale, sets `<html lang>` | component | `npm run test -- LanguageSwitcher` | ❌ Wave 0 |
| PRICE-06 (UI) | `SellWaitSignalCard` renders each recommendation + reasons | component | `npm run test -- SellWaitSignalCard` | ❌ Wave 0 |
| A11Y-02 | `PriceDashboard` shows skeletons then data (api mocked) | component | `npm run test -- PriceDashboard` | ❌ Wave 0 |
| D-05 | `POST /api/ingest/run` → 403 without header, 200 with | integration | `pytest tests/test_api_prices.py::test_ingest_requires_secret -q` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pytest -q` (changed area) and/or `vitest run` — both complete in well under 30s (no container needed for the default set).
- **Per wave merge:** full `pytest` (incl. `-m pg` if Docker PG is up) + full `vitest run`.
- **Phase gate:** both suites green before `/gsd-verify-work`; part of the D-22 green local run.

### Wave 0 Gaps
- [ ] `backend/pyproject.toml` (or `pytest.ini`) — pytest config + `pg` marker
- [ ] `backend/tests/conftest.py` — SQLite engine fixture, `seeded_db`, `get_db` override, bare `TestClient`
- [ ] `backend/tests/test_signal.py` — D-08 cases (sell_now / wait / hold / <7 / 7–13 / volume ±)
- [ ] `backend/tests/test_geo.py`
- [ ] `backend/tests/test_ingestion_normalize.py`
- [ ] `backend/tests/test_ingestion_fallback.py` — requires the `resolve_ingestion_rows()` refactor first
- [ ] `backend/tests/test_api_prices.py` — one smoke test per `/api/prices/*` + `/api/options` + the D-05 403/200 pair
- [ ] `pip install alembic pytest` into `backend/venv` + pins in `requirements.txt`
- [ ] `frontend/vitest.config.mts`, `frontend/vitest.setup.ts`, `frontend/src/test/render.tsx`
- [ ] `frontend/package.json` — `test` / `test:watch` scripts
- [ ] `frontend/src/i18n/messages/parity.test.ts`
- [ ] `frontend/src/components/{SellWaitSignalCard,LanguageSwitcher,PriceDashboard}.test.tsx`
- [ ] `Skeleton` in `PriceDashboard.tsx` — add `data-testid="skeleton"` + `role="status"`
- [ ] `npm i -D vitest @vitejs/plugin-react jsdom @testing-library/{react,dom,jest-dom,user-event} vite-tsconfig-paths`
</validation_architecture>

<security_domain>
## Security Domain

`security_enforcement: true`, ASVS L1, `security_block_on: high`. Phase 1 is 100% public price discovery; the one privileged surface is `POST /api/ingest/run` (D-05).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No user auth this phase (Phase 2). |
| V3 Session Management | no | No sessions. |
| V4 Access Control | yes | `POST /api/ingest/run` gated by `X-Ingest-Secret` header == `INGEST_TRIGGER_SECRET`; 403 otherwise (D-05). All other routes intentionally public. |
| V5 Input Validation | yes | Query params validated: `days` via `Query(30, ge=1, le=90)`, new `max_distance_km` via `Query(200, gt=0, le=2000)`, `limit` via `Query(8, ge=1, le=50)`. `crop`/`market`/`district` are free strings but used only as **bound parameters** in SQLAlchemy ORM comparisons (`PriceCache.crop == crop`) — no string interpolation, no SQLi. Pydantic `response_model` shapes output. |
| V6 Cryptography | yes | Compare the ingest secret with `secrets.compare_digest` (constant-time), never `==`. No other crypto in scope. |
| V7 Error Handling / Logging | yes | Do not log `INGEST_TRIGGER_SECRET` or `DATA_GOV_IN_API_KEY`. `ingestion` logs only the result dict — safe. `raise HTTPException(403, "Forbidden")` — no detail leak. |
| V9 Communications | partial | `httpx` calls data.gov.in over HTTPS (default). No cert pinning needed for a demo. |
| V14 Configuration | yes | `DATA_GOV_IN_API_KEY` lives in gitignored `backend/.env` (a real key is on disk — CONCERNS.md says rotate if git history ever captured it). CORS: `allow_methods=["*"]` + `allow_credentials=True` is broader than needed with no auth — recommend narrowing to `allow_methods=["GET","POST"]` and dropping `allow_credentials` until Phase 2. |
| V11 Business Logic | yes | Unauthenticated ingest trigger = resource-abuse vector (repeated live pulls → data.gov.in rate-limit / DB write load). D-05 mitigates. |

### Known Threat Patterns for FastAPI + SQLAlchemy + Next SPA

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Anonymous `POST /api/ingest/run` spam | Denial of Service / Elevation of Privilege | Shared-secret header + constant-time compare (D-05); 403 default |
| SQL injection via `crop`/`market`/`district` | Tampering / Information Disclosure | SQLAlchemy bound parameters (already); never f-string SQL |
| Secret leakage in logs or error bodies | Information Disclosure | Header (not query string) for the secret; generic 403; scrub logs |
| Over-permissive CORS with credentials | Spoofing / Information Disclosure | Restrict methods; drop `allow_credentials` until cookies/JWT exist (Phase 2) |
| Supply-chain: new test/migration deps | Tampering | Package Legitimacy Audit above; commit `package-lock.json` + pinned `requirements.txt`; no `postinstall` on any added package |
| `.env` with a live API key committed | Information Disclosure | `.gitignore` covers `.env`; rotate the key if history ever included it (CONCERNS.md) |
| DoS via unbounded `days` / result size | Denial of Service | Bounded `Query(...)` params; `/nearby` now hard-caps at `limit` rows |

**Block-on-high check:** no HIGH-severity items. The ingest-endpoint exposure is the only real risk and D-05 resolves it within this phase.
</security_domain>

<environment_availability>
## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker + `docker compose` | Postgres 16 on host :5433 | ✓ (assumed — CONCERNS.md describes it running; `docker-compose.yml` present) | postgres:16 | none — DB is required |
| Python venv | backend runtime | ✓ | 3.13, `backend/venv` | none |
| `alembic` in `backend/venv` | D-11/D-12 migrations | ✗ | needs `1.19.1` | none — must `pip install` (Wave 0) |
| `pytest` in `backend/venv` | D-13 tests | ✗ | needs `9.1.1` (or 8.4.x) | none — must `pip install` (Wave 0) |
| `httpx` | ingestion + `TestClient` | ✓ | 0.28.1 | n/a |
| Node + npm | frontend build/test | ✓ | Next 16.3.3 toolchain | none |
| vitest + RTL + jsdom + plugin-react + tsconfig-paths | D-14 tests | ✗ | see Standard Stack | none — must `npm i -D` (Wave 0) |
| data.gov.in live price API | PRICE-01 live path | ⚠ key present in `.env`, but CONCERNS.md notes the last live call **timed out** | resource `9ef84268-…` | fixture generator (working path today) + committed CSV snapshot (D-04) |
| data.gov.in arrivals JSON resource | D-02 volume factor on live data | ✗ (does not exist — see Open Questions #1) | — | fixture `arrival_volume` + logged limitation (D-02 fallback) — this **is** the plan |
| Internet access for `npm i` / `pip install` | Wave 0 setup | ⚠ assumed | — | none — offline blocks tooling install |

**Missing dependencies with no fallback (planner must add install tasks):** `alembic`, `pytest` (backend venv); the vitest/RTL set (frontend). All are Wave 0.
**Missing dependencies with a fallback:** the data.gov.in live price API (→ fixtures/snapshot); a live arrivals resource (→ fixture volume + logged limitation, per D-02).
</environment_availability>

<sources>
## Sources

### Primary (HIGH confidence)
- **Live API call** — `GET https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?format=json&limit=3&filters[state]=Maharashtra` (sample key), 2026-09-01. Returned the exact 10-field schema (`state, district, market, commodity, variety, grade, arrival_date, min_price, max_price, modal_price`) and a sample record `arrival_date: "01/09/2026"`. **No arrivals field.** [VERIFIED]
- **Repo source read this session** — `backend/app/services/{ingestion,signal,geo,fixtures}.py`, `backend/app/api/prices.py`, `backend/app/main.py`, `backend/app/core/{config,database}.py`, `backend/app/models/*.py`, `backend/app/schemas/price.py`, `backend/requirements.txt`, `frontend/package.json`, `frontend/tsconfig.json`, `frontend/next.config.ts`, `frontend/src/app/{layout,page}.tsx`, `frontend/src/i18n/{LocaleProvider.tsx,config.ts,messages/{en,hi,mr}.json}`, `frontend/src/components/*.tsx`, `frontend/src/lib/api.ts`, `frontend/src/app/globals.css`, `docker-compose.yml`, `.gitignore`, `.planning/config.json`. [VERIFIED]
- **Package registries** — `npm view` / `pip index versions`, 2026-09-01: vitest 4.1.11, @vitejs/plugin-react 6.1.1, @testing-library/react 16.3.3, @testing-library/jest-dom 7.0.1, @testing-library/user-event 14.6.6, jsdom 30.0.1, vite-tsconfig-paths 6.1.1, next-intl 4.14.1, alembic 1.19.1, pytest 9.1.1. `alembic`/`pytest` absent from `backend/venv/Scripts/`. [VERIFIED]
- **`gsd_run query package-legitimacy check`** (npm + pypi), 2026-09-01 — verdicts + signals table. [VERIFIED]

### Secondary (MEDIUM confidence)
- data.gov.in catalog + resource pages via WebSearch — `current-daily-price-various-commodities-various-markets-mandi` ↔ UUID `9ef84268-…`; "Variety-wise Daily Market Prices Data of Commodity" family also documents no arrivals column. Catalog/resource HTML pages returned HTTP 403 to WebFetch, so field lists there are search-snippet level, not independently opened. [CITED: data.gov.in search results]
- CEDA Ashoka AgMarkNet API (`agmarknet.ceda.ashoka.edu.in/api/`, docs at `api.ceda.ashoka.edu.in/documentation/`) — JSON, daily prices + arrivals since 2001, `/states` and `/commodities` endpoints. Access terms/rate limits not verified. [CITED: WebSearch]
- India Data Portal `apmc-arrivals-and-prices` CKAN resource `a83bd1ad-ba46-41c7-9a80-c75537ce1172` with `arrivals_tonnes` — coverage/freshness unverified (403 to WebFetch). [CITED: WebSearch]
- Alembic + FastAPI lifespan pattern (`command.upgrade(Config("alembic.ini"), "head")`) — multiple guides; async caveats do **not** apply here (sync psycopg2 engine). [CITED: WebSearch, alembic docs]
- Next.js "Testing: Vitest" guide + 2025–2026 setup write-ups — `@vitejs/plugin-react` + jsdom + `vite-tsconfig-paths`, `vitest.setup.ts` with jest-dom. [CITED: nextjs.org/docs/app/guides/testing/vitest]
- next-intl "without i18n routing, switch locale from client" — GitHub discussion #1096 / issue #1334; next-intl v4 requires `NextIntlClientProvider` above any `useTranslations` client component. [CITED: github.com/amannn/next-intl]

### Tertiary (LOW confidence — validate during implementation)
- Arrivals unit on AGMARKNET is "tonnes" on the portal vs the fixture/signal "qtl/day" wording — [ASSUMED], not seen from a live arrivals feed this session.
- Exact haversine km for specific district pairs used in `test_geo.py` — compute and pin during implementation.
</sources>

<assumptions_log>
## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | No `api.data.gov.in` JSON resource exposes daily mandi arrivals (verified the canonical resource live; OGD catalog search found no other; other catalog pages 403'd) | Open Questions #1, Summary | LOW — if a resource exists, the team wires a live arrivals feed instead of the fallback; upside only. Planner should still treat D-02 as "implement the fallback." |
| A2 | AGMARKNET arrivals are conventionally in tonnes; `signal.py`/fixtures use a "qtl/day" figure | Pitfall 9, Sources (tertiary) | MEDIUM — only bites if a real arrivals source is added; wrong unit → 10× wrong number in the farmer-facing reason |
| A3 | CEDA Ashoka / India Data Portal arrivals endpoints exist but their open-access terms, rate limits, daily freshness, and Maharashtra completeness are unverified (pages 403'd) | Open Questions #1, Sources | MEDIUM — if the planner picks one as a source without checking, it may need registration or be stale/incomplete |
| A4 | Docker + Postgres 16 on :5433 is available on the build machine | Environment Availability | HIGH impact, LOW likelihood — CONCERNS.md implies it runs; if absent, nothing works |
| A5 | Read-only `/api/prices/*` + `/api/options` run unchanged on SQLite (portable ORM SELECTs) — inferred from reading the router code, not executed this session | Q3, code_examples | LOW — if some query uses a PG-only construct, that one smoke test moves behind `@pytest.mark.pg` |
| A6 | Existing Docker PG volume can be recreated (`down -v`) for the Alembic baseline — price data is regenerable cache, nothing else persisted | Runtime State Inventory, Pitfall 3 | LOW — worst case use `alembic stamp head` on the existing schema instead |
| A7 | `frontend/tsconfig.json` defines `@/* → ./src/*` (confirmed by reading it this session) — `vite-tsconfig-paths` will resolve test imports | Q4 | none — verified |
| A8 | The `SUS` legitimacy verdicts on alembic/pytest/vitest/testing-library are recency false-positives (first-party repos, 50M–100M npm weekly downloads) | Package Legitimacy Audit | LOW — planner adds a batch `checkpoint:human-verify` per protocol regardless |
| A9 | Internet access is available during Wave 0 for `pip install` / `npm i` | Environment Availability | HIGH impact if offline — blocks all tooling setup |

**If a real arrivals decision is needed:** A1–A3 are the ones to confirm with the user before locking. Everything else is low-risk or already verified.
</assumptions_log>

<metadata>
## Metadata

**Research scope:**
- Core technology: data.gov.in AGMARKNET REST API (arrivals availability), Alembic 1.19 + SQLAlchemy 2.0 sync + FastAPI lifespan, pytest for FastAPI/SQLAlchemy, vitest 4 + RTL 16 for Next 16 / React 19, next-intl 4 client-only locale + no-flash, i18n key-parity gating, `/nearby` distance-cap logic.
- Ecosystem: alembic, pytest, respx (optional), vitest, @vitejs/plugin-react, jsdom, @testing-library/{react,dom,jest-dom,user-event}, vite-tsconfig-paths.
- Patterns: env.py wiring, constraint naming convention, idempotent startup upgrade, DB-free ingestion refactor, SQLite test fixture without lifespan, ready-gate provider, recursive key-flatten parity test.
- Pitfalls: 11 catalogued; strongest are the arrivals-resource misconception, the `TestClient` lifespan trap, the SQLite/`on_conflict` incompatibility, and hydration-safe no-flash.

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm/PyPI this session; all are first-party.
- Architecture / patterns: HIGH — Alembic/pytest/vitest/next-intl patterns are well established and matched to the repo's actual (sync, no-routing) setup, which was read directly.
- Arrivals finding (D-02): HIGH that the OGD resource has no arrivals (live call); MEDIUM that no OGD alternative exists (catalog search only) and that non-OGD sources are unfit (pages 403'd).
- Pitfalls: HIGH — grounded in the read code and documented library behaviour.

**Research date:** 2026-09-01
**Valid until:** 2026-10-01 (stable tooling); the arrivals conclusion is durable until PRICE-07 (v2) revisits it. Re-verify npm versions if Wave 0 slips past ~2 weeks.
</metadata>

---

*Phase: 01-price-discovery-i18n-shell*
*Research completed: 2026-09-01*
*Ready for planning: yes*

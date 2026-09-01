# Concerns

**Analysis Date:** 2026-09-01

## Data / correctness
- **Live volume signal is dead.** The chosen data.gov.in resource has no arrivals field, so the sell/wait signal only ever uses the price factor on real data. Decide: accept it, add a second resource that has arrivals, or run the demo on fixtures (which do have volume).
- **`/api/prices/nearby` ignores the `days` window and uses only the single latest date** for the crop across all markets. If markets report on different dates, "latest date for the crop" may exclude a market that hasn't reported that day. Acceptable for demo; note for Phase 1 hardening.
- **Exact-string matching** on crop/market names. Live AGMARKNET names (e.g. "Tomato" vs "Tomato(Local)") may not match fixture names, so switching from fixtures to live data can empty the dashboard until `/api/options` repopulates.
- **`create_all` only, no migrations.** Any model change (and Pillars B/C are already declared) needs a real migration story before Phase 2. Recommend Alembic.
- Fixture dates are generated relative to `date.today()`, so trend windows always look "current" — fine for demo, slightly unrealistic.

## Security / auth
- **No auth at all.** Every endpoint is open, including `POST /api/ingest/run`. Phase 2 adds JWT + phone OTP; until then don't deploy publicly.
- `allow_origins` is env-driven but `allow_credentials=True` with `allow_methods=["*"]` — revisit once auth exists.
- Real `DATA_GOV_IN_API_KEY` is committed-adjacent in `backend/.env`; `.gitignore` now excludes `.env`, but the key is already on disk in the working tree — rotate if the repo history ever captured it.

## Frontend / UX
- `PriceDashboard` refetches all three endpoints whenever `options` identity changes (it's in the effect deps) — minor redundant fetches on mount.
- No error retry UI beyond a static message; `A11Y`/`PERF` requirements (skeletons exist, retry does not) partially met.
- i18n is client-only with a flash of default (English) locale before `localStorage` is read in `useEffect`. No SSR locale, no `hreflang`. Acceptable given the Cordova constraint but worth a loading guard.
- `mr.json` / `hi.json` must be kept key-complete with `en.json` — no CI check for missing keys yet (I18N-03).

## Ops
- `npm run dev` exits code 1 when backgrounded here; must launch Next via `node node_modules/next/dist/bin/next dev`. Document in README.
- Two stale dev servers from a prior session had to be killed (ports 8000 and 3000). No process manager.
- Docker DB on non-default port 5433 — anyone cloning on a machine without a port-5432 conflict will need to know why, or revert the mapping.
- No `frontend/.env` — relies on the `http://localhost:8000` default for `NEXT_PUBLIC_API_URL`.

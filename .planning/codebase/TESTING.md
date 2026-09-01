# Testing

**Analysis Date:** 2026-09-01

## Current state
- **No test framework, no tests, no CI** on either frontend or backend.
- No `pytest`, `vitest`, `jest`, or Playwright in dependencies.
- Manual verification only so far: `curl` against `/health`, `/api/options`, `/api/prices/*`; browser check of the dashboard at :3000.

## Implications for GSD phases
- `gsd-add-tests` / the Verify step will need to introduce a framework before writing tests.
- Recommended (to be confirmed in Discuss):
  - Backend: `pytest` + `httpx`/`fastapi.testclient`, SQLite or a disposable Postgres schema for DB tests. Pure functions `signal.compute_signal` and `geo.district_distance_km` and `ingestion.normalize_rows` are high-value, easy first targets.
  - Frontend: `vitest` + React Testing Library for components; mock `src/lib/api.ts`.
- `ingestion.run_ingestion` should be tested with the live call mocked (httpx transport) so the fixture-fallback path is covered.

## Test commands
- None configured. `package.json` has only `dev`, `build`, `start`, `lint`.

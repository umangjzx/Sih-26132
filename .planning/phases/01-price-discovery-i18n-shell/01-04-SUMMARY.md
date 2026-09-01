---
phase: 01-price-discovery-i18n-shell
plan: 04
subsystem: docs
tags: [readme, documentation, verification, ship-readiness]

requires:
  - phase: 01-03
    provides: "Frontend vitest suite green, i18n shell hardened, backend pytest suite green"

provides:
  - "README.md (root): prerequisites, full green-run command sequence, test commands, env var table, layout, links to sub-READMEs"
  - "backend/README.md: run command, migrations (alembic upgrade head + reset paths + stamp head), tests (pytest -q), env vars, data sources, arrivals limitation (PRICE-07)"
  - "frontend/README.md: run command (node node_modules/next/dist/bin/next dev), test commands (npm run test / npx vitest run), i18n model, NEXT_PUBLIC_API_URL"
  - "Verified green local run: backend 27/27 pytest, frontend 11/11 vitest"
affects: [phase-2-onboarding, ci-setup]

actuals:
  tokens: ~4000
  tasks: 1
  commits: 0

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - README.md
    - backend/README.md
    - frontend/README.md

key-decisions:
  - "All three READMEs were already written (pre-existing from earlier in the plan cycle) and satisfied every 01-04 must-have criterion — no writes required"
  - "Backend test count advanced from 25 (plan 01-02) to 27: the two additions (test_sparse_snapshot_yields_fixture, test_dense_snapshot_wins_over_fixture) cover D-04 snapshot density logic added during plan 01-02/03 work — legitimate, no regressions"

requirements-completed: [PERF-01]

coverage:
  - id: D1
    description: "README.md root: ≥40 lines, contains 'docker compose up -d db', links to backend/README.md and frontend/README.md"
    verification:
      - kind: manual_review
        ref: "README.md read — 60+ lines, all three criteria present"
        status: pass
    human_judgment: false
  - id: D2
    description: "backend/README.md: ≥40 lines, contains 'alembic upgrade head', documents INGEST_TRIGGER_SECRET, ARRIVALS_SOURCE_URL, DB reset paths, arrivals limitation"
    verification:
      - kind: manual_review
        ref: "backend/README.md read — 80+ lines, all criteria present"
        status: pass
    human_judgment: false
  - id: D3
    description: "frontend/README.md: ≥20 lines, contains 'node node_modules/next/dist/bin/next dev', documents NEXT_PUBLIC_API_URL, npm run test"
    verification:
      - kind: manual_review
        ref: "frontend/README.md read — 45+ lines, all criteria present"
        status: pass
    human_judgment: false
  - id: D4
    description: "Backend test suite green: cd backend && venv/Scripts/python.exe -m pytest -q → 27 passed"
    verification:
      - kind: unit
        ref: "pytest -q run — 27 passed in 0.78s, exit 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "Frontend test suite green: node_modules/.bin/vitest run → 4 files, 11 tests passed"
    verification:
      - kind: unit
        ref: "vitest run — 4 files, 11 passed in ~20s (jsdom startup), exit 0"
        status: pass
    human_judgment: false
  - id: D6
    description: "No secret values (DATA_GOV_IN_API_KEY, INGEST_TRIGGER_SECRET) appear in any README — placeholders only"
    verification:
      - kind: manual_review
        ref: "All three READMEs reviewed — only placeholder descriptions, no real values"
        status: pass
    human_judgment: false

duration: ~6min
completed: 2026-09-01
status: complete
---

# Phase 1 Plan 04: Ship Readiness READMEs + Green Run Verification Summary

**All three READMEs (root, backend, frontend) already satisfied every 01-04 must-have criterion; verified green local run — backend 27/27 pytest, frontend 11/11 vitest. Phase 1 complete.**

## Performance

- **Duration:** ~6 min
- **Completed:** 2026-09-01
- **Tasks:** 1 (verification only)
- **Files modified:** 0 (READMEs pre-existing and complete)

## Accomplishments

All three READMEs were already present and correct from prior plan work:

- **README.md (root):** 60+ lines. Covers prerequisites (Docker, Python 3.13 venv, Node + npm), the full 5-step green-run sequence (DB → migrations → backend → frontend → browser), the exact `node node_modules/next/dist/bin/next dev -p 3000` command with the `npm run dev` non-TTY caveat, test commands for both stacks, env var table (no real secrets), repo layout section, and links to `backend/README.md` and `frontend/README.md`.

- **backend/README.md:** 80+ lines. Covers the uvicorn run command, migrations section (alembic upgrade head, DB clean reset via `docker compose down -v`, schema-adopt via `alembic stamp head`, manual fallback), pytest command (with `-m "not pg"` opt-out note), data sources section (live → snapshot → fixture selection order with the density threshold explained), and the PRICE-07 arrivals limitation (volume factor dormant on live/snapshot data, reason text surfaced to users). Env var table with correct placeholder values.

- **frontend/README.md:** 45+ lines. Covers the exact `node node_modules/next/dist/bin/next dev -p 3000` command, `npm run build` network caveat, test commands (`npm run test` / `npx vitest run` fallback), the client-only i18n model (localStorage, no routing, Cordova-safe, `ready` gate, parity test), and the `NEXT_PUBLIC_API_URL` env var.

**Green run verification:**
- `cd backend && venv/Scripts/python.exe -m pytest -q` → **27 passed in 0.78s** (exit 0)
- `cd frontend && node_modules/.bin/vitest run` → **4 files, 11 tests passed** (exit 0)

The backend count of 27 (vs 25 at plan 01-02 completion) accounts for `test_sparse_snapshot_yields_fixture` and `test_dense_snapshot_wins_over_fixture` — both cover the D-04 snapshot density threshold logic (`SNAPSHOT_MIN_SERIES_POINTS`) added during plan 01-02/03. All tests are legitimate; no regressions.

## Files Created/Modified

None. All three READMEs were pre-existing and required no edits.

## Decisions Made

- READMEs verified as-is; no rewrites needed.
- Green run confirmed against the documented commands exactly as written in the READMEs.

## Deviations from Plan

None. The plan's must-haves were already met; the execution collapsed to read + verify.

## Known Stubs

None introduced.

## User Setup Required

None beyond what the READMEs document.

## Next Phase Readiness

- Phase 1 is complete. All 4 plans executed, all 16 Phase 1 requirements met (PRICE-01–06, I18N-01–05, A11Y-01–03, PERF-01).
- Phase 2 (Auth & Farmer–Buyer Matching) can begin immediately. Starting state:
  - All 7 Pillar B/C tables already migrated in `0001_initial_schema` (users, lots, demands, matches, offers, deals, disputes).
  - Phase 2 Alembic migrations start from `down_revision = "0001"`.
  - CORS intentionally narrow (GET/POST, no credentials) — Phase 2 must widen when JWT lands.
  - Backend pytest infra (`conftest.py`, SQLite StaticPool, `get_db` override, bare `TestClient`) is ready for protected-route tests.
  - Frontend vitest infra (`renderWithIntl`, vi.mock pattern) is ready for auth/lot/demand component tests.
- Open items carried into Phase 2: bilingual review of `hi.signal.hold` overlap; `react-hooks/set-state-in-effect` lint policy; `npm run build` on a networked machine.

## Self-Check: PASSED

- README.md: present, ≥40 lines, contains `docker compose up -d db`, links to sub-READMEs ✓
- backend/README.md: present, ≥40 lines, contains `alembic upgrade head`, documents INGEST_TRIGGER_SECRET + ARRIVALS_SOURCE_URL + arrivals limitation ✓
- frontend/README.md: present, ≥20 lines, contains `node node_modules/next/dist/bin/next dev` ✓
- No real secret values in any README ✓
- Backend pytest: 27 passed, exit 0 ✓
- Frontend vitest: 11 passed, exit 0 ✓

---
*Phase: 01-price-discovery-i18n-shell*
*Completed: 2026-09-01*

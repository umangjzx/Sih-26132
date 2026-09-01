---
phase: 01-price-discovery-i18n-shell
plan: 01
subsystem: database
tags: [alembic, sqlalchemy, fastapi, postgres, migrations, cors]

# Dependency graph
requires:
  - phase: bootstrap (commit d12cc76)
    provides: "FastAPI app, SQLAlchemy models (price_cache + 7 dormant Pillar B/C tables), Docker Postgres on :5433"
provides:
  - "backend/alembic/ package with an online-only env.py wired to Base.metadata and settings.database_url"
  - "0001_initial_schema migration covering all 8 model tables (price_cache, users, lots, demands, matches, offers, deals, disputes)"
  - "NAMING_CONVENTION + MetaData(naming_convention=...) on Base for deterministic constraint/index names"
  - "FastAPI lifespan runs `alembic upgrade head` idempotently as its first action; Base.metadata.create_all removed"
  - "alembic==1.19.1 pinned in backend/requirements.txt"
  - "CORS narrowed to allow_methods=[GET, POST] with no allow_credentials for the no-auth phase"
affects: [02-auth, backend testing plans, 01-04 backend README]

actuals:
  tokens: 3200
  tasks: 2
  commits: 3

tech-stack:
  added: [alembic==1.19.1, "Mako (alembic transitive dep)"]
  patterns:
    - "Alembic env.py: online-only, target_metadata = Base.metadata, import app.models, url from pydantic-settings"
    - "Startup migration: command.upgrade(AlembicConfig(ini), 'head') in lifespan try/except with logger.exception + re-raise"
    - "Constraint naming convention on DeclarativeBase metadata"

key-files:
  created:
    - backend/alembic.ini
    - backend/alembic/env.py
    - backend/alembic/script.py.mako
    - backend/alembic/versions/0001_initial_schema.py
    - backend/alembic/README
  modified:
    - backend/app/core/database.py
    - backend/app/main.py
    - backend/requirements.txt

key-decisions:
  - "alembic package legitimacy checkpoint: APPROVED (pre-authorized) — official SQLAlchemy sub-project, SUS verdict is a recency false-positive"
  - "DB reconciliation checkpoint: selected down-v (pre-authorized) — dev DB holds only regenerable price_cache fixture data"
  - "Normalized 0001 migration string literals to double quotes to match project style and the acceptance criterion"
  - "Committed the alembic init-generated backend/alembic/README with the package (scaffold completeness)"

patterns-established:
  - "Alembic is the single schema authority; create_all is forbidden in app code"
  - "env.py always resolves the DB URL from settings.database_url and is run from backend/"
  - "New backend deps are pinned exactly in requirements.txt after apscheduler"

requirements-completed: [PRICE-01]

coverage:
  - id: D1
    description: "`alembic upgrade head` from backend/ against an empty DB creates alembic_version + all 8 model tables"
    requirement: PRICE-01
    verification:
      - kind: integration
        ref: "docker compose exec db psql 'DROP SCHEMA public CASCADE; CREATE SCHEMA public' && alembic upgrade head && sqlalchemy.inspect(engine).get_table_names() covers all 9"
        status: pass
    human_judgment: false
  - id: D2
    description: "FastAPI app boots without Base.metadata.create_all — schema created only by the lifespan Alembic upgrade"
    verification:
      - kind: integration
        ref: "grep -c create_all backend/app/main.py == 0; grep -c command.upgrade == 1; uvicorn app.main:app boots clean"
        status: pass
    human_judgment: false
  - id: D3
    description: "GET /health -> 200 and GET /api/prices/trend returns >=1 price point after a fresh start (fixture fallback seeds data)"
    requirement: PRICE-01
    verification:
      - kind: e2e
        ref: "curl http://127.0.0.1:8011/health -> 200; curl .../api/prices/trend?crop=Onion&market=Pune&days=30 -> body with populated \"points\" array"
        status: pass
    human_judgment: false
  - id: D4
    description: "Re-running `alembic upgrade head` on an already-migrated DB is a no-op exiting 0"
    verification:
      - kind: integration
        ref: "two consecutive `alembic upgrade head` runs both exit 0, second prints IDEMPOTENT_OK"
        status: pass
    human_judgment: false
  - id: D5
    description: "`alembic revision --autogenerate` on an up-to-date DB produces a migration with no create_table/drop_table/add_column ops (env.py sees every model)"
    verification:
      - kind: integration
        ref: "autogenerate 'noop check' -> upgrade() body is `pass`; grep for schema ops exits 1; throwaway file deleted, not committed"
        status: pass
    human_judgment: false
  - id: D6
    description: "CORS narrowed to allow_methods=[GET, POST] with allow_credentials removed for the no-auth phase"
    verification:
      - kind: integration
        ref: "grep 'allow_methods=[\"GET\", \"POST\"]' backend/app/main.py present; grep 'allow_credentials=True' absent"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-09-01
status: complete
---

# Phase 1 Plan 01: Alembic schema authority + lifespan cutover Summary

**Alembic 1.19.1 adopted as the single schema authority: online-only env.py wired to Base.metadata, one autogenerated 0001 migration covering all 8 model tables, an idempotent `alembic upgrade head` in the FastAPI lifespan replacing `create_all`, plus a constraint naming convention on Base and CORS narrowed to GET/POST.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-09-01T04:56:43Z
- **Completed:** 2026-09-01T05:02:00Z
- **Tasks:** 2
- **Files modified:** 8 (5 created, 3 modified)

## Accomplishments
- `backend/alembic/` scaffolded via `alembic init`; `env.py` rewritten to the online-only Pattern 1 shape: `import app.models`, `config.set_main_option("sqlalchemy.url", settings.database_url)`, `target_metadata = Base.metadata`, `compare_type=True`, `compare_server_default=True`.
- `0001_initial_schema.py` autogenerated against a fresh Docker Postgres — confirmed 8 `op.create_table(` calls (price_cache, users, lots, demands, matches, offers, deals, disputes); `revision = "0001"`, `down_revision = None`.
- `NAMING_CONVENTION` dict + `MetaData(naming_convention=NAMING_CONVENTION)` added to `Base` in `database.py`; existing `uq_price_cache_key` name preserved.
- `app/main.py` lifespan: `command.upgrade(AlembicConfig(str(ALEMBIC_INI)), "head")` is now the first action inside a `try/except` that `logger.exception(...)` + re-raises; `Base.metadata.create_all(bind=engine)` and the now-unused `Base` / `engine` imports removed.
- CORS narrowed: `allow_methods=["GET", "POST"]`, `allow_credentials=True` removed, Phase 2 widening noted in a comment.
- `alembic==1.19.1` pinned in `requirements.txt` after `apscheduler==3.11.0`.

## Task Commits

1. **Task 1: Alembic scaffold + initial migration + lifespan cutover (tracer)** - `94a815a` (feat)
2. **Task 2: Idempotency comment, empty-autogen guard, CORS narrowing** - `3fcbc73` (chore)

**Plan metadata:** _(this SUMMARY + STATE/ROADMAP/REQUIREMENTS)_

## Files Created/Modified
- `backend/alembic.ini` - Alembic config; `script_location = alembic`, placeholder `sqlalchemy.url` left as-is (env.py overrides at runtime).
- `backend/alembic/env.py` - Online-only migration entrypoint; URL + metadata from the app.
- `backend/alembic/script.py.mako` - Default migration template (unmodified scaffold).
- `backend/alembic/versions/0001_initial_schema.py` - Initial migration, all 8 tables; string literals normalized to double quotes.
- `backend/alembic/README` - `alembic init` scaffold doc (committed for package completeness).
- `backend/app/core/database.py` - `NAMING_CONVENTION` + `Base.metadata = MetaData(naming_convention=...)`; `MetaData` import added.
- `backend/app/main.py` - Lifespan runs `alembic upgrade head` (idempotent, commented); `create_all` gone; CORS narrowed.
- `backend/requirements.txt` - `alembic==1.19.1` pin.

## Decisions Made
- **Checkpoint 1 (alembic package legitimacy — `checkpoint:human-verify`, blocking-human):** APPROVED (pre-authorized by the user). `alembic` is the official SQLAlchemy sub-project (github.com/sqlalchemy/alembic), millions of downloads/week, no install hooks; the `SUS`/`too-new` audit verdict is a known recency false-positive. Proceeded with `pip install alembic==1.19.1`.
- **Checkpoint 2 (DB reconciliation path — `checkpoint:decision`, blocking):** Selected **`down-v`** (pre-authorized). This dev database holds only regenerable fixture `price_cache` data. Ran `docker compose down -v && docker compose up -d db`, waited for healthy, then `alembic upgrade head`.
- Normalized the autogenerated migration's single-quoted string literals to double quotes (matches the rest of the backend and the acceptance criterion's `op.create_table("price_cache"` wording). Purely cosmetic — re-verified the migration still applies cleanly against an emptied schema.

## Note for plan 01-04 (backend/README.md)
Document the DB reset procedure:
- **Primary reset path:** `docker compose down -v && docker compose up -d db`, wait for the container to report healthy, then `cd backend && alembic upgrade head`. Safe because Phase 1 persists only the regenerable `price_cache` fixture/snapshot data.
- **Alternative (schema already matches the models, data must be preserved):** `cd backend && alembic stamp head` to adopt the existing schema without recreating the volume.
- **Manual startup fallback** (if the lifespan auto-upgrade fails): `cd backend && alembic upgrade head`. Always run `alembic` from `backend/` so pydantic-settings resolves `backend/.env` (Pitfall 2).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Verify command `-x throwaway=1` argument position**
- **Found during:** Task 2 (empty no-op autogenerate verify)
- **Issue:** The plan's verify ran `alembic revision --autogenerate -m "noop check" -x throwaway=1`. Alembic 1.19.1 requires global options (`-x`) *before* the subcommand, so it errored with `unrecognized arguments: -x throwaway=1`.
- **Fix:** Dropped `-x throwaway=1` entirely — env.py never reads `context.get_x_argument()`, so the flag was inert. Ran `alembic revision --autogenerate -m "noop check"` instead.
- **Files modified:** none (verify-command-only fix)
- **Verification:** Autogenerate produced `upgrade()` body of `pass`; schema-op grep exits 1 (no ops); throwaway file `64ba3279735d_noop_check.py` deleted and never staged.
- **Committed in:** n/a (no source change)

**2. [Rule 3 - Blocking] Committed `backend/alembic/README`**
- **Found during:** Task 1 (staging)
- **Issue:** `alembic init` generates `backend/alembic/README` alongside `env.py` / `script.py.mako` / `versions/`. It is not in the plan's `files_modified` list, but leaving it untracked violates the "never leave generated files untracked" rule.
- **Fix:** Staged and committed it with the rest of the alembic package.
- **Files modified:** `backend/alembic/README` (added)
- **Verification:** `git status` clean for `backend/` after the Task 1 commit.
- **Committed in:** `94a815a` (Task 1 commit)

**3. [Rule 1 - Style] Double-quoted the migration string literals**
- **Found during:** Task 1 (reviewing the autogenerated 0001)
- **Issue:** `alembic revision --autogenerate` emits single-quoted string literals; the rest of the backend and the acceptance criterion use double quotes.
- **Fix:** `sed -i "s/'/\"/g"` on `0001_initial_schema.py` (file contains only simple identifier literals, no embedded apostrophes).
- **Files modified:** `backend/alembic/versions/0001_initial_schema.py`
- **Verification:** Re-ran the clean-schema `alembic upgrade head` + inspector check — all 9 tables present, exit 0.
- **Committed in:** `94a815a` (Task 1 commit)

---

**Total deviations:** 3 (1 verify-command fix, 1 blocking scaffold file, 1 cosmetic). No source-behavior deviations.
**Impact on plan:** None. All acceptance criteria met as written; the `-x` fix is a plan verify-command typo, not a code issue.

## Issues Encountered
- Uvicorn startup on port 8011 took ~30s on the first boot (fresh DB → lifespan runs Alembic upgrade, then initial ingestion attempts the live data.gov.in API before falling back to fixtures). The plan's `sleep 8` was insufficient; polled `/health` until ready instead. `/health` returned 200 and `/api/prices/trend` returned a populated `points` array once startup completed.
- Git reports large `--stat` insertion/deletion counts on `backend/app/main.py` due to CRLF normalization on the Windows working tree; the actual stored diff (`git show --stat`) is the expected 5 insertions / 2 deletions. Commits made with `git -c core.autocrlf=false`.

## Final Verification Output
- `alembic upgrade head` against an emptied `public` schema: **exit 0**, `Running upgrade -> 0001, initial schema`.
- Inspector table set: `['alembic_version', 'deals', 'demands', 'disputes', 'lots', 'matches', 'offers', 'price_cache', 'users']` — MISSING: `set()`.
- Second `alembic upgrade head`: **exit 0**, `IDEMPOTENT_OK`.
- No-op autogenerate: `upgrade()` body `pass`, schema-op grep exit 1, throwaway deleted.
- `grep -c create_all backend/app/main.py` -> `0`; `grep -c command.upgrade` -> `1`.
- `alembic current` / `alembic heads` -> `0001 (head)`.
- `GET /health` -> `200`; `GET /api/prices/trend?crop=Onion&market=Pune&days=30` -> `{"crop":"Onion","market":"Pune","district":"Pune","points":[{"date":"2026-08-02","min_price":1187.02,...,"arrival_volume":128.8}, ...]}` (multiple points).
- `backend/requirements.txt` -> `alembic==1.19.1`.
- CORS: `allow_methods=["GET", "POST"]` present, `allow_credentials=True` absent -> `CORS_NARROWED_OK`.

## Known Stubs
None. No hardcoded empty returns, placeholder text, or unwired data sources introduced.

## Next Phase Readiness
- Phase 2 auth work has a real migration baseline: the 7 dormant Pillar B/C tables are already in `0001`, so auth migrations start from `down_revision = "0001"`.
- Alembic is the sole schema authority; any future `create_all` in app code is a regression.
- `backend/README.md` (plan 01-04) still needs the reset-path documentation captured above.
- CORS `allow_methods` / `allow_credentials` intentionally narrowed — Phase 2 must widen them when JWT/cookie auth lands.

## Self-Check

- FOUND: backend/alembic.ini
- FOUND: backend/alembic/env.py
- FOUND: backend/alembic/script.py.mako
- FOUND: backend/alembic/versions/0001_initial_schema.py
- FOUND: backend/alembic/README
- FOUND: commit 94a815a
- FOUND: commit 3fcbc73

## Self-Check: PASSED

---
*Phase: 01-price-discovery-i18n-shell*
*Completed: 2026-09-01*

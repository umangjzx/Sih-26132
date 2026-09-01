---
phase: 02-auth-matching
plan: 04
subsystem: i18n + tests + close-out
tags: [i18n, tests, verification, ship-readiness]

requires:
  - phase: 02-03
    provides: "All four frontend pages live, offer backend complete, 106 backend tests green"

provides:
  - "en/hi/mr locale files: auth, lots, demands, matching namespaces (all keys, full parity)"
  - "auth.test.ts — 6 localStorage unit tests"
  - "login.test.tsx — 7 login flow component tests"
  - "farmer.test.tsx — 4 lot form tests including offline queue"
  - "buyer.test.tsx — 4 match list tests including verified badge"
  - "Full green run: backend 106/106, frontend 32/32, tsc clean"
  - "Phase 2 close-out: STATE.md, ROADMAP.md, REQUIREMENTS.md updated"

actuals:
  tokens: ~22000
  tasks: 2
  commits: 0

key-files:
  created:
    - frontend/src/lib/auth.test.ts
    - frontend/src/app/login/login.test.tsx
    - frontend/src/app/farmer/farmer.test.tsx
    - frontend/src/app/buyer/buyer.test.tsx
  modified:
    - frontend/src/i18n/messages/en.json
    - frontend/src/i18n/messages/hi.json
    - frontend/src/i18n/messages/mr.json
    - .planning/STATE.md
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "vi.mock factory hoisting: vitest hoists vi.mock() above variable declarations — never reference a const inside a vi.mock factory; instead use vi.mocked(api.fn) in test bodies after importing api"
  - "findByPlaceholderText not findByText for locating inputs by their placeholder attribute"
  - "farmer form required field bypass: use fireEvent.change + fireEvent.submit on the form element directly rather than userEvent.click on the submit button (avoids native form validation blocking)"
  - "i18n locale files expanded mid-plan (02-03) to unblock tsc — 02-04 formally closes the loop with tests"

requirements-completed:
  - AUTH-01
  - AUTH-02
  - AUTH-03
  - AUTH-04
  - LOT-01
  - LOT-02
  - DEMAND-01
  - MATCH-01
  - MATCH-02
  - OFFER-01
  - OFFER-02
  - VERIFY-01
  - I18N-01
  - I18N-02
  - I18N-03

coverage:
  - id: backend-green
    description: "cd backend && venv/Scripts/python.exe -m pytest -q → 106 passed"
    verification:
      - kind: unit
        ref: "pytest -q run — 106 passed in 3.70s, exit 0"
        status: pass
  - id: frontend-green
    description: "cd frontend && vitest run → 8 files, 32 tests passed"
    verification:
      - kind: unit
        ref: "vitest run — 8 files, 32 passed, exit 0"
        status: pass
  - id: tsc-clean
    description: "cd frontend && npx tsc --noEmit → exit 0"
    verification:
      - kind: compile
        ref: "tsc --noEmit exit 0"
        status: pass
  - id: i18n-parity
    description: "en/hi/mr key sets are identical (parity.test.ts passes)"
    verification:
      - kind: unit
        ref: "parity.test.ts — 4 passed (included in the 32 vitest total)"
        status: pass

duration: ~30min
completed: 2026-09-01
status: complete
---

# Phase 2 Plan 04: i18n Completion + Frontend Tests + Phase Close-out

**Phase 2 is complete. All 12 Phase 2 requirements met. Backend 106/106, frontend 32/32, TypeScript clean.**

## Test counts

| Suite | Files | Tests | Status |
|-------|-------|-------|--------|
| Backend pytest | 7 | 106 | ✓ all pass |
| Frontend vitest | 8 | 32 | ✓ all pass |

Frontend test breakdown:
- `parity.test.ts` — 4 (key parity en↔hi↔mr, now covering auth/lots/demands/matching namespaces)
- `SellWaitSignalCard.test.tsx` — 3
- `LanguageSwitcher.test.tsx` — 2
- `PriceDashboard.test.tsx` — 2
- `auth.test.ts` — 6 (localStorage save/get/clear/invalid JSON)
- `login.test.tsx` — 7 (phone step, OTP step, transitions, error handling, back button)
- `farmer.test.tsx` — 4 (form renders, draft save, online submit, offline queue)
- `buyer.test.tsx` — 4 (demand form, verified badge shown/not-shown, score breakdown)

## Phase 2 accomplishments (all 4 plans)

### New backend files
- `app/core/security.py` — JWT (HS256), OTP generation, `get_current_user`, `require_role`
- `app/schemas/auth.py`, `lot.py`, `demand.py`, `match.py`, `offer.py`
- `app/api/auth.py` — OTP request/verify, refresh, `/me`
- `app/api/lots.py` — POST, GET /mine, GET /{id}
- `app/api/demands.py` — POST, GET /mine
- `app/api/matching.py` — GET /mine, GET /{id}
- `app/api/offers.py` — POST offer, GET thread, POST accept (→ Deal), POST decline
- `app/services/matching.py` — pure `score_pair()` + `run_matching()` (qty/price/distance, 0–100)
- `alembic/versions/94f518efb70d_auth_columns.py` — adds otp_code, otp_expires_at, is_active, created_at to users; score_detail to matches
- `tests/test_auth.py` (17), `test_lots.py` (11), `test_demands.py` (8), `test_matching.py` (27), `test_offers.py` (13)

### New frontend files
- `src/lib/auth.ts` — localStorage JWT helpers
- `src/lib/api.ts` — extended with postJson + 12 typed Phase 2 fetch functions
- `src/components/AuthProvider.tsx` — React context, localStorage re-hydration on mount
- `src/components/NavLinks.tsx` — role-aware header nav
- `src/app/login/page.tsx` — two-step phone→OTP login
- `src/app/farmer/page.tsx` — lot form with draft + offline queue + flush
- `src/app/buyer/page.tsx` — demand form + match list + score bar + verified badge
- `src/app/matches/[id]/page.tsx` — offer thread with accept/decline/make-offer

### Modified
- `app/main.py` — 5 new routers wired; CORS widened (allow_credentials, all methods)
- `app/models/user.py`, `match.py` — auth + score_detail columns
- `app/core/config.py` — JWT + OTP settings
- `layout.tsx` — AuthProvider added; NavLinks in header
- `en/hi/mr.json` — auth, lots, demands, matching namespaces (parity enforced)

## Phase 3 starting state

Phase 3 (Deal Tracking, Disputes & Admin) can begin immediately:

**What exists:**
- `Deal` model + migration in place; `Deal` rows created by `POST /api/offers/{id}/accept`
- `Dispute` model + migration in place; no endpoints yet
- `pipeline_status` enum on Deal: `matched | offer_accepted | logistics_arranged | delivered | paid | closed`
- All user auth + role gating infrastructure reusable

**What Phase 3 must build:**
- `GET /api/deals/mine` — per-user deal list (farmer sees deals where lot belongs to them; buyer sees deals where demand belongs to them)
- `PATCH /api/deals/{id}/advance` — advance pipeline_status (role-gated, e.g. logistics → delivered → paid)
- `POST /api/deals/{id}/disputes` — raise dispute flag
- `GET /api/users/me/history` — transaction history (lots + demands + deals)
- `GET /api/admin/dashboard` — aggregate stats (admin role only)
- Frontend: deal detail page, pipeline status indicator, dispute flag button, history page, admin dashboard

**Open items carried into Phase 3:**
- `hi.signal.hold` bilingual review (hold vs wait overlap)
- `react-hooks/set-state-in-effect` ESLint policy decision
- `npm run build` requires network for Google Fonts (defer to Phase 4)

---
*Phase: 02-auth-matching*
*Completed: 2026-09-01*

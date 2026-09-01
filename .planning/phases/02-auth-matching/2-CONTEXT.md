# Phase 2: Auth & Farmer–Buyer Matching — Context

**Gathered:** 2026-09-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the authentication layer and the full farmer–buyer matching loop.
A farmer/FPO logs in by phone OTP, creates lots (offline-tolerant), and sees
their ranked matches. A buyer logs in, posts demand, sees ranked matches, and
negotiates via offer/counter-offer threads. Accepting an offer creates a deal.
Buyers carry a verification badge from the stub `kyc_status` flag.

Everything deal-pipeline / dispute / admin (Pillar C) is OUT of this phase.
Phase 2 requires a working Phase 1 backend and all 8 tables already migrated.

</domain>

<starting_state>
## Starting State (from Phase 1)

### What exists

**Database (all 8 tables at migration head `0001`):**
- `users` — `id`, `role` (str20), `name`, `phone` (unique+idx), `district`, `taluka`, `kyc_status` (default "unverified")
- `lots` — `id`, `farmer_id → users`, `crop`, `quantity_kg`, `quality_grade`, `photo_url` (nullable), `expected_price`, `available_from` (Date), `location`, `status` (default "open")
- `demands` — `id`, `buyer_id → users`, `crop`, `quantity_kg`, `quality_spec`, `price_band_min`, `price_band_max`, `delivery_window`, `status` (default "open")
- `matches` — `id`, `lot_id → lots`, `demand_id → demands`, `score`, `status` (default "proposed")
- `offers` — `id`, `match_id → matches`, `from_user_id → users`, `price`, `quantity`, `message` (nullable), `status` (default "pending"), `created_at`
- `deals` — `id`, `match_id → matches`, `agreed_price`, `agreed_quantity`, `logistics_mode` (default "self_pickup"), `payment_status` (default "pending"), `pipeline_status` (default "matched"), `created_at`
- `disputes` — `id`, `deal_id → deals`, `raised_by → users`, `reason`, `status` (default "open"), `created_at`

**No auth columns exist on `users`** — `hashed_password`, `otp_code`, `otp_expires_at`, `is_active`, `created_at` are all absent. A migration `0002` must add them.

**No ORM relationships** defined on any model — all joins are explicit queries.

**CORS** intentionally narrow: `GET, POST` only, no `allow_credentials`. Must be widened in Phase 2 when JWT cookies or Auth header lands.

**Installed Python packages (backend/requirements.txt):**
fastapi, uvicorn[standard], sqlalchemy, psycopg2-binary, python-dotenv, pydantic, pydantic-settings, httpx, apscheduler, alembic, pytest
**NOT installed (Phase 2 needs):** `python-jose[cryptography]` or `PyJWT`, `passlib[bcrypt]`, `python-multipart`

**Installed frontend packages:** Next.js 16.3.3, React 19, next-intl 4.14.1, recharts, Tailwind v4, vitest, @testing-library/*
**NOT installed (Phase 2 may need):** nothing mandatory — auth state stays in a React context + localStorage; no form lib needed for the minimal OTP/lot forms.

**Backend architecture:**
- `app/main.py` — FastAPI with `lifespan` (Alembic upgrade → ingestion → APScheduler), one CORS middleware, one router mounted: `prices_router` at `/api`
- `app/core/config.py` — `Settings` (pydantic-settings, `.env` file); **no JWT settings yet**
- `app/core/database.py` — `Base`, `engine`, `SessionLocal`, `get_db`, `NAMING_CONVENTION`
- `app/schemas/price.py` — Pydantic v2 schemas for price routes; **no auth or lot schemas**
- `app/api/prices.py` — 5 price endpoints, no auth dependency on any

**Frontend architecture:**
- `src/app/layout.tsx` — root layout: `LocaleProvider` wraps everything, header has `LanguageSwitcher`
- `src/app/page.tsx` — single page: `<PriceDashboard />`
- `src/lib/api.ts` — `getJson<T>` helper + 4 typed price fetch functions; **no `postJson`, no auth headers**
- `src/i18n/LocaleProvider.tsx` — client-only context, localStorage, no routing
- `src/i18n/messages/en.json` — 5 namespaces: `common`, `nav`, `dashboard`, `signal`, `nearby`; **no auth/lot/demand/matching namespaces**

**Palette tokens (globals.css):**
`--color-bg: #faf7f0`, `--color-surface: #fff`, `--color-text: #2a2118`, `--color-border: #e2d9c8`,
`--color-brand: #2f5d3a`, `--color-brand-dark: #1f3f27`, `--color-accent: #c97c1f`
`--color-sell: #2f5d3a`, `--color-wait: #b3451f`, `--color-hold: #8a6d1f`
Global tap target: `button, select, input, a { min-height: 44px }`. Focus ring: `3px solid var(--color-brand)`.

**Test infra:**
- Backend: `pytest` + SQLite StaticPool, bare `TestClient(app)` (no lifespan). `Base.metadata.create_all(engine)` in `conftest.py` — **all Phase 2 models will be auto-included** since they inherit from the same `Base`.
- Frontend: `vitest` + React Testing Library 16 + jsdom. `renderWithIntl()` helper.

</starting_state>

<decisions>
## Implementation Decisions

### Authentication

- **D-01:** Use **phone + OTP** auth only (AUTH-01). No email/password. OTP delivery is stubbed — a 6-digit code is printed to the server log (console). No SMS gateway in Phase 2.
- **D-02:** OTP flow: `POST /api/auth/otp/request` (phone + name + role → upsert user, generate OTP, log it) → `POST /api/auth/otp/verify` (phone + code → validate, return JWT access token + refresh token). No separate register step; the first OTP request creates the user if they don't exist.
- **D-03:** JWT implementation: **`python-jose[cryptography]`** for token signing/verification. `HS256` algorithm. Short-lived access token (30 min) + long-lived refresh token (7 days) stored in `localStorage` on the client. `POST /api/auth/refresh` exchanges a valid refresh token for a new access pair.
- **D-04:** OTP storage: add `otp_code` (String 6, nullable) and `otp_expires_at` (DateTime TZ, nullable) directly to the `users` table in migration `0002`. No separate table — keeps the schema flat and the demo simple. OTP TTL: 10 minutes (configurable via `Settings.otp_ttl_seconds = 600`).
- **D-05:** Password hashing is **not used** — there is no password. OTP is the only credential. `passlib` is NOT needed. The OTP is compared as a plain string with `secrets.compare_digest` (constant-time, same pattern as the ingest secret gate in Phase 1).
- **D-06:** `python-multipart` is NOT needed — auth endpoints use JSON bodies, not form data.
- **D-07:** `get_current_user` FastAPI dependency: reads `Authorization: Bearer <token>` header (via `OAuth2PasswordBearer` scheme or a raw `HTTPBearer`). Decodes the JWT, fetches the user from DB. Raises 401 on invalid/expired token. Role-gating is a separate `require_role(role)` dependency factory.
- **D-08:** `users` migration `0002` additions: `otp_code String(6) nullable`, `otp_expires_at DateTime(tz) nullable`, `is_active Boolean default true`, `created_at DateTime(tz) server_default now()`. Update `User` model to match.
- **D-09:** CORS update in `main.py`: `allow_credentials=True`, `allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"]`. The client sends `Authorization` header (not a cookie) so technically `allow_credentials` isn't mandatory, but widening methods is required for lot/demand CRUD.
- **D-10:** JWT settings in `config.py`: `jwt_secret_key: str = ""` (must be set; blank → startup warning but not a hard failure — demo tolerance), `jwt_algorithm: str = "HS256"`, `access_token_expire_minutes: int = 30`, `refresh_token_expire_days: int = 7`, `otp_ttl_seconds: int = 600`.
- **D-11:** New `backend/app/core/security.py` module: `create_access_token()`, `create_refresh_token()`, `decode_token()`, `generate_otp()` (6-digit `secrets.randbelow`).

### Lot creation (AUTH-03 / LOT-01 / LOT-02)

- **D-12:** `POST /api/lots` — farmer creates a lot (crop, quantity_kg, quality_grade, expected_price, available_from, location; photo_url optional). Protected by `get_current_user` + `require_role("farmer")`.
- **D-13:** `GET /api/lots/mine` — farmer lists their own lots (filtered by `farmer_id = current_user.id`).
- **D-14:** `GET /api/lots/{id}` — read a single lot (owner or buyer who has a match).
- **D-15:** LOT-02 offline tolerance: implemented **client-side only** in the frontend with `localStorage` as the offline queue (no IndexedDB — simpler, sufficient for demo). The `CreateLotForm` component saves the form state to `localStorage["agrilink.lot_draft"]` on every keystroke, detects `navigator.onLine`, and on submit: if online → `POST /api/lots` → clear draft; if offline → save to `localStorage["agrilink.lot_queue"]` as a JSON array and show a "queued" toast. An `online` event listener fires the queue flush on reconnect.
- **D-16:** No photo upload in Phase 2 — `photo_url` field accepts a URL string entered by the user (or left blank). File upload is v2 scope.

### Demand posting (DEMAND-01)

- **D-17:** `POST /api/demands` — buyer creates demand (crop, quantity_kg, quality_spec, price_band_min, price_band_max, delivery_window). Protected by `get_current_user` + `require_role("buyer")`.
- **D-18:** `GET /api/demands/mine` — buyer lists their own demands.
- **D-19:** No offline queue for demands — buyers are assumed to have connectivity (simpler scope).

### Match scoring (MATCH-01 / MATCH-02)

- **D-20:** Match scoring is triggered automatically on `POST /api/lots` and `POST /api/demands` — after any new lot or demand is created, `run_matching()` is called synchronously (no background task; the dataset is small for demo). It generates or updates `Match` rows for all open lot×demand pairs that share the same crop.
- **D-21:** Scoring algorithm (rule-based, explainable — same principle as the price signal):
  - **Crop match** (binary): only pairs with the same crop proceed; others score 0 and are skipped.
  - **Quantity fit** (0–30 pts): `min(lot.quantity_kg, demand.quantity_kg) / max(lot.quantity_kg, demand.quantity_kg)` × 30. Perfect overlap = 30 pts.
  - **Price overlap** (0–40 pts): `lot.expected_price` vs `demand.price_band_min/max`. If lot price is within the demand band → 40 pts; partially overlapping → scaled by overlap fraction × 40; no overlap → 0 pts.
  - **Distance** (0–30 pts): `district_distance_km(lot.location, demand district)` — reuses `geo.py`. ≤50 km → 30 pts, 51–150 km → 20 pts, 151–300 km → 10 pts, >300 km → 0 pts. Unknown centroid → 15 pts (neutral).
  - **Total score**: 0–100. Only pairs scoring ≥ 30 are inserted/updated as `Match` rows (below threshold are silently discarded — not stored).
  - Score and component breakdown are stored on the `Match` row (`score` field). A `score_detail` JSON string field will be added to `matches` in migration `0002` for explainability (shows each component's contribution to the farmer/buyer UI).
- **D-22:** `GET /api/matches/mine` — returns all matches for the current user (farmer sees matches where `lots.farmer_id = me`; buyer sees matches where `demands.buyer_id = me`), ordered by `score desc`. Each match includes the lot and demand summary plus the score detail.

### Offer/counter-offer threads (OFFER-01 / OFFER-02)

- **D-23:** `POST /api/matches/{id}/offers` — either party on a match posts an offer (price, quantity, optional message). Protected: must be the farmer of the lot or the buyer of the demand. Validates: match status must be `"proposed"` or `"offered"`. Sets previous pending offer to `"countered"` if one exists. Creates a new `Offer` row with `status="pending"`. Updates `match.status = "offered"`.
- **D-24:** `GET /api/matches/{id}/offers` — full offer thread for a match, ordered `created_at asc`.
- **D-25:** `POST /api/offers/{offer_id}/accept` — accepting party confirms. Sets `offer.status = "accepted"`, all other pending offers on the same match → `"declined"`, `match.status = "accepted"`. **Creates a `Deal` row** (`agreed_price`, `agreed_quantity`, `logistics_mode = "self_pickup"`, `payment_status = "pending"`, `pipeline_status = "matched"`). Returns the new `Deal`. This satisfies OFFER-02.
- **D-26:** `POST /api/offers/{offer_id}/decline` — rejecting party declines a specific offer. Sets `offer.status = "declined"`. Match remains `"offered"` if other pending offers exist, or `"proposed"` if none.

### Buyer verification badge (VERIFY-01)

- **D-27:** The `kyc_status` field on `User` is already `"unverified"` by default. The `GET /api/matches/mine` response and the `GET /api/lots/{id}` response include the counter-party's `kyc_status`. A buyer with `kyc_status = "verified"` shows a badge in the UI. An admin can set `kyc_status = "verified"` via `PATCH /api/admin/users/{id}/kyc` (role: admin). No real verification workflow — this is a flag set by hand.

### Migration

- **D-28:** Migration `0002` (down_revision = "0001") adds:
  - `users`: `otp_code String(6) nullable`, `otp_expires_at DateTime(tz) nullable`, `is_active Boolean not-null default true`, `created_at DateTime(tz) server_default now()`
  - `matches`: `score_detail String(1000) nullable` (JSON string for explainability)
  - Indexes: `ix_lots_farmer_id`, `ix_lots_crop`, `ix_lots_status`, `ix_demands_buyer_id`, `ix_demands_crop`, `ix_demands_status`, `ix_matches_lot_id`, `ix_matches_demand_id` (these exist in the model-level `index=True` but were not in the 0001 migration — autogenerate will catch them)

### Frontend pages

- **D-29:** App Router page structure added in Phase 2 (all client-rendered, no server components on auth/lot/demand pages — Cordova constraint):
  - `src/app/login/page.tsx` — phone + OTP flow (two-step: enter phone → enter OTP)
  - `src/app/farmer/page.tsx` — farmer dashboard: lot list + create lot form
  - `src/app/buyer/page.tsx` — buyer dashboard: demand list + create demand form + match list
  - `src/app/matches/[id]/page.tsx` — offer thread for a specific match
  - All pages are `"use client"` components.
- **D-30:** Auth state: a `src/lib/auth.ts` module manages JWT storage in `localStorage["agrilink.token"]` and `localStorage["agrilink.refresh_token"]`. An `AuthContext` React context provides `user`, `login(token, refreshToken, user)`, `logout()`, and `isAuthenticated`. The `AuthProvider` wraps the app alongside `LocaleProvider`. On mount it reads `localStorage` and re-hydrates state (AUTH-04 session persistence).
- **D-31:** The header in `layout.tsx` gains a conditional nav: if authenticated, show role-appropriate links (Farmer: "My Lots", Buyer: "My Demands") + Logout button. If unauthenticated, show "Login" link. Keep `LanguageSwitcher` in the header.
- **D-32:** `src/lib/api.ts` gains: `postJson<T>()` helper, `withAuth(token)` header helper, and typed functions for `requestOtp`, `verifyOtp`, `createLot`, `listMyLots`, `createDemand`, `listMyDemands`, `listMyMatches`, `getMatchOffers`, `postOffer`, `acceptOffer`, `declineOffer`.
- **D-33:** i18n: add namespaces `auth`, `lots`, `demands`, `matching` to all three locale files. Keys in `en.json` first; hi/mr added in the same commit so parity test stays green.

### Testing

- **D-34:** Backend: extend `conftest.py` with `farmer_user`, `buyer_user` fixtures (insert `User` rows into SQLite `db`). Add `auth_client(user)` fixture that overrides `get_current_user` dep. Test modules: `test_auth.py` (OTP request/verify, JWT decode, 401 on protected routes), `test_lots.py`, `test_demands.py`, `test_matching.py` (scoring unit tests for the 4 components + integration smoke per endpoint), `test_offers.py` (post/accept/decline + deal creation).
- **D-35:** Frontend: component tests for `LoginForm` (phone step → OTP step), `CreateLotForm` (offline queue path), `MatchList` (badge renders for kyc_status="verified"). Same renderWithIntl + vi.mock pattern.

### Tech choices

- **D-36:** `python-jose[cryptography]` (JWT) — standard choice; `cryptography` extra provides the RS256/ES256 backend even though we use HS256; install at exact latest stable.
- **D-37:** No Redis, no background task queue for OTP — a DB column is sufficient for the demo.
- **D-38:** No additional frontend form library — the lot and demand forms are simple enough for plain React controlled inputs.
- **D-39:** Frontend protected routes: no middleware (Cordova constraint; Next.js middleware requires a Node.js runtime). Instead, each protected page component checks `isAuthenticated` from `AuthContext` on mount and redirects to `/login` via `useRouter().replace("/login")` if false.

</decisions>

<specifics>
## Specific Ideas

- The OTP console output should say something memorable: `[AgriLink OTP] Phone +91XXXXXXXXXX → Code: 123456 (expires 10 min)`. A judge verifying the demo will look in the terminal.
- The farmer lot form should show the user's district pre-filled as the default location (from their User record), since most farmers sell locally.
- The match score breakdown should read like the signal — plain sentences: "Crop matches: 40/40. Quantity fit: 22/30 (you have 500 kg, buyer wants 700 kg). Price overlap: 40/40 (your ₹2,400 is within their ₹2,000–₹2,800 band). Distance: 20/30 (Pune → Nashik, ~145 km)." Shown in the match card on both farmer and buyer side.
- The verification badge is a small green checkmark icon next to the buyer's name. Text: "Verified Buyer" (translation key `matching.verifiedBuyer`). No badge if `kyc_status != "verified"`.
- The offline queue indicator: a small amber banner "1 lot queued — will sync when back online." Clears when sync completes.

</specifics>

<canonical_refs>
## Canonical References for Phase 2 Plans

### Project
- `.planning/REQUIREMENTS.md` → AUTH-01–04, LOT-01–02, DEMAND-01, MATCH-01–02, OFFER-01–02, VERIFY-01
- `.planning/ROADMAP.md` §"Phase 2" → 6 success criteria

### Existing codebase (anchors)
- `backend/app/core/database.py` — `Base`, `get_db`; Phase 2 models inherit from `Base`
- `backend/app/core/config.py` — extend `Settings` for JWT params + OTP TTL
- `backend/app/main.py` — widen CORS, add new routers
- `backend/app/models/user.py` — add auth columns (migration 0002)
- `backend/app/models/match.py` — add `score_detail` (migration 0002)
- `backend/app/api/prices.py` — pattern to follow for new routers
- `backend/app/schemas/price.py` — Pydantic v2 pattern to follow for auth/lot/demand schemas
- `backend/tests/conftest.py` — extend with user fixtures + auth client override
- `frontend/src/lib/api.ts` — add `postJson`, auth helpers, typed Phase 2 endpoints
- `frontend/src/i18n/LocaleProvider.tsx` — auth provider must integrate alongside this
- `frontend/src/app/layout.tsx` — header nav update; auth provider placement
- `frontend/src/app/globals.css` — palette tokens; no changes needed
- `frontend/src/i18n/messages/en.json` — add `auth`, `lots`, `demands`, `matching` namespaces

### Constraints
- All new frontend pages must be `"use client"` (Cordova constraint: no server components on app routes)
- No Next.js middleware for route protection (no Node.js runtime in Cordova)
- CORS widening must happen before frontend auth flows are wired (or the browser will block credentialed requests)
- Alembic `0002` migration must have `down_revision = "0001"` and be auto-generated from the updated models

</canonical_refs>

<deferred>
## Deferred to Phase 3

- Deal pipeline advancement (Matched → Offer Accepted → ... → Closed) — `Deal` is created in Phase 2 but not advanced
- Dispute flag raising
- Per-user transaction history
- Admin dashboard
- Photo upload (file storage) for lots — `photo_url` accepts a URL string only in Phase 2

## Deferred to v2

- Real SMS OTP delivery
- Real KYC/document verification
- PostGIS distance queries
- Match-trigger background job for large datasets

</deferred>

---
*Phase: 02-auth-matching*
*Context gathered: 2026-09-01*

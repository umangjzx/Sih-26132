# Phase 3: Deal Tracking, Disputes & Admin — Context

**Gathered:** 2026-09-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver deal pipeline tracking, dispute flagging, per-user transaction history,
and the read-only admin dashboard. Every piece of data needed is already in the
migrated schema — Phase 3 is pure endpoint + frontend work on top of what exists.

Success criteria (from ROADMAP.md):
1. Accepting an offer creates a deal with agreed price/quantity, logistics mode, payment status ✓ (done in Phase 2)
2. A deal advances through Matched → Offer Accepted → Logistics Arranged → Delivered → Paid → Closed
3. Either party raises a dispute flag on a deal (open/closed only)
4. Each user sees their own history of lots, demands, and deals with current status
5. An admin sees aggregate price trends, active lot/demand counts, and the dispute queue — read only

Phase 2 already delivers criterion 1. Phase 3 delivers criteria 2–5.

</domain>

<starting_state>
## Starting State (from Phase 2)

### Database (all tables already migrated, no new migrations needed for Phase 3)

**`deals`** — `id`, `match_id → matches`, `agreed_price`, `agreed_quantity`,
`logistics_mode` (default "self_pickup"), `payment_status` (default "pending"),
`pipeline_status` (default "matched"), `created_at`.
Valid `pipeline_status` values: `matched | offer_accepted | logistics_arranged | delivered | paid | closed`

**`disputes`** — `id`, `deal_id → deals`, `raised_by → users`, `reason` (String 1000),
`status` (default "open"), `created_at`.
Valid `status` values: `open | closed`

**`users`** — unchanged; `role` ("farmer" | "buyer" | "admin") is the gate for admin-only routes.

**`lots`** — `status`: "open" | "matched" | "closed"
**`demands`** — `status`: "open" | "matched" | "closed"
**`matches`** — `status`: "proposed" | "offered" | "accepted" | "rejected"

### Existing backend

- All 6 Phase 2 routers wired: auth, lots, demands, matching, offers, prices
- `get_current_user` + `require_role` dependencies ready
- `conftest.py`: `db`, `farmer_user`, `buyer_user`, `farmer_client`, `buyer_client`, `auth_client`
- `DealResponse` schema already exists in `app/schemas/offer.py` (used by `accept_offer`)
- No deal, dispute, history, or admin endpoints exist yet

### Existing frontend

- `src/app/matches/[id]/page.tsx` — shows "Deal agreed!" banner when match is accepted, but
  no deal detail page, pipeline view, dispute button, or history page exists
- `AuthProvider`, `NavLinks`, all Phase 2 pages in place
- `en/hi/mr.json` — no `deals`, `disputes`, `history`, `admin` namespaces yet
- `src/lib/api.ts` — `DealResponse` type defined; no deal/dispute/history/admin fetch functions

</starting_state>

<decisions>
## Implementation Decisions

### Deal pipeline (DEAL-01 + DEAL-02)

- **D-01:** `GET /api/deals/mine` — returns all deals for the current user.
  - Farmer: deals where `matches.lot_id → lots.farmer_id = me`
  - Buyer: deals where `matches.demand_id → demands.buyer_id = me`
  - Admin: all deals (no filter)
  Returns `DealDetailResponse` (extends `DealResponse` with lot/demand/counterparty summaries).

- **D-02:** `PATCH /api/deals/{id}/advance` — advances `pipeline_status` by one step.
  Valid transitions (linear): `matched → offer_accepted → logistics_arranged → delivered → paid → closed`
  Access: either the farmer or buyer of the underlying match can advance (both parties
  must collaborate through the pipeline). Admin can also advance.
  Returns the updated `DealDetailResponse`.

- **D-03:** No `pipeline_status` can be skipped — the PATCH validates `current_status` against
  the linear sequence and rejects out-of-order advances with HTTP 400.

- **D-04:** `deal.payment_status` automatically set to `"paid"` when `pipeline_status`
  advances to `"paid"`. Remains `"pending"` at all other stages.

### Disputes (DISPUTE-01)

- **D-05:** `POST /api/deals/{deal_id}/disputes` — raises a dispute on a deal.
  Body: `{ reason: str }`. Only the farmer or buyer of the deal can raise one.
  A deal can have multiple dispute records (e.g. re-opened), but only one `open` dispute
  at a time is enforced (409 if an open dispute already exists).
  Returns `DisputeResponse`.

- **D-06:** `GET /api/deals/{deal_id}/disputes` — returns all disputes on a deal,
  ordered `created_at desc`. Access: farmer, buyer, or admin.

- **D-07:** `PATCH /api/disputes/{dispute_id}/close` — admin-only. Sets `status = "closed"`.

### Transaction history (HISTORY-01)

- **D-08:** `GET /api/history` — per-user combined history.
  Returns `HistoryResponse` with three lists:
  - `lots: list[LotResponse]` — ordered `id desc`
  - `demands: list[DemandResponse]` — ordered `id desc`
  - `deals: list[DealDetailResponse]` — ordered `created_at desc`
  Admin sees all records (unfiltered). Farmer/buyer see only their own.

### Admin dashboard (ADMIN-01)

- **D-09:** `GET /api/admin/dashboard` — admin-only (`require_role("admin")`).
  Returns `AdminDashboardResponse`:
  - `total_lots: int` — count of all lots
  - `open_lots: int` — count where status = "open"
  - `total_demands: int`
  - `open_demands: int`
  - `total_deals: int`
  - `price_trend_summary: list[PriceTrendPoint]` — last 30 days of modal price averages
    across all crops (reuses `PriceCache`; simple aggregate query)
  - `open_disputes: list[DisputeSummary]` — all disputes with `status = "open"`,
    ordered `created_at desc`, includes deal_id and reason

### Schemas

- **D-10:** New schemas in `app/schemas/deal.py`:
  - `DealDetailResponse` — extends deal fields with `lot: LotSummary`, `demand: DemandSummary`,
    `counterparty: CounterpartySummary`
  - `DisputeCreate(reason: str)` — validators: reason not empty, max 1000 chars
  - `DisputeResponse` — `id`, `deal_id`, `raised_by`, `reason`, `status`, `created_at`
  - `HistoryResponse` — `lots`, `demands`, `deals`
  - `AdminDashboardResponse` — see D-09

- **D-11:** `DealDetailResponse` is assembled manually (no ORM relationships), consistent with
  the pattern from `MatchResponse` in Phase 2.

### No new migration

- **D-12:** No new migration needed for Phase 3. All tables (`deals`, `disputes`) are already
  migrated in `0001_initial_schema`. Phase 3 is endpoint + frontend only.

### Frontend pages (Phase 3)

- **D-13:** New pages (all `"use client"`, Cordova constraint):
  - `src/app/history/page.tsx` — per-user transaction history (lots + demands + deals)
  - `src/app/admin/page.tsx` — admin dashboard (price trend summary, lot/demand counts, dispute queue)
  - `src/app/deals/[id]/page.tsx` — deal detail: pipeline status stepper, dispute raise button, dispute list

- **D-14:** `NavLinks.tsx` gains a "History" link for farmer/buyer, and "Admin" link for admin users.

- **D-15:** Pipeline status stepper: a horizontal step indicator showing the 6 stages.
  Current stage highlighted in brand green. "Advance" button shown to both parties if deal
  not yet `closed`. Clicked → calls PATCH /api/deals/{id}/advance → refreshes.

- **D-16:** Dispute raise form on the deal page: textarea for reason + submit.
  Shows existing disputes below. Open disputes shown with amber badge; closed with grey.

- **D-17:** New i18n namespaces: `deals`, `disputes`, `history`, `admin` in all three locales.

### Testing

- **D-18:** Backend: `test_deals.py` (pipeline advance, payment_status auto-set, out-of-order rejection),
  `test_disputes.py` (raise, list, close, duplicate-open rejection),
  `test_history.py` (farmer/buyer/admin history filtering),
  `test_admin.py` (dashboard counts + admin-only gate).
- **D-19:** Frontend: `deals.test.tsx` (pipeline stepper renders current stage),
  `history.test.tsx` (lots/demands/deals shown).

</decisions>

<specifics>
## Specific Ideas

- Pipeline stepper: show the stage names as chips connected by a line. Completed stages in
  `--color-sell` (green), current in `--color-brand`, future in `--color-border`. Labels:
  "Matched" → "Offer Accepted" → "Logistics Arranged" → "Delivered" → "Paid" → "Closed".
- Admin dashboard price trend: simple sparkline (reuse recharts LineChart from PriceDashboard)
  showing the 30-day average modal price per day across all crops. Label: "Average Modal Price (all crops)".
- The dispute queue on the admin dashboard is a compact table: Deal ID, Raised by, Reason (truncated),
  Date. Clicking a row navigates to `/deals/{deal_id}`.
- History page layout: three collapsible sections ("My Lots", "My Demands", "My Deals") with
  counts in the section header. Each deal card links to `/deals/{deal_id}`.

</specifics>

<canonical_refs>
## Canonical References for Phase 3 Plans

### Requirements
- `.planning/REQUIREMENTS.md` → DEAL-01, DEAL-02, DISPUTE-01, HISTORY-01, ADMIN-01
- `.planning/ROADMAP.md` §"Phase 3" → 5 success criteria

### Existing codebase anchors
- `backend/app/models/deal.py` — pipeline_status enum values
- `backend/app/models/dispute.py` — status: open | closed
- `backend/app/schemas/offer.py` — `DealResponse` already defined; Phase 3 extends it
- `backend/app/api/offers.py` — `_load_match_with_access` helper; pattern for ownership checks
- `backend/app/api/matching.py` — `_lot_summary`, `_demand_summary`, `_counterparty` helpers (reuse)
- `backend/tests/conftest.py` — farmer_user, buyer_user, farmer_client, buyer_client, auth_client
- `frontend/src/lib/api.ts` — `DealResponse` type + `postJson`/`getJson` helpers
- `frontend/src/app/matches/[id]/page.tsx` — deal banner; deal page extends this pattern
- `frontend/src/i18n/messages/en.json` — add deals/disputes/history/admin namespaces

### Pipeline transition sequence
```
matched → offer_accepted → logistics_arranged → delivered → paid → closed
```
(linear, no skipping)

</canonical_refs>

<deferred>
## Deferred to Phase 4

- Admin KYC update (`PATCH /api/admin/users/{id}/kyc`) — not needed for demo; admin can do this
  in Phase 4 or via direct DB access for the hackathon.
- Deal dispute close by admin endpoint (`PATCH /api/disputes/{id}/close`) — included in Phase 3 (D-07).

## Deferred to v2

- Real payment processing (DEAL-03)
- Real logistics integration (LOGISTICS-01)
- Full KYC / document workflow (VERIFY-02)

</deferred>

---
*Phase: 03-deal-tracking-admin*
*Context gathered: 2026-09-01*

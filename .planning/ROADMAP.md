# Roadmap: AgriLink

## Overview

AgriLink is built in four phases that map to the problem statement's three pillars plus
the mobile wrap. Phase 1 delivers price discovery and the i18n UI shell (largely already
scaffolded, to be hardened and completed). Phase 2 adds authentication and the
farmer–buyer matching loop. Phase 3 adds deal tracking, disputes, transaction history,
and the admin oversight dashboard. Phase 4 wraps the stable web app as an Android APK
with Apache Cordova. Each phase runs the GSD loop: Discuss → Plan → Execute → Verify → Ship.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): planned milestone work
- Decimal phases (2.1, 2.2): urgent insertions (marked INSERTED)

- [ ] **Phase 1: Price Discovery & i18n Shell** - Mandi price ingestion, trend charts, nearest-market comparison, explainable sell/wait signal, language-switchable UI (en/hi/mr)
- [ ] **Phase 2: Auth & Farmer–Buyer Matching** - Phone-OTP JWT auth with roles, lot creation, demand posting, rule-based match scoring, offer/counter-offer threads
- [ ] **Phase 3: Deal Tracking, Disputes & Admin** - Deal records, pipeline stages, dispute flags, per-user transaction history, read-only admin dashboard
- [ ] **Phase 4: Cordova Android Wrap** - Wrap the stable SPA into a `cordova-android` APK pointed at the deployed API

## Phase Details

### Phase 1: Price Discovery & i18n Shell
**Goal**: A farmer can pick a crop and market and see current prices, a 7/30/90-day trend, nearby-market comparison, and an explainable sell-now-vs-wait recommendation — in English, Hindi, or Marathi.
**Depends on**: Nothing (first phase)
**Requirements**: PRICE-01, PRICE-02, PRICE-03, PRICE-04, PRICE-05, PRICE-06, I18N-01, I18N-02, I18N-03, I18N-04, I18N-05, A11Y-01, A11Y-02, A11Y-03, PERF-01
**Success Criteria** (what must be TRUE):
  1. A scheduled job populates `PriceCache` from data.gov.in (Maharashtra, paginated), and falls back to the bundled fixture when the live API is unavailable
  2. User selects crop + market and sees latest min/modal/max plus a 7/30/90-day modal-price trend chart
  3. User sees a nearest-market comparison list (distance + current price, nearest first)
  4. User sees a sell_now / wait / hold recommendation with every driving number shown as a plain-language reason
  5. User switches between English, Hindi, and Marathi from the header; all visible copy translates and the choice persists with no layout break
  6. Pages show skeletons while loading, use ≥44px tap targets, high contrast, and the earthy palette
**Plans**: TBD

Plans:
- [ ] 01-01: TBD (set during plan-phase)

### Phase 2: Auth & Farmer–Buyer Matching
**Goal**: Farmers/FPOs and buyers log in by phone OTP, create lots and demand, get ranked rule-based matches, and negotiate via offer/counter-offer threads.
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, LOT-01, LOT-02, DEMAND-01, MATCH-01, MATCH-02, OFFER-01, OFFER-02, VERIFY-01
**Success Criteria** (what must be TRUE):
  1. A user logs in with phone + OTP (stubbed delivery), receives a JWT, and stays logged in across restarts
  2. Protected API routes reject missing/invalid tokens; role (farmer|buyer|admin) gates actions
  3. A farmer creates a lot (crop, quantity, grade, optional photo, location, expected price, available-from); the form queues offline and syncs when back online
  4. A buyer posts demand (crop, quantity, quality spec, price band, delivery window)
  5. Rule-based scoring ranks lot×demand matches and both sides see their ranked matches
  6. Either side can offer and counter on a matched lot; accepting an offer creates a deal; buyers show a verification badge from the stub flag
**Plans**: TBD

Plans:
- [ ] 02-01: TBD (set during plan-phase)

### Phase 3: Deal Tracking, Disputes & Admin
**Goal**: Accepted matches become deals that move through a pipeline; either party can raise a dispute; users see their transaction history; admins get a read-only oversight dashboard.
**Depends on**: Phase 2
**Requirements**: DEAL-01, DEAL-02, DISPUTE-01, HISTORY-01, ADMIN-01
**Success Criteria** (what must be TRUE):
  1. Accepting an offer creates a deal with agreed price/quantity, logistics mode, and payment status
  2. A deal advances through Matched → Offer Accepted → Logistics Arranged → Delivered → Paid → Closed
  3. Either party raises a dispute flag on a deal, creating an open/closed ticket
  4. Each user sees their own history of lots, demands, and deals with current status
  5. An admin sees aggregate price trends, active lot/demand counts, and the dispute queue — read only
**Plans**: TBD

Plans:
- [ ] 03-01: TBD (set during plan-phase)

### Phase 4: Cordova Android Wrap
**Goal**: The stable web app ships as an installable Android APK talking to the deployed API.
**Depends on**: Phase 3
**Requirements**: CORDOVA-01
**Success Criteria** (what must be TRUE):
  1. `cordova-android` build produces an APK that loads the SPA
  2. The APK talks to the deployed API (configurable base URL), with no reliance on a Next.js server
  3. Language switch, price discovery, login, lot/demand, and deal tracking all work inside the WebView
**Plans**: TBD

Plans:
- [ ] 04-01: TBD (set during plan-phase)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Price Discovery & i18n Shell | 0/TBD | In progress | - |
| 2. Auth & Farmer–Buyer Matching | 0/TBD | Not started | - |
| 3. Deal Tracking, Disputes & Admin | 0/TBD | Not started | - |
| 4. Cordova Android Wrap | 0/TBD | Not started | - |

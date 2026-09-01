# Requirements: AgriLink

**Defined:** 2026-09-01
**Core Value:** A farmer sees, in their own language, what their crop is worth nearby and a plain-language sell-now-vs-wait recommendation.

## v1 Requirements

Requirements for the SIH demo build. Each maps to a roadmap phase.

### Price Discovery (Pillar A)

- [x] **PRICE-01**: A scheduled background job pulls Maharashtra mandi prices from the
      data.gov.in AGMARKNET resource, paginating until exhausted, and upserts into
      `PriceCache` keyed on (market, crop, variety, date) — never called live on a user request
- [ ] **PRICE-02**: If the live API is unavailable (no key, error, empty), the job seeds
      from a bundled Maharashtra fixture snapshot so the app always has data
- [ ] **PRICE-03**: User selects a crop and market and sees the latest min / modal / max price
- [ ] **PRICE-04**: User sees a 7-, 30-, or 90-day modal-price trend chart for the selected crop + market
- [ ] **PRICE-05**: User sees a nearest-market comparison — other markets carrying the same
      crop, with distance and current modal price, nearest first
- [ ] **PRICE-06**: User sees a sell-now / wait / hold recommendation computed by explainable
      rules (price momentum vs 7- and 30-day averages, arrival-volume trend when available),
      with every number that drove it shown as a human-readable reason

### Internationalisation

- [ ] **I18N-01**: Every user-facing string is a translation key; no hardcoded copy in components
- [ ] **I18N-02**: English is the default locale and is fully translated
- [ ] **I18N-03**: Hindi and Marathi locale files exist and cover every key present in English
- [ ] **I18N-04**: A visible language switcher in the header changes the UI language and persists the choice
- [ ] **I18N-05**: Devanagari (Hindi/Marathi) and Latin (English) render cleanly with no layout break on switch

### Accessibility / Low-bandwidth

- [ ] **A11Y-01**: High contrast, large tap targets (≥44px), icon+text navigation (never icon-only)
- [ ] **A11Y-02**: Skeleton loading states while data is fetching
- [ ] **A11Y-03**: Trustworthy, agri-appropriate palette (earthy greens/ochres), not generic startup-blue
- [ ] **PERF-01**: Pages stay lightweight enough to load on patchy 3G

### Auth

- [ ] **AUTH-01**: User logs in with a phone number and an OTP (OTP delivery stubbed/console for the demo)
- [ ] **AUTH-02**: Authenticated requests carry a JWT; the API rejects missing/invalid tokens on protected routes
- [ ] **AUTH-03**: User has a role (farmer | buyer | admin) that gates what they can do and see
- [ ] **AUTH-04**: Session (JWT) persists across app restarts / browser refresh

### Farmer–Buyer Matching (Pillar B)

- [ ] **LOT-01**: A farmer/FPO creates a lot: crop, quantity, quality grade (self-declared + optional photo),
      location, expected price, available-from date
- [ ] **LOT-02**: Lot-creation form is offline-tolerant — queues locally when offline and syncs when back online
- [ ] **DEMAND-01**: A buyer posts demand: crop, quantity, quality spec, price band, delivery window
- [ ] **MATCH-01**: Rule-based match scoring (crop match, quantity fit, distance, price overlap)
      produces a score per lot×demand pair
- [ ] **MATCH-02**: Ranked matches are surfaced to both the farmer and the buyer
- [ ] **OFFER-01**: On a matched lot, either side can make an offer and the other can counter, in a thread
- [ ] **OFFER-02**: Accepting an offer marks the match accepted and creates a deal
- [ ] **VERIFY-01**: Buyers show a verification badge driven by the stub `kyc_status` flag

### Transaction Tracking (Pillar C)

- [ ] **DEAL-01**: An accepted match creates a deal: agreed price, quantity, logistics mode
      (self-pickup | platform-arranged stub), payment status
- [ ] **DEAL-02**: Deal pipeline advances through Matched → Offer Accepted → Logistics Arranged
      → Delivered → Paid → Closed
- [ ] **DISPUTE-01**: Either party can raise a dispute flag on a deal, creating a ticket (open/closed only)
- [ ] **HISTORY-01**: Each user sees their own transaction history (lots, demands, deals, statuses)

### Admin

- [ ] **ADMIN-01**: Admin sees a read-only dashboard: aggregate price trends, active lots/demand counts,
      and the dispute queue

### Mobile wrap

- [ ] **CORDOVA-01**: The stable web app wraps with Apache Cordova (`cordova-android`) into an installable APK
      that talks to the deployed API

## v2 Requirements

Deferred; tracked, not in the current roadmap.

- **PRICE-07**: Add a second data.gov.in resource that includes arrival volume, so the signal's
  volume factor works on live data
- **AUTH-05**: Real SMS OTP delivery via a gateway
- **VERIFY-02**: Real KYC/document verification workflow
- **DEAL-03**: Real payment gateway integration
- **LOGISTICS-01**: Real logistics/fleet integration
- **PRICE-08**: ML price forecasting alongside the rule-based signal
- **GEO-01**: PostGIS-backed geo queries if static centroids prove too coarse for match scoring

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real payment gateway | Hackathon scope; payment is status-tracking only |
| Real logistics / fleet integration | Hackathon scope; "platform-arranged" is a stub |
| Full KYC / document verification | Hackathon scope; `kyc_status` is a stub flag |
| ML price forecasting | Signal must be rule-based and explainable |
| Price feeds outside Maharashtra | Problem statement is Maharashtra-scoped |
| Live geocoding API | Static district centroids keep distance calc free and offline-safe |
| Full dispute resolution workflow | Only a flag + open/closed ticket is in scope |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PRICE-01 | Phase 1 | Complete |
| PRICE-02 | Phase 1 | In Progress |
| PRICE-03 | Phase 1 | In Progress |
| PRICE-04 | Phase 1 | In Progress |
| PRICE-05 | Phase 1 | In Progress |
| PRICE-06 | Phase 1 | In Progress |
| I18N-01 | Phase 1 | In Progress |
| I18N-02 | Phase 1 | In Progress |
| I18N-03 | Phase 1 | In Progress |
| I18N-04 | Phase 1 | In Progress |
| I18N-05 | Phase 1 | In Progress |
| A11Y-01 | Phase 1 | In Progress |
| A11Y-02 | Phase 1 | In Progress |
| A11Y-03 | Phase 1 | In Progress |
| PERF-01 | Phase 1 | Pending |
| AUTH-01 | Phase 2 | Pending |
| AUTH-02 | Phase 2 | Pending |
| AUTH-03 | Phase 2 | Pending |
| AUTH-04 | Phase 2 | Pending |
| LOT-01 | Phase 2 | Pending |
| LOT-02 | Phase 2 | Pending |
| DEMAND-01 | Phase 2 | Pending |
| MATCH-01 | Phase 2 | Pending |
| MATCH-02 | Phase 2 | Pending |
| OFFER-01 | Phase 2 | Pending |
| OFFER-02 | Phase 2 | Pending |
| VERIFY-01 | Phase 2 | Pending |
| DEAL-01 | Phase 3 | Pending |
| DEAL-02 | Phase 3 | Pending |
| DISPUTE-01 | Phase 3 | Pending |
| HISTORY-01 | Phase 3 | Pending |
| ADMIN-01 | Phase 3 | Pending |
| CORDOVA-01 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 33 total
- Mapped to phases: 33
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-01*
*Last updated: 2026-09-01 after GSD onboarding*

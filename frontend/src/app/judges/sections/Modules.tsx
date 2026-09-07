"use client";

import { ExpandableCard, JudgeSection, StatusPill, type ModuleStatus } from "./shared";

type Module = {
  name: string;
  status: ModuleStatus;
  purpose: string;
  users: string;
  features: string;
  input: string;
  processing: string;
  output: string;
  tech: string;
  db: string;
  apis: string;
  validation: string;
};

const MODULES: Module[] = [
  {
    name: "Price Intelligence & Trends",
    status: "production",
    purpose: "Turn raw AGMARKNET rows into a chartable, comparable trend",
    users: "Everyone, no login",
    features: "7/30/90-day trend chart, min/modal/max, nearby-market comparison bars",
    input: "crop, market, days query params",
    output: "Time-series JSON consumed by PriceTrendChart / MarketComparisonChart",
    processing: "Query price_cache by (crop, market, date range), sort chronologically",
    tech: "FastAPI + SQLAlchemy query, recharts on the frontend",
    db: "price_cache",
    apis: "GET /api/prices/trend, /api/prices/nearby, /api/options",
    validation: "Days param restricted to 7/30/90; empty result set returns an explicit \"not enough data\" rather than a broken chart",
  },
  {
    name: "Sell / Wait / Hold Signal",
    status: "production",
    purpose: "An explainable, reproducible recommendation — not a black box",
    users: "Farmers (public preview on /), full reasoning on /advisor",
    features: "Weighted multi-factor scoring, every reason listed with its own weight",
    input: "crop, market",
    output: "sell_now / wait / hold + reasons[]",
    processing: "total = 2×price_momentum + volume_trend + weather_pressure, with an MSP advisory overlay",
    tech: "Pure rule-based Python, no ML dependency",
    db: "price_cache, msp reference table",
    apis: "GET /api/prices/signal",
    validation: "Requires ≥7 days of history; returns a clear 'not enough data' message otherwise, never a fabricated signal",
  },
  {
    name: "Price Forecast",
    status: "production",
    purpose: "A statistically-grounded 30-day projection, fully inspectable",
    users: "Farmers, via the trend chart's dashed forecast line",
    features: "Trend + weekly-seasonality decomposition, ~80% prediction band, plain-language note",
    input: "crop, market, horizon (default 30 days)",
    output: "{trend_per_day, weekly_pattern, change_pct_7d/30d, points[]}",
    processing: "Least-squares trend over 45 days + day-of-week residual offset; never projects below 40% of the last known price",
    tech: "Plain Python — no ML library",
    db: "price_cache",
    apis: "GET /api/prices/forecast",
    validation: "Requires ≥14 days of history",
  },
  {
    name: "Decision Brief",
    status: "production",
    purpose: "One ranked action plan instead of eight separate signals to interpret",
    users: "Farmers, on /advisor and via Ask AgriLink",
    features: "Fuses signal + forecast + best market + MSP gap + weather + calendar + holidays + nearby buyers into now/soon/watch actions",
    input: "crop, district or lat/lon, radius_km, lang",
    output: "headline, score, confidence, actions[]",
    processing: "Rule-based orchestration across 7 other services; LLM (if configured) only phrases the 2-line summary",
    tech: "brief.py orchestrator",
    db: "price_cache + every reference table",
    apis: "GET /api/brief",
    validation: "404 on thin price history; each fused factor degrades independently instead of failing the whole response",
  },
  {
    name: "Diesel-Indexed Freight & Best Market",
    status: "production",
    purpose: "Rank markets by what actually reaches the farmer's pocket, not the sticker price",
    users: "Farmers choosing where to sell",
    features: "rate = handling_base + diesel₹/L ÷ (truck_kmpl × quintals_per_truck); explainable footnote on every panel",
    input: "crop, market or district or lat/lon",
    output: "Ranked markets with a `freight` breakdown block",
    processing: "Per-state diesel reference × road distance (OSRM) → net price after transport",
    tech: "freight.py + routing.py",
    db: "price_cache, curated diesel-price reference",
    apis: "GET /api/markets/best, /api/logistics/freight-rate",
    validation: "Falls back to straight-line haversine distance if OSRM is unreachable",
  },
  {
    name: "Matching Engine",
    status: "production",
    purpose: "Score every farmer×buyer pairing transparently",
    users: "Farmers and buyers, automatically on every new lot/demand",
    features: "Quantity fit (30) + price overlap (40) + distance (30) = 100-point score, breakdown shown on the match page",
    input: "Every open lot × every open demand sharing a crop",
    output: "Match rows scoring ≥30, with score_detail JSON",
    processing: "score_pair() — a pure function, fully unit-tested",
    tech: "matching.py",
    db: "lots, demands, matches",
    apis: "GET /api/matches/mine, /{id}; GET /admin/matching-health re-derives live matches to measure quality",
    validation: "Accepted/rejected matches are never silently overwritten by a re-score",
  },
  {
    name: "Offers & Negotiation",
    status: "production",
    purpose: "Give a counter-offer an informed number instead of a guess",
    users: "Farmers and buyers on a match",
    features: "Offer thread, one-tap counter pre-fill, a price-reference strip (mandi modal, MSP, asking band, suggested midpoint)",
    input: "price, quantity, message per offer",
    output: "Accepted offer → a Deal",
    processing: "negotiation() computes spread + midpoint from the last offers on both sides",
    tech: "FastAPI + SQLAlchemy",
    db: "offers, matches",
    apis: "POST/GET /matches/{id}/offers, GET /matches/{id}/negotiation",
    validation: "Every offer/counter is written to transaction_events — nothing is silently lost",
  },
  {
    name: "Deal Pipeline, Payments & Audit Ledger",
    status: "production",
    purpose: "Carry an agreement through to a paid, auditable close",
    users: "Farmers, buyers, admins",
    features: "6-stage pipeline, instalment payments, append-only event timeline, printable receipt",
    input: "Stage advances, payment records",
    output: "A closed deal with a full, exportable history",
    processing: "advance() is role- and stage-gated; auto-flips payment_status to paid once instalments cover the agreed value",
    tech: "deal/logistics/payment models + audit.py",
    db: "deals, deal_logistics, deal_payments, transaction_events",
    apis: "PATCH /deals/{id}/advance, GET/POST /deals/{id}/payments, GET /deals/{id}/events, /receipt",
    validation: "advance to 'paid' requires a payment_reference; receipt HTML escapes every user-supplied field",
  },
  {
    name: "Disputes & Resolution",
    status: "production",
    purpose: "A structured way to raise and close a problem on a deal",
    users: "Farmers, buyers, admins",
    features: "Raise / withdraw / resolve with an outcome, resolution note, and optional evidence URL",
    input: "reason on raise; outcome + resolution + evidence_url on close",
    output: "A resolved/withdrawn dispute with a full audit trail",
    processing: "One open dispute per deal at a time (v1.7 — migration f6c9d2e4a1b8, currently undocumented in the top-level README, corrected as part of this audit)",
    tech: "dispute.py model + disputes API",
    db: "disputes",
    apis: "POST/GET /deals/{id}/disputes, PATCH /disputes/{id}/close, /withdraw",
    validation: "Status machine: open → resolved | withdrawn",
  },
  {
    name: "Discovery Board",
    status: "production",
    purpose: "A browse layer on top of the automated matcher",
    users: "Farmers browsing demands, buyers browsing lots",
    features: "Radius filter (default 300 km or all-India), verified-seller badge, one-tap \"Express interest\"",
    input: "crop filter, radius",
    output: "Distance-sorted list; expressing interest runs score_pair live",
    processing: "Location fallback: profile coords → district centroid → no filter",
    tech: "discovery.py",
    db: "lots, demands, users (verification_status)",
    apis: "GET /lots/browse, /demands/browse, POST .../express-interest",
    validation: "Explains why no match yet, rather than a bare failure",
  },
  {
    name: "FPO Pools",
    status: "production",
    purpose: "Let smallholders bargain with the volume of one large seller",
    users: "Farmers",
    features: "Quantity-weighted aggregate price floored at the organizer's floor price, ranked buyer-demand candidates",
    input: "crop, target quantity, floor price; member commitments",
    output: "A single virtual lot scored against open demands",
    processing: "Same score_pair function as 1:1 matching, so the breakdown is equally transparent",
    tech: "pools.py",
    db: "pools, pool_members",
    apis: "POST/GET /pools, /{id}/join, /withdraw, /status, /{id}/accept-demand",
    validation: "Status machine: open → locked → matched → closed",
  },
  {
    name: "Forward Contracts",
    status: "production",
    purpose: "Let a farmer lock a price before harvest",
    users: "Buyers (post bids), farmers (commit)",
    features: "Price-band commitment, crop-calendar sanity check, auto-materialises into the normal deal pipeline on acceptance",
    input: "Bid: crop/quantity/price band/delivery window. Commitment: quantity/price/expected_ready",
    output: "An accepted commitment becomes a real Lot+Demand+Match+Offer+Deal",
    processing: "Guards: one active commitment per farmer per bid, accepted total ≤ bid quantity",
    tech: "forward.py",
    db: "forward_bids, forward_commitments",
    apis: "POST/GET /forward/bids, /forward/commitments/{id}/accept",
    validation: "calendar_warning returned when the ready date misses the crop's harvest months",
  },
  {
    name: "Price-Realisation Tracker",
    status: "production",
    purpose: "Prove, per deal, whether AgriLink actually beat the open mandi",
    users: "Farmers, on /history",
    features: "Realised ₹/qtl vs AGMARKNET mandi average and MSP, volume-weighted uplift headline, per-deal chart",
    input: "A farmer's closed deals",
    output: "uplift_vs_mandi_pct, below_msp_deals, best deal",
    processing: "Pure derivation from closed deals + price_cache + MSP — no new model",
    tech: "realization.py",
    db: "deals, price_cache, msp reference",
    apis: "GET /api/history/realization",
    validation: "Widens the date window before dropping the state filter, so a thin local sample doesn't silently skew the average",
  },
  {
    name: "Location Awareness & i18n",
    status: "production",
    purpose: "Maharashtra-first, but every price screen works for any Indian state; every screen reads in English, Hindi, or Marathi",
    users: "Everyone",
    features: "Geolocation / place search / all-India state picker; header language switcher",
    input: "Browser geolocation, place text, or a manual state pick",
    output: "Re-scoped prices/dashboards; instant locale switch",
    processing: "Client-only locale (no routing middleware); ~1,400 keys enforced at 100% parity across en/hi/mr by an automated test",
    tech: "LocationProvider, LocaleProvider, next-intl",
    db: "geo_cache",
    apis: "GET /api/location/resolve, /states, /districts",
    validation: "parity.test.ts fails the build on any missing or stray translation key",
  },
  {
    name: "Ask AgriLink & Knowledge Retrieval",
    status: "production",
    purpose: "Answer how-it-works and policy questions from real text, not just the selected crop's numbers",
    users: "Everyone, floating assistant",
    features: "Grounded Q&A over live data + a curated ~13-note corpus, source chips on every answer",
    input: "Free-text question, optional crop/market context",
    output: "Answer + sources[]; returns raw reference text without an LLM key",
    processing: "TF-IDF + difflib fuzzy retrieval — no embeddings, no network dependency for search itself",
    tech: "knowledge.py, llm.py",
    db: "None — corpus is code + generated docs from reference tables",
    apis: "POST /api/assistant/ask, GET /api/assistant/search",
    validation: "Explicitly says \"I don't have that\" when nothing matches, rather than guessing",
  },
  {
    name: "OCR Lot-Slip Assist",
    status: "production",
    purpose: "Cut listing time by reading a photographed mandi slip",
    users: "Farmers",
    features: "Auto-fills crop/quantity/grade/price/date as a draft the farmer reviews",
    input: "JPEG/PNG/WebP ≤ 6 MB",
    output: "{crop, quantity_kg, grade, expected_price, available_from, confidence}",
    processing: "OpenRouter vision call → backend validates + sanitises every field",
    tech: "ocr.py + llm.py",
    db: "None (stateless per request)",
    apis: "POST /api/ocr/lot-slip",
    validation: "Never auto-submits — the farmer edits every field first; degrades to unavailable without a key",
  },
  {
    name: "Admin Dashboard & Analytics",
    status: "production",
    purpose: "Operational visibility for the platform owner",
    users: "Admin role only",
    features: "GMV, funnel, deal-success rate, price-vs-MSP, supply vs demand, user verification queue, CSV export of the audit feed",
    input: "Admin actions (verify, deactivate, close dispute)",
    output: "Dashboards + a downloadable CSV of every transaction_events row",
    processing: "SQL aggregation, no external analytics service",
    tech: "admin.py",
    db: "Reads across nearly every table; writes to users.verification_status/is_active",
    apis: "GET /admin/dashboard, /analytics, /events(.csv), /matching-health; PATCH /admin/users/{id}/verify, /active",
    validation: "Role-gated at the route level (admin only)",
  },
  {
    name: "Cordova Android wrap",
    status: "planned",
    purpose: "Wrap the existing client-rendered frontend as a native Android app",
    users: "—",
    features: "—",
    input: "—",
    output: "—",
    processing: "Not started — but the frontend is deliberately built for it: 30 of 31 routes are pure client components with no server actions, no server-only data fetching",
    tech: "Apache Cordova (planned)",
    db: "—",
    apis: "—",
    validation: "—",
  },
  {
    name: "Satellite Crop-Health (NDVI)",
    status: "production",
    purpose: "An independent crop-vigour signal alongside price data — informational context, never a decision input",
    users: "Farmers, folded into the Decision Brief; also queryable standalone",
    features: "Vegetation-index reading (poor/fair/good/healthy band) for a ~3km radius around a lot's location",
    input: "lat, lon",
    output: "{ndvi, band, observed_on, available} — or available: false with no error if GEE isn't configured",
    processing: "Google Earth Engine query against MODIS/061/MOD13Q1 (free 16-day, 250m, cloud-gap-filled composite), 90-day lookback for a usable pass",
    tech: "satellite.py — optional: needs GEE_PROJECT_ID/GEE_SERVICE_ACCOUNT/GEE_CREDENTIALS_PATH, otherwise degrades to unavailable, same pattern as weather/LLM",
    db: "None (queried live, not cached)",
    apis: "GET /api/satellite/ndvi; folded into GET /api/brief as crop_health",
    validation: "Never blocks the Decision Brief — any GEE failure (missing creds, quota, no cloud-free imagery) is caught and returns null",
  },
];

export function ModulesSection() {
  return (
    <JudgeSection
      id="modules"
      eyebrow="Implementation evidence"
      title="Module-by-module explorer"
      quickAnswer="19 modules, individually expandable. 18 are shipped and tested; the one remaining gap (the Cordova Android wrap) is explicitly marked Planned, not silently omitted."
    >
      <div className="flex flex-col gap-2.5">
        {MODULES.map((m) => (
          <ExpandableCard
            key={m.name}
            title={m.name}
            subtitle={m.purpose}
            headerRight={<StatusPill status={m.status} />}
          >
            {m.status === "planned" || m.status === "deferred" ? (
              <p className="text-sm leading-relaxed text-[var(--ink-soft)]">{m.processing}</p>
            ) : (
              <dl className="grid gap-x-6 gap-y-3 text-xs sm:grid-cols-2">
                <div><dt className="font-bold uppercase tracking-wide text-[var(--ink-mute)]">Users</dt><dd className="mt-0.5 text-[var(--ink)]">{m.users}</dd></div>
                <div><dt className="font-bold uppercase tracking-wide text-[var(--ink-mute)]">Features</dt><dd className="mt-0.5 text-[var(--ink)]">{m.features}</dd></div>
                <div><dt className="font-bold uppercase tracking-wide text-[var(--ink-mute)]">Input</dt><dd className="mt-0.5 text-[var(--ink-soft)]">{m.input}</dd></div>
                <div><dt className="font-bold uppercase tracking-wide text-[var(--ink-mute)]">Output</dt><dd className="mt-0.5 text-[var(--ink-soft)]">{m.output}</dd></div>
                <div className="sm:col-span-2"><dt className="font-bold uppercase tracking-wide text-[var(--ink-mute)]">Processing logic</dt><dd className="mt-0.5 text-[var(--ink-soft)]">{m.processing}</dd></div>
                <div><dt className="font-bold uppercase tracking-wide text-[var(--ink-mute)]">Technology</dt><dd className="mt-0.5 text-[var(--ink)]">{m.tech}</dd></div>
                <div><dt className="font-bold uppercase tracking-wide text-[var(--ink-mute)]">Database</dt><dd className="mt-0.5 text-[var(--ink)]">{m.db}</dd></div>
                <div className="sm:col-span-2"><dt className="font-bold uppercase tracking-wide text-[var(--ink-mute)]">APIs</dt><dd className="mt-0.5 font-mono text-[11px] text-[var(--ink)]">{m.apis}</dd></div>
                <div className="sm:col-span-2"><dt className="font-bold uppercase tracking-wide text-[var(--ink-mute)]">Validation rules</dt><dd className="mt-0.5 text-[var(--ink-soft)]">{m.validation}</dd></div>
              </dl>
            )}
          </ExpandableCard>
        ))}
      </div>
    </JudgeSection>
  );
}

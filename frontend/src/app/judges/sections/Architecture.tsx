"use client";

import { Mermaid } from "@/components/Mermaid";
import { ExpandableCard, JudgeSection } from "./shared";

const CHART = `flowchart LR
    subgraph Client["Frontend — Next.js 16"]
      UI["31 routes: / · /features · /how-it-works\\n/market-insights · /about · /prices\\n/advisor · /directory · /explore · /alerts\\n/login · /farmer · /buyer · /matches\\n/browse · /pools · /forward · /profile\\n/history · /deals/[id] · /notifications\\n/admin · /admin/financing · ..."]
      Providers["LocaleProvider · AuthProvider · LocationProvider"]
    end

    subgraph API["Backend — FastAPI (111 endpoints / 19 routers)"]
      Routers["prices · intel · public · location · auth\\nlots · demands · matching · offers · deals\\ndisputes · history · alerts · admin\\nassistant · ocr · pools · forward · financing"]
      Services["33 services: ingestion · signal · forecast\\nmatching · weather · routing · best_market\\nfreight · brief · geo · geocode · locations\\nreference · holidays · alerts · audit\\nknowledge · realization · pools · discovery\\ngrading · llm · transporters · satellite · sms\\nfinancing_link · forward_settlement · digest · ..."]
      Sched["APScheduler — 6-hourly ingestion + alert eval"]
    end

    DB[("PostgreSQL 16\\n20 tables · 21 migrations")]

    subgraph Ext["11 external sources — every one has an offline fallback"]
      AGMARKNET["data.gov.in AGMARKNET"]
      OM["Open-Meteo"]
      OWM["OpenWeatherMap (optional key)"]
      POWER["NASA POWER"]
      OSRM["OSRM routing"]
      GEO["Nominatim + BigDataCloud"]
      NAGER["Nager.Date holidays"]
      OR["OpenRouter LLM (optional key)"]
      GEE["Google Earth Engine NDVI (optional key)"]
      SMS["Fast2SMS-compatible gateway (optional key)"]
    end

    UI -->|"REST /api/*"| Routers
    Routers --> Services
    Services --> DB
    Sched --> Services
    Services -.-> AGMARKNET & OM & OWM & POWER & OSRM & GEO & NAGER & OR
`;

const LAYERS = [
  {
    name: "Presentation layer",
    items: [
      {
        title: "Public marketing + docs surface",
        purpose: "Landing, features, how-it-works, market-insights, about, and this judges page — no login required",
        tech: "Next.js App Router, client components + 4 thin server-metadata wrappers",
        input: "Anonymous visitor navigation",
        output: "Rendered pages, cross-links into the product",
        deps: "next-intl (trilingual, marketing pages excluded), Tailwind v4 design tokens",
      },
      {
        title: "Farmer / buyer dashboards",
        purpose: "/prices, /advisor, /farmer, /buyer, /matches, /browse, /pools, /forward, /history, /deals/[id]",
        tech: "React 19 client components, recharts for trend/comparison charts",
        input: "User actions, form input, JWT-authenticated API calls",
        output: "Live price data, signals, deal state, receipts",
        deps: "lib/api.ts (105 typed fetch functions), AuthProvider, LocationProvider",
      },
      {
        title: "Admin dashboard",
        purpose: "/admin, /admin/users — analytics, dispute queue, price anomalies, user verification",
        tech: "React 19 client components, role-gated (admin only)",
        input: "Admin actions (verify user, close dispute, export CSV)",
        output: "GMV/funnel analytics, the append-only event feed, CSV export",
        deps: "/api/admin/* (13 endpoints)",
      },
    ],
  },
  {
    name: "Application layer",
    items: [
      {
        title: "Authentication",
        purpose: "Phone + password login/register, JWT access+refresh pair",
        tech: "python-jose (HS256), stdlib PBKDF2-HMAC-SHA256 (600,000 iterations)",
        input: "{phone, password} or {phone, name, role, password, ...}",
        output: "Access + refresh token pair, or 401/403/409",
        deps: "core/security.py, users table",
      },
      {
        title: "Business logic — matching, deals, pools, forward",
        purpose: "Lot×demand scoring, offer negotiation, deal pipeline, pool aggregation, forward-contract lifecycle",
        tech: "Pure Python scoring functions (matching.py, pools.py), SQLAlchemy 2.0 typed models",
        input: "Lot/demand posts, offers, pool commitments, forward bids",
        output: "Scored matches, deals, pool candidates, materialised deals",
        deps: "20-table schema, audit.py (append-only event log)",
      },
      {
        title: "Rate limiting",
        purpose: "In-process sliding-window limiter guarding 27 call sites across 14 route files",
        tech: "Custom thread-lock-protected limiter (core/ratelimit.py) — deliberately not Redis, since the deployment runs a single Uvicorn worker",
        input: "Every request to a guarded endpoint",
        output: "429 once the window is exceeded",
        deps: "register/login, lots, demands, forward, pools, OCR, ingest trigger, and more",
      },
      {
        title: "Notification system",
        purpose: "In-app notification feed — price alerts, forward-settlement risk, plus offer/financing/deal/dispute events",
        tech: "Synchronous creation in offers.py, financing.py, deals.py, disputes.py (v1.20) + an APScheduler job (alerts.py) for the two ingestion-driven kinds",
        input: "The triggering action itself, or active price_alerts + ingestion results",
        output: "Notification rows, unread-count badge",
        deps: "6-hourly scheduler + 20-hour debounce for price alerts; direct writes for everything else",
      },
      {
        title: "Analytics engine",
        purpose: "GMV, deal funnel, deal-success rate, price-vs-MSP, supply vs demand",
        tech: "SQL aggregation in admin.py, no external analytics service",
        input: "deals, transaction_events, price_cache tables",
        output: "/api/admin/analytics response",
        deps: "Admin-only, role-gated",
      },
    ],
  },
  {
    name: "Intelligence layer",
    items: [
      {
        title: "Sell / wait / hold signal — rule-based, not ML",
        purpose: "Weighted-factor decision on whether to sell now, wait, or hold",
        tech: "Deterministic Python (signal.py) — price momentum ×2, arrival trend ×1, weather ×1, MSP advisory",
        input: "≥7 days of crop+market price history",
        output: "sell_now / wait / hold + full reasons[] list",
        deps: "price_cache, weather.get_forecast, MSP reference table",
      },
      {
        title: "Price forecast — statistical, not ML",
        purpose: "Interpretable trend + weekly-seasonality projection with a prediction band",
        tech: "Least-squares trend + day-of-week residual decomposition (forecast.py) — no ML library",
        input: "≥14 days of price history",
        output: "30-day projection, ~80% prediction band, plain-language note",
        deps: "price_cache",
      },
      {
        title: "OCR — real API-powered AI",
        purpose: "Read a photographed mandi slip and draft the lot-listing form",
        tech: "OpenRouter vision-capable LLM (external model, not self-trained)",
        input: "JPEG/PNG/WebP ≤ 6 MB",
        output: "Draft {crop, quantity_kg, grade, expected_price, available_from, confidence} — farmer reviews before submit",
        deps: "OPENROUTER_API_KEY (optional — degrades to unavailable)",
      },
      {
        title: "Ask AgriLink — retrieval + optional LLM phrasing",
        purpose: "Grounded Q&A over live crop data and a curated knowledge base",
        tech: "TF-IDF + difflib fuzzy retrieval (knowledge.py) — no embeddings, no network; LLM only phrases the answer",
        input: "Free-text question + optional crop/market context",
        output: "Answer with sources[]; falls back to raw reference text without a key",
        deps: "~13 curated notes + generated docs from MSP/calendar/grading data",
      },
    ],
  },
  {
    name: "Data layer",
    items: [
      {
        title: "PostgreSQL 16",
        purpose: "System of record — 20 tables, managed only by Alembic (no create_all)",
        tech: "SQLAlchemy 2.0 typed Mapped[] models, deterministic constraint naming",
        input: "Every write path in the app",
        output: "Durable relational storage",
        deps: "21-migration linear chain, head d730f5bc2c6d",
      },
      {
        title: "geo_cache",
        purpose: "Cache for reverse/forward geocode lookups",
        tech: "Postgres table, keyed by query string",
        input: "Place names, lat/lon pairs",
        output: "Cached display name + coordinates, avoiding repeat external calls",
        deps: "Nominatim, BigDataCloud, Open-Meteo geocoding",
      },
      {
        title: "Committed snapshot + fixtures",
        purpose: "Offline-safe fallback so the app runs air-gapped",
        tech: "maharashtra_snapshot.csv (real AGMARKNET export) + deterministic synthetic fixtures (seed 26132)",
        input: "Used when the live API has no key or is unreachable",
        output: "90 days of realistic price history per crop×market",
        deps: "ingestion.py fallback chain",
      },
    ],
  },
  {
    name: "External integrations",
    items: [
      {
        title: "data.gov.in AGMARKNET (current + archive)",
        purpose: "Today's mandi prices + per-series daily history for trends",
        tech: "httpx GET, paginated",
        input: "State filter, resource ID",
        output: "min/max/modal price rows",
        deps: "Optional DATA_GOV_IN_API_KEY — blank uses the committed snapshot",
      },
      {
        title: "Open-Meteo (forecast + geocoding), NASA POWER",
        purpose: "7-day weather forecast, rainfall anomaly, place → lat/lon",
        tech: "httpx GET, keyless",
        input: "Coordinates or place name",
        output: "Forecast, anomaly %, geocoded location",
        deps: "None — always available, no key needed",
      },
      {
        title: "OSRM, Nominatim + BigDataCloud, Nager.Date",
        purpose: "Road distance/time, reverse geocode, mandi holidays",
        tech: "Public demo OSRM server, keyless reverse-geocoders, keyless holiday API",
        input: "Coordinate pairs, lat/lon, country/year",
        output: "Distance/duration, state+district, holiday list",
        deps: "Each has a static fallback (haversine, nearest-place table, built-in 2026 list)",
      },
      {
        title: "OpenRouter LLM",
        purpose: "Readability layer only — never a source of truth for numbers",
        tech: "httpx POST, vision + chat completions",
        input: "Structured context block the rule-based engine already computed",
        output: "Plain-language phrasing; degrades to {available:false} without a key",
        deps: "Optional OPENROUTER_API_KEY",
      },
    ],
  },
];

export function ArchitectureSection() {
  return (
    <JudgeSection
      id="architecture"
      eyebrow="How it's built"
      title="Complete system architecture"
      quickAnswer="A client-rendered Next.js frontend talks to a FastAPI backend over REST; the backend owns all business logic and a 20-table Postgres schema, and every outbound call to an external source degrades gracefully instead of breaking the UI."
    >
      <div className="al-card-plain p-4 sm:p-6">
        <Mermaid chart={CHART} />
      </div>

      <div className="mt-10 flex flex-col gap-8">
        {LAYERS.map((layer) => (
          <div key={layer.name}>
            <h3 className="font-heading text-lg font-bold text-[var(--ink)]">{layer.name}</h3>
            <div className="mt-3 flex flex-col gap-3">
              {layer.items.map((item) => (
                <ExpandableCard key={item.title} title={item.title} subtitle={item.purpose}>
                  <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wide text-[var(--ink-mute)]">Technology</dt>
                      <dd className="mt-0.5 text-[var(--ink)]">{item.tech}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wide text-[var(--ink-mute)]">Dependencies</dt>
                      <dd className="mt-0.5 text-[var(--ink)]">{item.deps}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wide text-[var(--ink-mute)]">Input</dt>
                      <dd className="mt-0.5 text-[var(--ink-soft)]">{item.input}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wide text-[var(--ink-mute)]">Output</dt>
                      <dd className="mt-0.5 text-[var(--ink-soft)]">{item.output}</dd>
                    </div>
                  </dl>
                </ExpandableCard>
              ))}
            </div>
          </div>
        ))}
      </div>
    </JudgeSection>
  );
}

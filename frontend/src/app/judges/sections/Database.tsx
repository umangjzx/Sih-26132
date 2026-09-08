"use client";

import { Mermaid } from "@/components/Mermaid";
import { ExpandableCard, JudgeSection } from "./shared";

const ER_CHART = `erDiagram
    USERS ||--o{ LOTS : "farmer_id"
    USERS ||--o{ DEMANDS : "buyer_id"
    USERS ||--o{ OFFERS : "from_user_id"
    USERS ||--o{ PRICE_ALERTS : "user_id"
    USERS ||--o{ NOTIFICATIONS : "user_id"
    USERS ||--o{ DISPUTES : "raised_by"
    USERS ||--o{ POOLS : "organizer_id"
    USERS ||--o{ POOL_MEMBERS : "farmer_id"
    USERS ||--o{ FORWARD_BIDS : "buyer_id"
    USERS ||--o{ FORWARD_COMMITMENTS : "farmer_id"
    LOTS ||--o{ MATCHES : "lot_id"
    LOTS ||--o{ POOL_MEMBERS : "lot_id"
    DEMANDS ||--o{ MATCHES : "demand_id"
    MATCHES ||--o{ OFFERS : "match_id"
    MATCHES ||--|| DEALS : "match_id"
    DEALS ||--o{ DISPUTES : "deal_id"
    DEALS ||--o| DEAL_LOGISTICS : "deal_id"
    DEALS ||--o{ DEAL_PAYMENTS : "deal_id"
    DEALS ||--o{ TRANSACTION_EVENTS : "entity_id"
    FORWARD_BIDS ||--o{ FORWARD_COMMITMENTS : "bid_id"
    FORWARD_COMMITMENTS ||--o| DEALS : "deal_id"
    USERS ||--o{ FINANCING_REQUESTS : "farmer_id"
    LOTS ||--o{ FINANCING_REQUESTS : "lot_id"
`;

const LIFECYCLE_CHART = `flowchart LR
    A["Collection\\ndata.gov.in · Open-Meteo · NASA POWER\\nOSRM · Nager.Date · user input"] --> B["Validation\\nPydantic schemas, regex, range checks"]
    B --> C["Processing\\nsignal · forecast · matching · freight\\nscore_pair · brief assembly"]
    C --> D["Storage\\nPostgreSQL 16, 20 tables\\nAlembic-managed"]
    D --> E["Analysis\\nadmin analytics, price-realisation,\\nmatching-health"]
    E --> F["Insights\\nDecision Brief, sell/wait signal,\\nbest-market ranking"]
    F --> G["User action\\nlist a lot, post a demand, accept an offer,\\nrecord a payment"]
    G -.->|"every action is logged"| H[("transaction_events\\nappend-only")]
`;

const TABLES = [
  { name: "price_cache", purpose: "Every ingested mandi price row — the system's raw market data", fields: "crop, variety, market, district, state, date, min/max/modal_price, arrival_volume?", rel: "Read by signal, forecast, best_market, brief, realization, admin analytics", source: "data.gov.in AGMARKNET (live) → committed snapshot → synthetic fixtures" },
  { name: "users", purpose: "Every farmer, buyer, and admin account", fields: "role, name, phone (unique), district, taluka, state, lat/lon?, verification_status, password_hash (PBKDF2), is_active, created_at", rel: "Owns lots, demands, offers, alerts, notifications, disputes, pools, forward bids/commitments", source: "User-submitted at registration" },
  { name: "lots", purpose: "Produce a farmer has listed for sale", fields: "farmer_id→users, crop, quantity_kg, quality_grade, photo_url?, expected_price, available_from, location, lat/lon?", rel: "Scored against demands into matches; can join a pool", source: "Farmer form (optionally OCR-drafted)" },
  { name: "demands", purpose: "Produce a buyer wants to purchase", fields: "buyer_id→users, crop, quantity_kg, quality_spec, price_band_min/max, delivery_window, delivery_district, lat/lon?", rel: "Scored against lots into matches", source: "Buyer form" },
  { name: "matches", purpose: "A scored lot×demand pairing", fields: "lot_id→lots, demand_id→demands, score, score_detail (JSON)", rel: "One match can carry many offers; an accepted offer creates exactly one deal", source: "Computed by matching.score_pair" },
  { name: "offers", purpose: "One round of a negotiation on a match", fields: "match_id→matches, from_user_id→users, price, quantity, message?, created_at", rel: "Belongs to a match; acceptance creates a deal", source: "Farmer/buyer offer thread" },
  { name: "deals", purpose: "An agreed transaction, tracked through its pipeline", fields: "match_id→matches, agreed_price/quantity, logistics_mode, payment_status, pipeline_status", rel: "Has logistics, payments, disputes, and the transaction-event timeline", source: "Offer acceptance" },
  { name: "deal_logistics", purpose: "The delivery plan for one deal", fields: "deal_id→deals (unique), mode, transporter_name/phone?, vehicle_type?, pickup/drop points, distance_km?, est_cost_inr?, status", rel: "One-to-one with deals", source: "Farmer/buyer form, cost auto-estimated via OSRM + diesel-indexed rate" },
  { name: "deal_payments", purpose: "Every instalment recorded against a deal", fields: "deal_id→deals, payer_id→users, amount_inr, method, reference?, paid_at", rel: "Sums determine when payment_status flips to paid", source: "Buyer-recorded payment" },
  { name: "transaction_events", purpose: "Append-only audit log — never updated, only inserted", fields: "entity_type, entity_id, actor_id?, action, detail (JSON), created_at", rel: "Referenced by deals, payments, logistics, matches, offers, pools, forward bids", source: "Written by audit.log_event() on every meaningful action" },
  { name: "transporters", purpose: "Curated directory of transport providers", fields: "name, phone?, base_district, lat/lon?, vehicle_types, service_states", rel: "Suggested when filling in deal_logistics", source: "Curated, seeded on boot" },
  { name: "disputes", purpose: "A raised issue on a deal, with a resolution trail", fields: "deal_id→deals, raised_by→users, reason, status (open/resolved/withdrawn), outcome?, resolution?, evidence_url?, resolved_by?, resolved_at?", rel: "One open dispute per deal at a time", source: "Farmer/buyer raises; admin or raiser resolves — v1.7, migration f6c9d2e4a1b8" },
  { name: "pools", purpose: "An FPO-style collective lot", fields: "organizer_id→users, crop, title, target_quantity_kg, floor_price, location, status, matched_deal_id?", rel: "Aggregates pool_members; scored against demands like a single large lot", source: "Farmer-organized" },
  { name: "pool_members", purpose: "One farmer's committed quantity within a pool", fields: "pool_id→pools, farmer_id→users, lot_id→lots?, quantity_kg, expected_price, status", rel: "Many members roll up into one pool's aggregate", source: "Farmer joins a pool" },
  { name: "forward_bids", purpose: "A buyer's pre-harvest bid for future delivery", fields: "buyer_id→users, crop, quantity_kg, price_min/max, delivery_from/to, delivery_district, status", rel: "Farmers commit against it; an accepted commitment materialises into a deal", source: "Buyer-posted" },
  { name: "forward_commitments", purpose: "A farmer's commitment against a forward bid", fields: "bid_id→forward_bids, farmer_id→users, quantity_kg, price_per_qtl, expected_ready, status, deal_id?", rel: "Acceptance creates a Lot+Demand+Match+Offer+Deal in one step", source: "Farmer commits, with a crop-calendar sanity check" },
  { name: "geo_cache", purpose: "Cached geocode lookups, to avoid repeat external calls", fields: "query (unique), lat/lon, display_name, admin1/2/3, created_at", rel: "Written by geocode.py, read on every location resolve", source: "Nominatim / BigDataCloud / Open-Meteo geocoding" },
  { name: "price_alerts", purpose: "\"Notify me when crop X at market Y crosses ₹Z\"", fields: "user_id→users, crop, market, direction (above/below), threshold, active, last_triggered_at?", rel: "Evaluated by the 6-hourly scheduler; writes notifications", source: "User-created" },
  { name: "notifications", purpose: "In-app notification feed", fields: "user_id→users, kind, title, body, link?, read, created_at", rel: "One row per price-alert crossing, forward-settlement risk, offer accept/decline, financing approve/reject, deal-pipeline advance, or dispute resolution", source: "v1.20 — most kinds fire synchronously from the triggering action (offers.py, financing.py, deals.py, disputes.py); price alerts and forward-settlement risk still fire from the 6-hourly ingestion cycle" },
  { name: "financing_requests", purpose: "A farmer's warehouse-receipt financing ask against a lot", fields: "lot_id→lots, farmer_id→users, requested_amount_inr, warehouse_name?, receipt_ref?, note?, status (pending/approved/rejected/withdrawn), admin_note?, reviewed_by?→users, reviewed_at?, deal_id?→deals (v1.21)", rel: "Reviewed by admin; deal_id is stamped once the pledged lot actually sells, so the request is traceable to its outcome — the platform still tracks the request only, no money is held or disbursed", source: "Farmer-submitted, v1.17" },
];

export function DatabaseSection() {
  return (
    <JudgeSection
      id="database"
      eyebrow="Data model"
      title="Database design — 20 tables, 22 migrations"
      quickAnswer="A real relational schema (not a document store bolted onto a marketplace) — every foreign key below exists as an actual constraint, managed exclusively through Alembic migrations, never create_all()."
    >
      <div className="al-card-plain p-4 sm:p-6">
        <Mermaid chart={ER_CHART} />
      </div>

      <h3 className="mt-8 font-heading text-base font-bold text-[var(--ink)]">Schema explorer</h3>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">Click any table to see its real columns, relationships, and data source.</p>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {TABLES.map((t) => (
          <ExpandableCard key={t.name} title={t.name} subtitle={t.purpose}>
            <dl className="flex flex-col gap-2.5 text-xs">
              <div>
                <dt className="font-bold uppercase tracking-wide text-[var(--ink-mute)]">Important fields</dt>
                <dd className="mt-0.5 font-mono text-[11px] leading-relaxed text-[var(--ink)]">{t.fields}</dd>
              </div>
              <div>
                <dt className="font-bold uppercase tracking-wide text-[var(--ink-mute)]">Relationships</dt>
                <dd className="mt-0.5 text-[var(--ink-soft)]">{t.rel}</dd>
              </div>
              <div>
                <dt className="font-bold uppercase tracking-wide text-[var(--ink-mute)]">Data source</dt>
                <dd className="mt-0.5 text-[var(--ink-soft)]">{t.source}</dd>
              </div>
            </dl>
          </ExpandableCard>
        ))}
      </div>

      <h3 className="mt-10 font-heading text-base font-bold text-[var(--ink)]">Data lifecycle</h3>
      <div className="al-card-plain mt-3 p-4 sm:p-6">
        <Mermaid chart={LIFECYCLE_CHART} />
      </div>
    </JudgeSection>
  );
}

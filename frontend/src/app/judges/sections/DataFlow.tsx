"use client";

import { Mermaid } from "@/components/Mermaid";
import { JudgeSection } from "./shared";

type Flow = {
  name: string;
  chart: string;
  trigger: string;
  processing: string;
  db: string;
  external: string;
  errors: string;
};

const FLOWS: Flow[] = [
  {
    name: "Registration & login",
    chart: `flowchart TD
      A["Farmer/buyer submits\\nphone + password (+ name/role on register)"] --> B{"Pydantic validation\\nphone regex, password ≥ 6, name non-blank"}
      B -- invalid --> B1["422 — field errors returned"]
      B -- valid --> C{"Rate limiter\\n(per-route sliding window)"}
      C -- exceeded --> C1["429 Too Many Requests"]
      C -- ok --> D["Register: hash PBKDF2-SHA256\\n600k iters + salt → users row\\n\\nLogin: verify hash, constant-time compare"]
      D -- register: phone taken --> D1["409 Conflict"]
      D -- login: mismatch --> D2["401 Unauthorized"]
      D -- login: inactive --> D3["403 Forbidden"]
      D -- success --> E["Issue JWT access + refresh pair (HS256)"]
      E --> F["Frontend stores tokens in localStorage\\nAuthProvider exposes user/token/isAuthenticated"]`,
    trigger: "Visitor submits the sign-in or create-account tab on /login",
    processing: "Pydantic schema validation → rate limiter → PBKDF2 hash create/verify → JWT issue",
    db: "users table — insert on register, select + password_hash compare on login",
    external: "None",
    errors: "422 on bad input, 429 on rate-limit, 409 on duplicate phone, 401 on wrong password, 403 on a deactivated account",
  },
  {
    name: "Lot listing with OCR autofill",
    chart: `flowchart TD
      A["Farmer photographs a mandi slip\\n(CameraCapture.tsx)"] --> B["POST /api/ocr/lot-slip\\n(rate-limited, auth: farmer)"]
      B --> C{"OPENROUTER_API_KEY set?"}
      C -- no --> C1["{available: false} —\\nfarmer fills the form manually"]
      C -- yes --> D["OpenRouter vision call\\nimage sent as base64 data URL"]
      D --> E["Backend validates + sanitises\\nevery returned field"]
      E --> F["Draft returned:\\ncrop, quantity_kg, grade,\\nexpected_price, available_from, confidence"]
      F --> G["Farmer reviews/edits every field\\n(never auto-submitted)"]
      G --> H["POST /api/lots/ — geocodes location,\\nsaves Lot, runs matching synchronously"]
      H --> I["Matched buyers see the new lot\\nin /browse and scored /matches"]`,
    trigger: "Farmer taps \"Scan slip\" on /farmer, or fills the form manually",
    processing: "Vision-LLM extraction → backend field validation/sanitisation → farmer edits → geocode → matching engine run",
    db: "lots table insert; matches table upserted for every open demand sharing the crop, scoring ≥ 30",
    external: "OpenRouter (optional, vision call)",
    errors: "Missing key → {available:false}, farmer types the form manually; any OCR field that can't be read is omitted, never guessed",
  },
  {
    name: "Matching, negotiation & deal",
    chart: `flowchart TD
      A["Lot or demand posted"] --> B["run_matching(db):\\nscore_pair() vs every open counterpart\\nsharing crop (case-insensitive)"]
      B --> C{"score ≥ 30?"}
      C -- no --> C1["No Match row created"]
      C -- yes --> D["Match row upserted\\n(accepted/rejected never overwritten)"]
      D --> E["GET /matches/{id}/negotiation:\\nlast offers, spread, suggested midpoint,\\nmandi modal + MSP + asking band"]
      E --> F["Offer thread: propose → counter → counter…"]
      F --> G{"Offer accepted?"}
      G -- no --> F
      G -- yes --> H["Deal created: agreed_price/qty set,\\nlot + demand flip to matched"]
      H --> I["Deal pipeline: matched → offer_accepted →\\nlogistics_arranged → delivered → paid → closed"]`,
    trigger: "A new lot or demand is posted, or a farmer/buyer opens the offer thread",
    processing: "Deterministic weighted scoring (quantity fit 30 + price overlap 40 + distance 30, max 100) → negotiation context → accept",
    db: "matches, offers, deals tables; transaction_events logs every offer/counter/accept",
    external: "None — distance uses cached geocode data",
    errors: "Below-30 pairs are simply never matched (visible via /admin/matching-health, which re-derives live matches to check quality)",
  },
  {
    name: "Decision Brief assembly",
    chart: `flowchart TD
      A["GET /api/brief?crop&district|lat/lon"] --> B["Resolve reference market\\n(nearest with ≥7 days history)"]
      B --> C["Fuse in parallel:\\nsell/wait signal · 30-day forecast\\ndiesel-costed best market · MSP gap\\n3-day weather · crop-calendar phase\\nnext mandi holiday · nearby verified demands"]
      C --> D["Rank into actions[]\\n{rank, kind, urgency: now/soon/watch, title, detail}"]
      D --> E{"OPENROUTER_API_KEY set?"}
      E -- yes --> F["LLM phrases a 2-line summary\\n(never invents a number)"]
      E -- no --> F2["Deterministic sentence used instead"]
      F --> G["Response: headline + score + confidence + actions[]"]
      F2 --> G`,
    trigger: "Farmer opens /advisor, or the LLM assistant needs a grounded answer",
    processing: "8 independent rule-based signals fused and urgency-ranked; LLM (if configured) only rephrases the 2-line summary",
    db: "price_cache, MSP/calendar/holiday reference tables, demands (for nearby verified buyers)",
    external: "Open-Meteo, NASA POWER (weather), OpenRouter (optional, summary only)",
    errors: "404 on thin price history (<7 days); every fused signal degrades independently (e.g. weather unavailable → that factor drops to weight 0) rather than failing the whole endpoint",
  },
  {
    name: "Location-based discovery",
    chart: `flowchart TD
      A["Browser geolocation, place search,\\nor all-India state picker"] --> B["GET /api/location/resolve"]
      B --> C{"lat/lon given?"}
      C -- yes --> D["Reverse geocode:\\nNominatim → BigDataCloud → nearest_state"]
      C -- no, place text --> E["Forward geocode via Open-Meteo"]
      D --> F["Cache result in geo_cache"]
      E --> F
      F --> G{"ensure_prices=true and\\nstate has no cached prices?"}
      G -- yes --> H["ensure_state_ingested\\n(rate-limited, 1 attempt/hour/state)"]
      G -- no --> I["Return {state, district, lat, lon, source}"]
      H --> I
      I --> J["Frontend LocationProvider persists to\\nlocalStorage, re-scopes /prices, /explore, /directory"]`,
    trigger: "First visit (no stored location), or the user changes location via the header chip",
    processing: "Reverse/forward geocode with a 3-tier fallback chain, then an optional on-demand price-ingestion trigger for that state",
    db: "geo_cache (upsert), price_cache (if ingestion triggered)",
    external: "OSM Nominatim (primary), BigDataCloud (fallback), Open-Meteo geocoding, data.gov.in (if ingestion triggered)",
    errors: "Every geocoder failing falls through to the static 60-city nearest-place table, then nearest_state — the location chip never shows an error, worst case it's less precise",
  },
];

export function DataFlowSection() {
  return (
    <JudgeSection
      id="data-flow"
      eyebrow="How data moves"
      title="Interactive data flow — five real workflows"
      quickAnswer="Every arrow below is a real function call or HTTP route, not a conceptual sketch — file references are in the Architecture section above."
    >
      <div className="flex flex-col gap-8">
        {FLOWS.map((f) => (
          <div key={f.name} className="al-card-plain p-5 sm:p-6">
            <h3 className="font-heading text-base font-bold text-[var(--ink)]">{f.name}</h3>
            <div className="mt-3 overflow-x-auto rounded-xl bg-[var(--paper)] p-3">
              <Mermaid chart={f.chart} />
            </div>
            <dl className="mt-4 grid gap-x-6 gap-y-2.5 text-xs sm:grid-cols-2">
              <div><dt className="font-bold uppercase tracking-wide text-[var(--ink-mute)]">Trigger</dt><dd className="mt-0.5 text-[var(--ink-soft)]">{f.trigger}</dd></div>
              <div><dt className="font-bold uppercase tracking-wide text-[var(--ink-mute)]">Processing</dt><dd className="mt-0.5 text-[var(--ink-soft)]">{f.processing}</dd></div>
              <div><dt className="font-bold uppercase tracking-wide text-[var(--ink-mute)]">Database operations</dt><dd className="mt-0.5 text-[var(--ink-soft)]">{f.db}</dd></div>
              <div><dt className="font-bold uppercase tracking-wide text-[var(--ink-mute)]">External APIs</dt><dd className="mt-0.5 text-[var(--ink-soft)]">{f.external}</dd></div>
              <div className="sm:col-span-2"><dt className="font-bold uppercase tracking-wide text-[var(--ink-mute)]">Error handling</dt><dd className="mt-0.5 text-[var(--ink-soft)]">{f.errors}</dd></div>
            </dl>
          </div>
        ))}
      </div>
    </JudgeSection>
  );
}

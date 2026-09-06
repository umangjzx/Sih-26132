"use client";

import { Icon } from "@/components/ui";
import { JudgeSection } from "./shared";

const GROUPS: { title: string; icon: string; cls: string; items: string[] }[] = [
  {
    title: "Implemented",
    icon: "checkCircle",
    cls: "border-[var(--green-600)]/30 bg-[var(--green-50)]",
    items: [
      "Price discovery, trend charts, and the sell/wait/hold signal — rule-based, tested",
      "Phone+password auth (PBKDF2, JWT access/refresh) — no OTP/SMS, no password-reset flow",
      "Full trade lifecycle: lots, demands, matching, offers, deals, logistics, payments, disputes",
      "FPO pools and forward contracts, including materialisation into the real deal pipeline",
      "Price-realisation tracking against mandi average and MSP",
      "Trilingual UI (en/hi/mr) with automated parity enforcement",
      "OCR mandi-slip assist and the Ask AgriLink grounded assistant",
      "Admin dashboard, analytics, and an append-only audit ledger",
    ],
  },
  {
    title: "Partially implemented",
    icon: "alert",
    cls: "border-[var(--amber-500)]/30 bg-[var(--amber-50)]",
    items: [
      "Arrival-volume data — investigated this session, not just left as a known gap: no data.gov.in resource (or other free/open Indian dataset) exposes real daily mandi arrival volumes, so the signal's volume factor genuinely can only run on synthetic fixture data (tracked internally as PRICE-07). This is a real data-availability limit, not a build gap.",
      "Diesel pricing — investigated this session: no free live diesel-price API for India was found. The curated per-state reference (with an as_of date) is the honest fallback rather than faking a live feed with a stale number.",
      "Weather enrichment — the free Open-Meteo/NASA POWER path always works; the OpenWeatherMap current-conditions overlay needs an optional key",
      "Forward-contract settlement — fixed this session from a bare gap to real visibility: an accepted commitment now gets a settlement_due date, and an overdue deal (still not delivered) triggers a debounced in-app notification to both farmer and buyer, plus an on_track/overdue/settled badge on the contract. This is not escrow or a financial penalty — the platform still never holds money or crop — it surfaces a stalled commitment instead of it silently going nowhere.",
    ],
  },
  {
    title: "Prototype-level",
    icon: "clock",
    cls: "border-blue-300 bg-blue-50",
    items: [
      "KYC/verification — investigated this session: no free/self-serve e-KYC API (DigiLocker, PM-Kisan, Aadhaar UIDAI) is usable without a paid production tie-up, so admin-manual document review remains the correct approach for this build rather than an unfinished automated flow",
      "Ask AgriLink's retrieval is keyword + fuzzy matching, not semantic search — a real gap (a pooling question missing the FPO doc entirely) was found and fixed this session with a curated synonym expansion, but a paraphrase with no shared vocabulary and no hand-curated synonym can still miss (see AI Systems)",
    ],
  },
  {
    title: "Planned / deferred",
    icon: "close",
    cls: "border-[var(--line)] bg-[var(--paper)]",
    items: [
      "Cordova Android wrap — not built; the frontend's all-client-component architecture is deliberately ready for it",
      "Satellite crop-health (Google Earth Engine) — deferred; credentials may exist in .env but are never read",
      "A full production-scale load test (k6/Locust against a deployed instance) — not run; what has run is a local concurrent benchmark that found and fixed one real bottleneck (see Performance)",
      "Forward-contract escrow/penalty enforcement — no payment is held in escrow and no financial penalty is charged if a settled-overdue commitment is never honoured; only the reminder above exists",
    ],
  },
];

export function LimitationsSection() {
  return (
    <JudgeSection
      id="limitations"
      eyebrow="Full disclosure"
      title="Limitations & transparency"
      quickAnswer="Nothing below is new to this page — it's the project's own README 'Known limitations' section, reorganized by implementation status. A credible project names its gaps before a judge finds them."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {GROUPS.map((g) => (
          <div key={g.title} className={`rounded-2xl border p-5 ${g.cls}`}>
            <h3 className="flex items-center gap-2 font-heading text-sm font-bold text-[var(--ink)]">
              <Icon name={g.icon} size={16} />
              {g.title}
            </h3>
            <ul className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-[var(--ink-soft)]">
              {g.items.map((it) => <li key={it}>• {it}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </JudgeSection>
  );
}

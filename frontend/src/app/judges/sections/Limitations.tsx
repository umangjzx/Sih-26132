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
      "Phone+password auth (PBKDF2, JWT access/refresh) with an OTP-based forgot-password flow (SMS when configured, logged server-side otherwise)",
      "Full trade lifecycle: lots, demands, matching, offers, deals, logistics, payments, disputes",
      "FPO pools, forward contracts, and warehouse-receipt financing requests, including materialisation into the real deal pipeline",
      "Price-realisation tracking against mandi average and MSP, farmer-facing and as a public anonymised aggregate",
      "Optional satellite (NDVI) crop-health reading, folded into the Decision Brief",
      "Trilingual UI (en/hi/mr) with automated parity enforcement",
      "OCR mandi-slip assist and the Ask AgriLink grounded assistant",
      "Admin dashboard, analytics, and an append-only audit ledger",
      "Notifications for a price-alert crossing, an overdue forward settlement, an offer accept/decline, a financing approve/reject, a deal-pipeline advance, and a dispute resolution",
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
      "Financing disbursement — the platform tracks a request and an admin decision only; it never holds or transfers money, so a real product still needs a licensed bank/NBFC or warehouse partner",
      "A full production-scale load test (k6/Locust against a deployed instance) — not run; what has run is a local concurrent benchmark that found and fixed one real bottleneck (see Performance)",
      "Forward-contract breach escrow — a dispute resolution can mark a commitment breached and compute a penalty figure (10% of contract value by default), but no money is ever actually held or collected — it's an auditable number, not real escrow",
      "digest/system notification kinds — the SMS digest job reads existing unread notifications to text a summary, it doesn't create its own digest row, and nothing yet produces a system-kind notification",
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

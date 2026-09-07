"use client";

import { ExpandableCard, JudgeSection } from "./shared";

const FAQS = [
  { q: "Why did you choose this problem?", a: "Price-blindness at the point of sale is one of the most direct, fixable causes of farmer under-income — the data (AGMARKNET) already exists and is free; the gap is turning it into a decision, not collecting it." },
  { q: "What makes your solution unique?", a: "It's the only tool in this comparison that carries a farmer from a raw price to a transport-adjusted decision to an actual verified buyer to a paid, audited deal — most alternatives stop at showing a price." },
  { q: "Is this fully implemented?", a: "17 of 19 planned modules are implemented and tested (see Core Modules) — including a v1.7 dispute-resolution feature that was found undocumented in our own README during this audit and is now corrected here. The Cordova Android wrap and satellite crop-health are explicitly not started, marked Planned/Deferred, not hidden." },
  { q: "What technologies did you use, and why?", a: "See Technology Stack — every entry has a real 'why' and the alternative we considered, not just a name." },
  { q: "What happens when the system scales?", a: "See Scalability — today is a deliberate single-VM setup; the app is stateless so the growth-stage changes are configuration (more workers, Redis, connection pooling), not a rewrite." },
  { q: "How do you validate your data?", a: "Pydantic schema validation at every request boundary, plus business-logic guards (unique phone, price-band ordering, one active commitment per farmer per bid) — see Validation for the full list with file citations." },
  { q: "How do you handle incorrect inputs?", a: "Rejected with a 422 and field-level detail before touching any business logic — never silently coerced or guessed." },
  { q: "How secure is the system?", a: "PBKDF2 (600k iterations) + JWT access/refresh separation + role- and record-level authorization + a 19-site rate limiter + zero raw SQL found in the codebase. No automated security scanner has been run yet — that gap is stated plainly in Security, not hidden." },
  { q: "What happens if an external API fails?", a: "Every one of the 11 integrations has a specific fallback — a cached snapshot, a static reference table, or simply omitting that one enrichment. The UI never shows a broken page because a weather or routing call failed." },
  { q: "What is your biggest technical challenge?", a: "Keeping 8+ independent external data sources offline-safe without the app ever looking broken when one is unreachable — and separately, enforcing 100% trilingual parity (~1,400 keys × 3 languages) automatically so a missing translation is a build failure, not a live bug." },
  { q: "What are the limitations?", a: "See Limitations & Transparency for the full, honest list — no daily arrival-volume data exists in the live feed, KYC verification is admin-manual, the crop calendar is Maharashtra-tuned, and more." },
  { q: "How is AI actually used?", a: "Two places, genuinely: a vision LLM reads mandi slips (OCR), and an optional LLM phrases already-computed numbers into plain language. The sell/wait signal and price forecast are deliberately rule-based/statistical, not ML — see AI Systems for why that's a deliberate choice, not a shortcut." },
  { q: "How accurate is the system?", a: "The rule-based signal and forecast are transparent formulas, not models with a trained accuracy score — their trustworthiness comes from showing every factor, not from a claimed percentage. OCR confidence is per-extraction, returned by the model; there's no aggregate accuracy benchmark against a labeled dataset yet — stated honestly rather than invented." },
  { q: "How will you sustain this financially?", a: "The core platform runs at zero marginal API cost (every essential data source is free and keyless) — see Business Viability for the proposed revenue model, clearly labeled as a plan, not a shipped feature." },
  { q: "What is your future roadmap?", a: "Cordova Android wrap (the frontend is already built for it — nearly every route is a pure client component); satellite crop-health via Google Earth Engine (credentials are scaffolded but unused); a production-scale load test (k6/Locust against a deployed instance, beyond the local benchmark already run) before any real deployment beyond a demo." },
  { q: "How is your solution better than competitors?", a: "See the Innovation comparison matrix — it's a feature-by-feature comparison against the category (government portals, price-alert apps, informal trader networks), not a named-competitor teardown." },
];

export function FaqSection() {
  return (
    <JudgeSection
      id="faq"
      eyebrow="The hard questions"
      title="Judge FAQ"
      quickAnswer="Every answer here points back to a specific section on this page or a specific file — nothing is a deflection."
    >
      <div className="flex flex-col gap-2">
        {FAQS.map((f) => (
          <ExpandableCard key={f.q} title={f.q}>
            <p className="text-sm leading-relaxed text-[var(--ink-soft)]">{f.a}</p>
          </ExpandableCard>
        ))}
      </div>
    </JudgeSection>
  );
}

"use client";

import { Icon } from "@/components/ui";
import { EvidenceBadge, JudgeSection } from "./shared";

export function BusinessImpactSection() {
  return (
    <JudgeSection
      id="business"
      eyebrow="Beyond the code"
      title="Business viability & impact"
      quickAnswer="AgriLink is a working product today, not yet an operating business — this section is explicit about which parts are real capability (target users, cost drivers) and which are a proposed plan (revenue, partnerships), not blended together as if both were equally certain."
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="al-card-plain p-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-[var(--green-700)]">
              Target users &amp; market
            </h3>
            <EvidenceBadge kind="verified" />
          </div>
          <ul className="flex flex-col gap-2 text-sm leading-relaxed text-[var(--ink-soft)]">
            <li>Smallholder farmers and FPOs — the location-awareness feature is built and
              tested for Maharashtra-first, all-India-capable operation (real: 31 routes,
              location resolver, national MSP/directory data).</li>
            <li>Buyers ranging from individual traders to processing companies — reflected in
              the real demo accounts (Anita Traders, Mega Foods Pvt, TN Agro Buyers, Chennai
              Exports Co, Salem Fresh Mart).</li>
            <li>Government/MSInS as the problem-statement sponsor — this is SIH PS-26132.</li>
          </ul>
        </div>

        <div className="al-card-plain p-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-[var(--green-700)]">
              Cost structure (real, from the built architecture)
            </h3>
            <EvidenceBadge kind="verified" />
          </div>
          <ul className="flex flex-col gap-2 text-sm leading-relaxed text-[var(--ink-soft)]">
            <li>Every core data source (AGMARKNET, Open-Meteo, NASA POWER, OSRM, Nager.Date,
              Nominatim) is free and keyless — zero marginal cost per user for price/weather/
              routing/holiday data.</li>
            <li>The two paid dependencies are both optional and degrade gracefully:
              OpenWeatherMap (current-conditions overlay) and OpenRouter (LLM features) — the
              platform is fully functional at zero API cost, with these as enrichment.</li>
            <li>Infrastructure: one VM (Docker Compose + Caddy) is the whole production
              footprint today — a deliberately low fixed cost to operate.</li>
          </ul>
        </div>

        <div className="al-card-plain p-6 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-[var(--amber-700)]">
              Revenue model, partnerships & growth strategy — proposed, not yet operational
            </h3>
            <EvidenceBadge kind="assessed" note="Business plan, not a shipped feature" />
          </div>
          <div className="grid gap-4 text-sm leading-relaxed text-[var(--ink-soft)] sm:grid-cols-3">
            <div>
              <p className="font-semibold text-[var(--ink)]">Revenue (proposed)</p>
              <p className="mt-1">A small success-fee on closed deals above a free tier, and/or a
                paid verification tier for buyers who want priority discovery placement. No
                billing or payment-collection code exists yet — deal payments are recorded by
                reference, not processed by the platform.</p>
            </div>
            <div>
              <p className="font-semibold text-[var(--ink)]">Partnerships (proposed)</p>
              <p className="mt-1">FPOs and krishi vigyan kendras as distribution partners; state
                agriculture departments for the MSInS problem-statement relationship. None of
                these are contracted — this is a go-to-market hypothesis, stated as one.</p>
            </div>
            <div>
              <p className="font-semibold text-[var(--ink)]">Sustainability</p>
              <p className="mt-1">The zero-cost core data sources mean the platform can run for
                free indefinitely even if the revenue model above is never activated — a
                meaningful real property, not just a plan.</p>
            </div>
          </div>
        </div>
      </div>

      <h3 id="impact" className="mt-10 scroll-mt-32 font-heading text-base font-bold text-[var(--ink)]">
        Impact &amp; SDG alignment
      </h3>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">
        Only SDGs with a direct, feature-level connection are listed — nothing added purely
        for the slide.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {[
          { sdg: "SDG 1 — No Poverty", link: "Price transparency + net-of-transport best-market ranking directly targets under-selling, the mechanism by which price-blind farmers lose income." },
          { sdg: "SDG 2 — Zero Hunger", link: "Better price/MSP visibility and forward contracts reduce the incentive for distress post-harvest sales, a documented driver of on-farm loss." },
          { sdg: "SDG 8 — Decent Work & Economic Growth", link: "Direct, verified buyer linkage and a tracked deal pipeline reduce the margin captured by unaccountable intermediaries." },
          { sdg: "SDG 10 — Reduced Inequalities", link: "The same market intelligence a large institutional buyer has is given to a smallholder, in their own language, for free." },
        ].map((s) => (
          <div key={s.sdg} className="al-card-plain flex items-start gap-3 p-4">
            <Icon name="leaf" size={16} className="mt-0.5 shrink-0 text-[var(--green-600)]" />
            <div>
              <p className="text-sm font-bold text-[var(--ink)]">{s.sdg}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--ink-soft)]">{s.link}</p>
            </div>
          </div>
        ))}
      </div>
    </JudgeSection>
  );
}

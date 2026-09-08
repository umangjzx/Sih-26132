"use client";

/**
 * /judges — Project Evidence, Validation & Technical Documentation Hub.
 *
 * Every number on this page traces to a fact verified directly against the
 * codebase, most recently re-checked in full on 2026-09-07 (see the audit
 * citations inline). Where no hard
 * evidence exists, the page says so explicitly — see EvidenceBadge — rather
 * than inventing a metric. This page is judge-facing, not farmer/buyer-facing,
 * so it intentionally does not carry the trilingual (en/hi/mr) requirement
 * the rest of the product does.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui";
import { JudgeSection, MetricCard } from "./sections/shared";
import { ArchitectureSection } from "./sections/Architecture";
import { DataFlowSection } from "./sections/DataFlow";
import { DatabaseSection } from "./sections/Database";
import { TechStackSection } from "./sections/TechStack";
import { ModulesSection } from "./sections/Modules";
import { AiSystemsSection } from "./sections/AiSystems";
import { ValidationSection } from "./sections/Validation";
import { SecuritySection } from "./sections/Security";
import { ScalabilitySection } from "./sections/Scalability";
import { PerformanceSection } from "./sections/Performance";
import { BusinessImpactSection } from "./sections/BusinessImpact";
import { DemoSection } from "./sections/Demo";
import { DocumentationSection } from "./sections/Documentation";
import { FaqSection } from "./sections/Faq";
import { LimitationsSection } from "./sections/Limitations";
import { ReadinessSection } from "./sections/Readiness";

/* ── Reveal (same intersection-fade pattern used across the marketing site) */

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
        transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

/* ── Quick nav ───────────────────────────────────────────────────────────── */

const NAV = [
  { id: "overview", label: "Overview" },
  { id: "problem-solution", label: "Problem & Solution" },
  { id: "innovation", label: "Innovation" },
  { id: "architecture", label: "Architecture" },
  { id: "tech-stack", label: "Tech Stack" },
  { id: "data-flow", label: "Data Flow" },
  { id: "database", label: "Database" },
  { id: "modules", label: "Core Modules" },
  { id: "ai-systems", label: "AI Systems" },
  { id: "validation", label: "Validation & Testing" },
  { id: "security", label: "Security" },
  { id: "scalability", label: "Scalability" },
  { id: "performance", label: "Performance" },
  { id: "business", label: "Business & Impact" },
  { id: "demo", label: "Demo Evidence" },
  { id: "documentation", label: "Documentation" },
  { id: "faq", label: "Judge FAQ" },
  { id: "limitations", label: "Limitations" },
  { id: "readiness", label: "Readiness & Summary" },
];

function QuickNav() {
  const [active, setActive] = useState(NAV[0].id);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    NAV.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActive(id); },
        { rootMargin: "-30% 0px -60% 0px", threshold: 0 },
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  return (
    <nav
      aria-label="Judge quick navigation"
      className="sticky top-[4.25rem] z-40 border-b border-[var(--line)] bg-[var(--surface)]/95 backdrop-blur-md"
    >
      <div className="custom-scrollbar mx-auto flex w-full max-w-screen-xl gap-1 overflow-x-auto px-4 py-2.5 sm:px-6 lg:px-8">
        {NAV.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
              active === item.id
                ? "bg-[var(--green-700)] text-white"
                : "text-[var(--ink-soft)] hover:bg-[var(--paper)] hover:text-[var(--ink)]"
            }`}
          >
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

/* ── Hero ────────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section
      id="overview"
      className="relative -mx-4 -mt-[5.75rem] overflow-hidden pt-[5.75rem] text-white sm:-mx-6 lg:-mx-8"
      style={{ background: "linear-gradient(160deg, #071a0f 0%, #0e3421 45%, #1a4a2e 100%)" }}
    >
      <div className="al-grid-overlay pointer-events-none absolute inset-0" />
      <div className="relative z-10 mx-auto w-full max-w-screen-xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/30 px-3.5 py-1.5 text-xs font-bold uppercase tracking-widest text-white/80 backdrop-blur-sm">
          <Icon name="shield" size={13} className="text-[var(--amber-400)]" />
          Project Evidence &amp; Validation Hub — for SIH 2026 judges
        </span>

        <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h1 className="font-heading text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-4xl lg:text-5xl">
              AgriLink — <span className="text-[var(--amber-400)]">everything on this page is verifiable</span>
            </h1>
            <p className="mt-4 text-[1.05rem] leading-relaxed text-white/70">
              A market-linkage and price-discovery platform connecting Maharashtra&apos;s
              (India-wide-aware) farmers directly to verified buyers, built on live
              government mandi data. This page traces every claim below — architecture,
              database, security, test results — to the actual, running codebase, so a
              judge can verify without asking for another document.
            </p>
            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-white/70 sm:grid-cols-4">
              <div><dt className="text-white/45">Team</dt><dd className="font-semibold text-white">AgriLink</dd></div>
              <div><dt className="text-white/45">Problem Statement</dt><dd className="font-semibold text-white">SIH 2026 · PS-26132</dd></div>
              <div><dt className="text-white/45">Sponsor</dt><dd className="font-semibold text-white">Govt. of Maharashtra / MSInS</dd></div>
              <div><dt className="text-white/45">Solution, in one line</dt><dd className="font-semibold text-white">Explainable sell/wait signals + a verified buyer marketplace</dd></div>
            </dl>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <a href="#demo" className="al-btn-primary px-6 py-3 text-sm">
              <Icon name="chart" size={16} /> Jump to live demo
            </a>
            <a href="#faq" className="al-btn-ghost px-6 py-3 text-sm">
              <Icon name="fileText" size={16} /> Jump to judge FAQ
            </a>
          </div>
        </div>

        <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <MetricCard value="111" label="Live API endpoints, across 19 routers" evidence="verified" />
          <MetricCard value="20" label="Database tables, 26 linear migrations" evidence="verified" />
          <MetricCard value="33" label="Backend services (one file, one job each)" evidence="verified" />
          <MetricCard value="548 / 548" label="Automated tests passing (497 backend + 51 frontend)" evidence="verified" />
          <MetricCard value="11" label="Real external data sources, every one with an offline fallback" evidence="verified" />
          <MetricCard value="3" label="Languages at 100% parity — en / hi / mr, ~1,400 keys each" evidence="verified" />
        </div>
      </div>
    </section>
  );
}

/* ── Why this matters ───────────────────────────────────────────────────── */

function WhyItMatters() {
  return (
    <JudgeSection
      id="why-it-matters"
      eyebrow="Context"
      title="Why this project matters"
      quickAnswer="Farmers lose money to information asymmetry, not lack of effort — AgriLink turns public government price data into a decision they can act on today, in their own language."
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="al-card-plain p-6">
          <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-[var(--red-700)]">
            The real-world problem
          </h3>
          <ul className="mt-3 flex flex-col gap-2.5 text-sm leading-relaxed text-[var(--ink-soft)]">
            <li>Smallholder farmers often sell at the first price offered — they have no
              real-time view of nearby mandi prices, so a 15-20% better price a short
              drive away goes unnoticed.</li>
            <li>Government mandi data (AGMARKNET) is public but raw and tabular — it
              doesn&apos;t say &quot;sell now&quot; or &quot;wait,&quot; and it isn&apos;t in Hindi or Marathi.</li>
            <li>Intermediaries capture a disproportionate margin because they hold the
              market intelligence the farmer doesn&apos;t.</li>
            <li>Below-MSP sales and post-harvest losses follow directly from this
              information gap — a policy problem the government itself tracks.</li>
          </ul>
        </div>
        <div className="al-card-plain p-6">
          <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-[var(--green-700)]">
            Why existing options fall short
          </h3>
          <ul className="mt-3 flex flex-col gap-2.5 text-sm leading-relaxed text-[var(--ink-soft)]">
            <li><strong className="text-[var(--ink)]">AGMARKNET / eNAM portals</strong> — publish
              raw price tables, no recommendation, no buyer connection, English-only.</li>
            <li><strong className="text-[var(--ink)]">Private mandi-price apps</strong> — show a
              price but rarely net it against transport cost, and stop at information —
              there&apos;s no path to an actual verified buyer or a tracked deal.</li>
            <li><strong className="text-[var(--ink)]">Word-of-mouth / local traders</strong> — fast
              and trusted, but opaque, non-transparent pricing, and no audit trail if
              something goes wrong.</li>
            <li><strong className="text-[var(--ink)]">AgriLink&apos;s approach</strong> — fuses price,
              weather, MSP, transport cost and buyer demand into one explainable action,
              then carries the farmer through to a paid, audited deal — in their language.</li>
          </ul>
        </div>
      </div>
    </JudgeSection>
  );
}

/* ── Problem → Solution → Impact ────────────────────────────────────────── */

const PROBLEM_ROWS = [
  {
    problem: "No real-time price visibility",
    current: "Farmer sells to the first buyer at whatever price is quoted",
    solution: "Live AGMARKNET modal/min/max + 7/30/90-day trend, per crop and market",
    impact: "Price transparency at the point of decision — verified via /prices, /api/prices/trend",
  },
  {
    problem: "\"Sell now or wait?\" is a guess",
    current: "Decision made on instinct or a trader's suggestion",
    solution: "Rule-based sell/wait/hold signal — every factor and weight shown on screen",
    impact: "An explainable, reproducible answer instead of a guess — /api/prices/signal, service/signal.py",
  },
  {
    problem: "Highest price isn't the best net price",
    current: "Farmer picks the market with the highest listed price, ignoring transport cost",
    solution: "Diesel-indexed freight model nets every candidate market against real transport cost",
    impact: "Best-market ranking by what actually lands in the farmer's pocket — /api/markets/best",
  },
  {
    problem: "No direct line to a verified buyer",
    current: "Sale routed through one or more unverified intermediaries",
    solution: "Scored lot×demand matching, an offer thread with price references, admin-verified badges",
    impact: "Farmer negotiates directly with a scored, verified buyer — /api/matches, matching.py",
  },
  {
    problem: "No record of what was agreed or paid",
    current: "Verbal agreement, no receipt, no recourse in a dispute",
    solution: "A tracked deal pipeline, instalment payments, an append-only audit ledger, a printable receipt",
    impact: "Every deal is auditable end to end — transaction_events table, /api/deals/{id}/events",
  },
  {
    problem: "Small farmers have no bargaining power alone",
    current: "Individually, volume is too small to interest a large buyer",
    solution: "FPO-style pools aggregate produce into one virtual lot; forward contracts lock a pre-harvest price",
    impact: "Collective volume and price certainty before harvest — /pools, /forward routes",
  },
];

function ProblemSolutionImpact() {
  return (
    <JudgeSection
      id="problem-solution"
      eyebrow="The case for AgriLink"
      title="Problem → Solution → Impact"
      quickAnswer="Six concrete farmer pain points, each mapped to a shipped feature and the route/file that implements it — not a roadmap slide."
    >
      <div className="al-card-plain overflow-x-auto !bg-[var(--surface)]">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] bg-[var(--paper)] text-left text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)]">
              <th className="px-4 py-3">Problem</th>
              <th className="px-4 py-3">Current situation</th>
              <th className="px-4 py-3">AgriLink solution</th>
              <th className="px-4 py-3">Verifiable impact</th>
            </tr>
          </thead>
          <tbody>
            {PROBLEM_ROWS.map((r, i) => (
              <tr key={r.problem} className={i % 2 ? "bg-[var(--paper)]/50" : ""}>
                <td className="px-4 py-3.5 align-top font-bold text-[var(--ink)]">{r.problem}</td>
                <td className="px-4 py-3.5 align-top text-[var(--ink-soft)]">{r.current}</td>
                <td className="px-4 py-3.5 align-top text-[var(--ink)]">{r.solution}</td>
                <td className="px-4 py-3.5 align-top text-[var(--green-700)]">{r.impact}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </JudgeSection>
  );
}

/* ── Innovation & Uniqueness ─────────────────────────────────────────────── */

const COMPARISON_ROWS = [
  { feature: "Price data", existing: "Raw tables (AGMARKNET/eNAM), English only", ours: "Trilingual, trend-charted, forecast-band overlaid" },
  { feature: "Sell/wait guidance", existing: "None — price only", ours: "Explainable rule-based signal, every factor shown" },
  { feature: "Best market ranking", existing: "By listed price only", ours: "Net of diesel-indexed transport cost" },
  { feature: "Buyer connection", existing: "None, or informal broker network", ours: "Scored matches, verified badges, an offer thread" },
  { feature: "Deal record-keeping", existing: "Verbal / notebook", ours: "Tracked pipeline, instalment payments, append-only ledger, receipt" },
  { feature: "Collective bargaining", existing: "Informal, ad hoc", ours: "Structured FPO pools with quantity-weighted pricing" },
  { feature: "Pre-harvest certainty", existing: "Not available to smallholders", ours: "Forward contracts with a crop-calendar sanity check" },
  { feature: "Works with no internet", existing: "Fails or shows nothing", ours: "Every external call degrades to a neutral result or cached snapshot" },
];

function Innovation() {
  return (
    <JudgeSection
      id="innovation"
      eyebrow="Differentiation"
      title="What makes this different from existing solutions"
      quickAnswer="Every government price portal stops at showing a number. AgriLink is the only one in this comparison that turns that number into a transport-adjusted decision and then carries the farmer through to a paid, audited deal."
    >
      <div className="al-card-plain overflow-x-auto !bg-[var(--surface)]">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] bg-[var(--paper)] text-left text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)]">
              <th className="px-4 py-3">Capability</th>
              <th className="px-4 py-3">Existing government / private tools</th>
              <th className="px-4 py-3">AgriLink</th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map((r, i) => (
              <tr key={r.feature} className={i % 2 ? "bg-[var(--paper)]/50" : ""}>
                <td className="px-4 py-3.5 align-top font-bold text-[var(--ink)]">{r.feature}</td>
                <td className="px-4 py-3.5 align-top text-[var(--ink-soft)]">{r.existing}</td>
                <td className="px-4 py-3.5 align-top text-[var(--green-700)]">
                  <span className="inline-flex items-start gap-1.5">
                    <Icon name="check" size={14} className="mt-0.5 shrink-0" />
                    {r.ours}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-[var(--ink-mute)]">
        This is a feature-by-feature comparison against the category of tools (public
        price portals, private price-alert apps, informal trader networks), not a named
        competitor audit — no specific competitor&apos;s internals were inspected to write it.
      </p>
    </JudgeSection>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function JudgesPageClient() {
  return (
    <div className="-mx-4 flex flex-col sm:-mx-6 lg:-mx-8">
      <Hero />
      <QuickNav />

      <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <Reveal><WhyItMatters /></Reveal>
      </div>
      <Reveal><ProblemSolutionImpact /></Reveal>
      <Reveal><Innovation /></Reveal>
      <ArchitectureSection />
      <TechStackSection />
      <DataFlowSection />
      <DatabaseSection />
      <ModulesSection />
      <AiSystemsSection />
      <ValidationSection />
      <SecuritySection />
      <ScalabilitySection />
      <PerformanceSection />
      <BusinessImpactSection />
      <DemoSection />
      <DocumentationSection />
      <FaqSection />
      <LimitationsSection />
      <ReadinessSection />

      <section className="border-t border-[var(--line)] bg-[var(--paper)] py-10 text-center">
        <p className="text-xs text-[var(--ink-soft)]">
          Every figure on this page was verified against the codebase, most recently on 2026-09-07.
          Source: {" "}
          <Link href="https://github.com/umangjzx/Sih-26132" className="font-semibold text-[var(--green-700)] hover:underline">
            github.com/umangjzx/Sih-26132
          </Link>
        </p>
      </section>
    </div>
  );
}

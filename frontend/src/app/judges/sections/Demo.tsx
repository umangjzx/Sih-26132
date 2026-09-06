"use client";

import Link from "next/link";
import { Icon } from "@/components/ui";
import { JudgeSection } from "./shared";

const STEPS = [
  {
    n: 1,
    title: "Check a crop's price and signal",
    problem: "A farmer wants to know if today is a good day to sell onions",
    action: "Open / → pick a crop and market, or go straight to /prices",
    result: "Live modal/min/max, a 7/30/90-day trend with a dashed forecast band, and the sell/wait/hold call with every reason listed",
  },
  {
    n: 2,
    title: "Open the Decision Brief",
    problem: "The farmer wants one ranked answer, not eight separate numbers",
    action: "Go to /advisor",
    result: "A ranked action list (now/soon/watch) fusing signal + forecast + best market + MSP + weather + calendar + holidays + nearby verified buyers",
  },
  {
    n: 3,
    title: "Sign in as a demo farmer, list a lot",
    problem: "The farmer is ready to sell and wants to reach a real buyer",
    action: "/login → tap a seeded farmer account (no typing) → /farmer → \"Scan slip\" or fill the form",
    result: "A new Lot is created; matching runs immediately against every open demand for that crop",
  },
  {
    n: 4,
    title: "Sign in as a demo buyer, negotiate",
    problem: "A buyer has a matching demand and wants to negotiate a fair price",
    action: "/login → tap a seeded buyer account → /matches → open the new match → \"Counter\" with the price-reference strip",
    result: "An offer thread with mandi-modal/MSP-referenced counters; accepting creates a Deal",
  },
  {
    n: 5,
    title: "Track the deal to payment and receipt",
    problem: "Both sides need proof of what was agreed and paid",
    action: "/deals/[id] → arrange logistics → record a payment → open the printable receipt",
    result: "A fully tracked deal: logistics plan, instalment payments, an append-only event timeline, and a receipt — all in under 5 minutes end to end",
  },
];

export function DemoSection() {
  return (
    <JudgeSection
      id="demo"
      eyebrow="See it run"
      title="Live demo center"
      quickAnswer="A 5-minute script covering price → decision → listing → negotiation → paid deal, using the platform's own seeded demo accounts — no manual account creation needed."
    >
      <div className="al-card-plain mb-6 flex items-start gap-2.5 p-4">
        <Icon name="users" size={16} className="mt-0.5 shrink-0 text-[var(--green-600)]" />
        <p className="text-sm leading-relaxed text-[var(--ink-soft)]">
          <span className="font-bold text-[var(--ink)]">11 seeded demo accounts</span> are
          available directly on the <Link href="/login" className="font-semibold text-[var(--green-700)] hover:underline">/login</Link> page
          — farmers, buyers, and one admin, across Maharashtra and Tamil Nadu — under a
          &quot;Demo accounts&quot; disclosure. Tap any account to sign in instantly; no typing required.
        </p>
      </div>

      <ol className="flex flex-col gap-4">
        {STEPS.map((s) => (
          <li key={s.n} className="al-card-plain flex gap-4 p-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--green-700)] font-heading text-sm font-extrabold text-white">
              {s.n}
            </span>
            <div className="min-w-0">
              <h3 className="font-heading text-sm font-bold text-[var(--ink)]">{s.title}</h3>
              <dl className="mt-2 grid gap-1.5 text-xs sm:grid-cols-3">
                <div><dt className="font-bold uppercase tracking-wide text-[var(--ink-mute)]">Problem</dt><dd className="text-[var(--ink-soft)]">{s.problem}</dd></div>
                <div><dt className="font-bold uppercase tracking-wide text-[var(--ink-mute)]">User action</dt><dd className="text-[var(--ink-soft)]">{s.action}</dd></div>
                <div><dt className="font-bold uppercase tracking-wide text-[var(--ink-mute)]">Result</dt><dd className="text-[var(--ink-soft)]">{s.result}</dd></div>
              </dl>
            </div>
          </li>
        ))}
      </ol>

      <h3 className="mt-10 font-heading text-base font-bold text-[var(--ink)]">If the live system is unreachable</h3>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">
        This entire page is the backup evidence — the Architecture, Data Flow, and Database
        sections above are diagrams and file citations, not live screenshots that can go
        stale or fail to load; the Validation section shows real, reproducible test output;
        and the source is public at{" "}
        <Link href="https://github.com/umangjzx/Sih-26132" className="font-semibold text-[var(--green-700)] hover:underline">
          github.com/umangjzx/Sih-26132
        </Link>.
      </p>
    </JudgeSection>
  );
}

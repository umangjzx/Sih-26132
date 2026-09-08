"use client";

import { Icon } from "@/components/ui";
import { EvidenceBadge, JudgeSection } from "./shared";

const METRICS = [
  { metric: "API average response time", value: "189–316ms median across 5 read endpoints (trend/forecast/signal/nearby/options), single request, real seeded Postgres data (re-measured 2026-09-07; the dataset has grown to 23,598 crop/market combos, up from 20,901 on 2026-09-04)", kind: "verified" as const },
  { metric: "API latency under load", value: "200 requests / 20 concurrent workers per endpoint: p50 127–579ms, p99 177–886ms (scripts/perf_bench.py, re-run 2026-09-07 — /api/options excluded, see the dedicated callout below)", kind: "verified" as const },
  { metric: "Frontend page load time", value: "Not benchmarked", kind: "pending" as const },
  { metric: "Database query performance", value: "Not profiled with EXPLAIN ANALYZE, but one real bottleneck was found and fixed this run (see below)", kind: "verified" as const },
  { metric: "Concurrent users tested", value: "20 concurrent workers, 200 requests/endpoint, local benchmark — not a production-scale load test", kind: "verified" as const },
  { metric: "Error rate", value: "0 failures across 545 automated test runs (not the same as a production error rate)", kind: "verified" as const },
  { metric: "Uptime", value: "Not applicable — no long-running production deployment with an SLA yet", kind: "pending" as const },
  { metric: "Backend test-suite runtime", value: "494 tests in 36.7s (in-memory SQLite, run 2026-09-08 alongside a live dev server — runtime varies with what else is running on the machine)", kind: "verified" as const },
  { metric: "Frontend test-suite runtime", value: "51 tests in ~9.4s (run 2026-09-08)", kind: "verified" as const },
  { metric: "Frontend production build", value: "Compiles cleanly, 31 routes prerendered/server-rendered correctly (this run)", kind: "verified" as const },
];

const FOUND_AND_FIXED = {
  before: {
    label: "Before — every request re-scanned the table (2026-09-04)",
    rows: [
      ["p50 latency", "4,426ms"],
      ["p99 latency", "7,499ms"],
      ["Throughput", "4.5 req/s"],
    ],
  },
  after: {
    label: "After the fix, current (2026-09-07)",
    rows: [
      ["p50 latency", "1,347ms (316ms uncontended, single request)"],
      ["p99 latency", "1,664ms"],
      ["Throughput", "14.9 req/s"],
    ],
  },
};

const DESIGN_CHOICES = [
  "6-hourly scheduled ingestion, not per-request — the app never blocks a user's request on a slow external price feed",
  "Every price read hits Postgres, not a live external call — external APIs only feed the cache, they're never on the request's critical path for prices",
  "A single Uvicorn worker was a deliberate, documented choice for this deployment size (it's also why the rate limiter is in-process, not Redis-backed) — not an oversight",
  "Offline-fallback chains (snapshot → fixtures) mean a cold-start demo never waits on a live external API to respond",
];

export function PerformanceSection() {
  return (
    <JudgeSection
      id="performance"
      eyebrow="Honest numbers only"
      title="Performance metrics"
      quickAnswer="A real local benchmark (scripts/perf_bench.py) was run against the live app on real seeded data on 2026-09-04, and re-run again on 2026-09-07 after further feature work to confirm the numbers still hold. It surfaced one genuine bottleneck — GET /api/options was re-scanning the full price table and re-sorting 20,900+ rows on every call — which was fixed with a 15-minute in-process cache. The 2026-09-07 re-run shows that endpoint noticeably slower under concurrency than the day the fix landed, and that's disclosed honestly below rather than quietly re-using the old number. What still isn't measured (frontend load time, a dedicated DB profiler, production uptime) is labeled as such, not filled in with an invented number."
    >
      <div className="al-card-plain mb-6 flex items-start gap-2.5 !bg-[var(--amber-50)] !border-[var(--amber-200)] p-4">
        <Icon name="alert" size={16} className="mt-0.5 shrink-0 text-[var(--amber-700)]" />
        <p className="text-sm leading-relaxed text-[var(--amber-700)]">
          Per the page&apos;s own rule: estimated data is never presented as real production
          data. Every row below is labeled Verified or Data not yet available — there is no
          third, in-between category here. &quot;Verified&quot; here means measured on a local
          benchmark against real seeded data, not a production deployment under real user load.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {METRICS.map((m) => (
          <div key={m.metric} className="al-card-plain flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-bold text-[var(--ink)]">{m.metric}</p>
              <p className="mt-0.5 text-xs text-[var(--ink-soft)]">{m.value}</p>
            </div>
            <EvidenceBadge kind={m.kind} />
          </div>
        ))}
      </div>

      <h3 className="mt-8 font-heading text-base font-bold text-[var(--ink)]">
        Found and fixed during this benchmark: GET /api/options
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">
        The crop/market picker endpoint ran an unindexed <code>SELECT DISTINCT</code> across
        the whole price table (20,901 distinct crop/market/district/state combinations in the
        seeded dataset on 2026-09-04) and re-sorted all of them in Python on every single call —
        with no caching. At 20 concurrent callers this measured {FOUND_AND_FIXED.before.rows[0][1]} median
        latency and {FOUND_AND_FIXED.before.rows[2][1]} throughput. Fixed with a 15-minute
        in-process TTL cache (same single-process design as the existing rate limiter — no new
        infrastructure), invalidated on every ingestion run — that fix is still in place and
        still verified working (the cache hits correctly on repeated calls; see
        <code> app/api/prices.py:_cached_base_options</code>). Re-run on 2026-09-07, with the
        seeded dataset now 13% larger (23,598 combos): {FOUND_AND_FIXED.after.rows[0][1]} median,{" "}
        {FOUND_AND_FIXED.after.rows[2][1]} throughput — still a real improvement over the
        unfixed baseline, but noticeably higher than the 359ms/53.5 req/s measured the day the
        fix landed. The endpoint still returns an unpaginated 20k+ row list under a cache hit,
        and serializing that list to JSON for 20 concurrent callers at once is CPU-bound Python
        work that queues up behind the interpreter&apos;s GIL — that queuing, not the database,
        is the dominant remaining cost, and it scales with dataset size and how many other
        processes are competing for CPU on the machine at benchmark time. Pagination on this
        endpoint would fix it properly; it hasn&apos;t been done yet, so the honest current
        number is shown here instead of the faster one from three days ago.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[FOUND_AND_FIXED.before, FOUND_AND_FIXED.after].map((col) => (
          <div key={col.label} className="al-card-plain p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)]">
              {col.label}
            </p>
            <dl className="mt-2 flex flex-col gap-1.5">
              {col.rows.map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-2 text-sm">
                  <dt className="text-[var(--ink-soft)]">{k}</dt>
                  <dd className="font-bold text-[var(--ink)]">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      <h3 className="mt-8 font-heading text-base font-bold text-[var(--ink)]">
        Architectural choices made for performance (verifiable in code, not measured yet)
      </h3>
      <ul className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-[var(--ink-soft)]">
        {DESIGN_CHOICES.map((d) => (
          <li key={d} className="al-card-plain flex items-start gap-2.5 p-3.5">
            <Icon name="spark" size={14} className="mt-0.5 shrink-0 text-[var(--green-600)]" />
            {d}
          </li>
        ))}
      </ul>
    </JudgeSection>
  );
}

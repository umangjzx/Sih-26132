"use client";

import { Mermaid } from "@/components/Mermaid";
import { JudgeSection } from "./shared";

const CHART = `flowchart TB
    subgraph S1["Today — single VM (implemented)"]
      direction LR
      A1["Caddy\\n(reverse proxy, HTTPS)"] --> A2["Next.js\\n(1 instance)"]
      A1 --> A3["FastAPI\\n(1 Uvicorn worker)"]
      A3 --> A4[("Postgres 16\\n(1 instance)")]
      A3 --> A5["APScheduler\\n(in-process)"]
    end
    subgraph S2["Growth stage — ready for implementation"]
      direction LR
      B1["Caddy / load balancer"] --> B2["Next.js ×N"]
      B1 --> B3["FastAPI ×N Uvicorn workers"]
      B3 --> B4[("Postgres — connection pool")]
      B3 --> B5["Redis\\n(shared rate-limit state)"]
    end
    subgraph S3["Large scale — future recommendation"]
      direction LR
      C1["CDN"] --> C2["Next.js (static/CDN-served)"]
      C3["API gateway / load balancer"] --> C4["FastAPI — horizontally scaled"]
      C4 --> C5[("Postgres — primary + read replicas")]
      C4 --> C6["Queue (ingestion, alerts)\\ndecoupled from request path"]
    end
    S1 -.->|"more traffic"| S2 -.->|"national scale"| S3
`;

const ROWS: { title: string; status: "done" | "ready" | "future"; items: string[] }[] = [
  {
    title: "Currently implemented",
    status: "done",
    items: [
      "Stateless FastAPI app — no in-memory session state tied to a specific worker (JWT carries identity)",
      "Docker Compose brings up db + backend + frontend + Caddy on one VM with one command",
      "Every external call has a fallback, so a slow/dead provider degrades a feature instead of the whole request",
      "Committed snapshot + synthetic fixtures mean the app never depends on a single point of failure to run at all",
    ],
  },
  {
    title: "Ready for implementation (architecturally compatible, not yet done)",
    status: "ready",
    items: [
      "Running multiple Uvicorn workers behind Caddy — the app has no per-worker state that would break this",
      "Swapping the in-process rate limiter for a Redis-backed one — the interface (check/record) is already isolated in core/ratelimit.py",
      "A managed/replicated Postgres — the schema and migrations don't assume a specific host",
      "Serving the Next.js build from a CDN in front of the standalone output",
    ],
  },
  {
    title: "Future recommendation (not started, no code exists for this yet)",
    status: "future",
    items: [
      "A queue (e.g. SQS/RabbitMQ) decoupling the 6-hourly ingestion and alert evaluation from the request-serving process",
      "Read replicas for Postgres once analytics/read traffic meaningfully exceeds write traffic",
      "A microservices split of the intelligence layer (signal/forecast/brief) if it needs to scale independently of the trade/deal layer",
      "A proper API gateway for auth, rate limiting and routing instead of Caddy's current reverse-proxy role",
    ],
  },
];

const STATUS_STYLE = {
  done: "border-[var(--green-600)]/30 bg-[var(--green-50)]",
  ready: "border-[var(--amber-500)]/30 bg-[var(--amber-50)]",
  future: "border-[var(--line)] bg-[var(--paper)]",
};

export function ScalabilitySection() {
  return (
    <JudgeSection
      id="scalability"
      eyebrow="Can this scale?"
      title="Scalability & future architecture"
      quickAnswer="Today it's one VM by deliberate choice for a hackathon deployment — but the app is stateless and container-based, so the growth-stage changes below are configuration, not a rewrite."
    >
      <div className="al-card-plain p-4 sm:p-6">
        <Mermaid chart={CHART} />
      </div>
      <div className="mt-8 flex flex-col gap-4">
        {ROWS.map((r) => (
          <div key={r.title} className={`rounded-2xl border p-5 ${STATUS_STYLE[r.status]}`}>
            <h3 className="font-heading text-sm font-bold text-[var(--ink)]">{r.title}</h3>
            <ul className="mt-2.5 flex flex-col gap-1.5 text-sm leading-relaxed text-[var(--ink-soft)]">
              {r.items.map((it) => <li key={it}>• {it}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </JudgeSection>
  );
}

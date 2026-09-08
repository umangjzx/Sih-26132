"use client";

import { Icon } from "@/components/ui";
import { IntegrationStatus, JudgeSection, JudgeTable } from "./shared";

type Tech = { name: string; version: string; why: string; alt: string };

const STACK: { category: string; icon: string; items: Tech[] }[] = [
  {
    category: "Frontend",
    icon: "chart",
    items: [
      { name: "Next.js", version: "16.3.3 (App Router, Turbopack)", why: "One framework for routing, bundling and dev server; Turbopack keeps iteration fast on a large route tree (31 routes)", alt: "Vite + React Router — more moving parts to wire up ourselves" },
      { name: "React", version: "19.2.8", why: "Concurrent rendering + the ecosystem every other frontend choice here builds on", alt: "—" },
      { name: "TypeScript", version: "^5", why: "Caught real bugs during this build — e.g. the i18n key types make a missing translation a compile error, not a runtime one", alt: "—" },
      { name: "Tailwind CSS", version: "v4", why: "Design tokens (colors/shadows/radii) as CSS custom properties, enforced by convention — no raw hex anywhere in the codebase", alt: "CSS Modules — more boilerplate per component" },
      { name: "next-intl", version: "^4.14.1", why: "Client-only locale switching (no `/[locale]` routing) keeps the app compatible with a future static Cordova export", alt: "i18next — heavier, built around SSR routing this app deliberately avoids" },
      { name: "recharts", version: "^3.10.1", why: "Declarative charts for price trends and market comparisons without hand-rolled SVG", alt: "D3 directly — more control, far more code" },
      { name: "Vitest + Testing Library", version: "^4.1.11 / ^16.3.3", why: "Fast, Vite-native test runner; Testing Library keeps tests behavior-focused (queries by role/label, not implementation detail)", alt: "Jest — slower cold start with this toolchain" },
    ],
  },
  {
    category: "Backend",
    icon: "connection",
    items: [
      { name: "FastAPI", version: "0.115.6", why: "Async-first, automatic OpenAPI docs at /docs, and Pydantic validation built into the request lifecycle", alt: "Flask/Django — more manual wiring for async + validation" },
      { name: "SQLAlchemy", version: "2.0.36 (typed Mapped[])", why: "Type-checked ORM models catch column-type mistakes before runtime; parameterised queries by construction (no raw SQL string interpolation found anywhere in the codebase)", alt: "raw SQL / a lighter query builder — loses the type safety" },
      { name: "Alembic", version: "1.19.1", why: "Every schema change is a reviewable, revertible migration — 24 revisions, linear chain, no drift between environments", alt: "—" },
      { name: "Pydantic v2 / pydantic-settings", version: "2.10.4 / 2.7.0", why: "Request/response validation and typed settings from one library — e.g. phone-format regex and password length are enforced before a handler ever runs", alt: "—" },
      { name: "APScheduler", version: "3.11.0", why: "In-process scheduled jobs (6-hourly ingestion, alert evaluation) without standing up a separate worker/queue for a single-VM deployment", alt: "Celery + Redis — real overkill at this scale" },
      { name: "httpx", version: "0.28.1", why: "Async HTTP client for the 11 external integrations, with per-call timeouts so one slow provider can't hang a request", alt: "requests — sync-only" },
      { name: "python-jose[cryptography]", version: "3.5.0", why: "JWT encode/decode (HS256) for access + refresh tokens", alt: "PyJWT — comparable; jose was already pulled in for the crypto backend" },
      { name: "stdlib hashlib (PBKDF2-HMAC-SHA256)", version: "—", why: "600,000-iteration password hashing using only the Python standard library — no bcrypt/passlib dependency, so the build stays installable offline", alt: "bcrypt/argon2 — stronger per-hash cost tuning, but an extra native dependency for a hackathon-offline-safe build" },
      { name: "pytest", version: "9.1.1", why: "485 backend tests run against an in-memory SQLite DB — no container needed to run the suite", alt: "—" },
    ],
  },
  {
    category: "Database",
    icon: "warehouse",
    items: [
      { name: "PostgreSQL", version: "16 (Docker, host port 5433)", why: "Real relational integrity across 20 interlinked tables (users → lots/demands → matches → offers → deals → payments/disputes) — this schema leans hard on foreign keys and unique constraints", alt: "MongoDB — would fight the genuinely relational shape of a marketplace + audit ledger" },
    ],
  },
  {
    category: "AI / Intelligence",
    icon: "spark",
    items: [
      { name: "OpenRouter (optional)", version: "any vision-capable model, default openai/gpt-4o-mini", why: "One API for both text (advisor summary, Ask AgriLink phrasing) and vision (OCR) calls; every feature it powers is explicitly a readability layer, never the source of a number", alt: "A self-hosted model — infeasible for a hackathon timeline and offline-safety goal" },
      { name: "TF-IDF + difflib (stdlib-adjacent)", version: "—", why: "Ask AgriLink's knowledge retrieval is deliberately embedding-free — keeps the knowledge base fully offline-searchable with zero network dependency", alt: "Vector embeddings — better semantic recall, but breaks the offline guarantee" },
    ],
  },
  {
    category: "Deployment",
    icon: "truck",
    items: [
      { name: "Docker Compose", version: "docker-compose.prod.yml", why: "One command brings up db + backend + frontend + reverse proxy on a single VM", alt: "Kubernetes — unjustified operational overhead at this scale" },
      { name: "Caddy", version: "reverse proxy", why: "Automatic HTTPS with a domain, one origin for /api → backend and everything else → frontend", alt: "Nginx — more manual TLS config for the same result" },
      { name: "Next.js standalone output", version: "next.config.ts: output: \"standalone\"", why: "A self-contained server bundle for the Docker runtime image, no full node_modules copy needed", alt: "—" },
    ],
  },
];

const INTEGRATIONS = [
  { name: "data.gov.in AGMARKNET", purpose: "Today's + historical mandi prices", freq: "6-hourly scheduler + on-demand", fallback: "Committed CSV snapshot → synthetic fixtures", auth: "Optional API key", status: "limited" as const },
  { name: "Open-Meteo", purpose: "7-day weather forecast + geocoding", freq: "Per request", fallback: "Neutral \"unavailable\" result", auth: "None (keyless)", status: "operational" as const },
  { name: "OpenWeatherMap", purpose: "Current-conditions overlay", freq: "Per request", fallback: "Forecast still shown without it", auth: "Optional API key", status: "limited" as const },
  { name: "NASA POWER", purpose: "30-day rainfall anomaly", freq: "Per request", fallback: "Anomaly card hidden", auth: "None (keyless)", status: "operational" as const },
  { name: "OSRM", purpose: "Road distance/time for best-market + logistics", freq: "Per request", fallback: "Haversine straight-line distance", auth: "None (public demo server)", status: "operational" as const },
  { name: "Nominatim + BigDataCloud", purpose: "Reverse geocode (lat/lon → district)", freq: "Per request, cached in geo_cache", fallback: "60-city nearest-place table → nearest_state", auth: "None (keyless)", status: "operational" as const },
  { name: "Nager.Date", purpose: "Mandi holiday awareness", freq: "Cached per year", fallback: "Built-in 2026 holiday list", auth: "None (keyless)", status: "operational" as const },
  { name: "OpenRouter", purpose: "Advisor summary, Ask AgriLink, OCR, translation", freq: "Per request, 6h-cached advisor summary", fallback: "Features hidden / rule output shown", auth: "Optional API key", status: "limited" as const },
  { name: "Google Earth Engine", purpose: "NDVI crop-health overlay (MODIS/061/MOD13Q1) on the Decision Brief", freq: "Per request", fallback: "crop_health omitted (available: false)", auth: "Optional service-account key", status: "limited" as const },
  { name: "Fast2SMS-compatible gateway", purpose: "OTP password reset, optional price-alert/deal SMS digest", freq: "Per event", fallback: "Message logged server-side instead of sent", auth: "Optional API key", status: "limited" as const },
];

export function TechStackSection() {
  return (
    <JudgeSection
      id="tech-stack"
      eyebrow="Why these choices"
      title="Complete technology stack"
      quickAnswer="Every dependency is pinned in requirements.txt / package.json — this table gives the reasoning a judge is likely to ask for, not just the name."
    >
      <div className="flex flex-col gap-8">
        {STACK.map((group) => (
          <div key={group.category}>
            <h3 className="flex items-center gap-2 font-heading text-base font-bold text-[var(--ink)]">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--green-50)] text-[var(--green-700)]">
                <Icon name={group.icon} size={16} />
              </span>
              {group.category}
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {group.items.map((t) => (
                <div key={t.name} className="al-card-plain p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-heading text-sm font-bold text-[var(--ink)]">{t.name}</span>
                    <span className="shrink-0 text-[11px] font-semibold text-[var(--ink-mute)]">{t.version}</span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-[var(--ink-soft)]">
                    <span className="font-semibold text-[var(--green-700)]">Why: </span>{t.why}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--ink-mute)]">
                    <span className="font-semibold">Alternative considered: </span>{t.alt}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <h3 id="integrations" className="mt-10 scroll-mt-32 font-heading text-lg font-bold text-[var(--ink)]">
        API &amp; integration center
      </h3>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">
        &quot;Limited&quot; means the integration works fully once an optional free-tier API key is
        set — the app runs and demos correctly without it, just with that one enrichment
        layer omitted.
      </p>
      <div className="mt-4">
        <JudgeTable>
          <thead>
            <tr className="border-b border-[var(--line)] bg-[var(--paper)] text-left text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)]">
              <th className="px-4 py-3">API</th>
              <th className="px-4 py-3">Purpose</th>
              <th className="px-4 py-3">Frequency</th>
              <th className="px-4 py-3">Fallback strategy</th>
              <th className="px-4 py-3">Auth</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {INTEGRATIONS.map((r, i) => (
              <tr key={r.name} className={i % 2 ? "bg-[var(--paper)]/50" : ""}>
                <td className="px-4 py-3 align-top font-bold text-[var(--ink)]">{r.name}</td>
                <td className="px-4 py-3 align-top text-[var(--ink-soft)]">{r.purpose}</td>
                <td className="px-4 py-3 align-top text-[var(--ink-soft)]">{r.freq}</td>
                <td className="px-4 py-3 align-top text-[var(--ink-soft)]">{r.fallback}</td>
                <td className="px-4 py-3 align-top text-[var(--ink-soft)]">{r.auth}</td>
                <td className="px-4 py-3 align-top"><IntegrationStatus status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </JudgeTable>
      </div>
    </JudgeSection>
  );
}

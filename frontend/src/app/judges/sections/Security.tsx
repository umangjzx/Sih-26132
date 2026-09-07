"use client";

import { Icon } from "@/components/ui";
import { JudgeSection, JudgeTable } from "./shared";

const CHECKLIST: { item: string; done: boolean; note: string }[] = [
  { item: "Password hashing (PBKDF2-HMAC-SHA256, 600,000 iterations, per-user salt)", done: true, note: "core/security.py:58-68 — stdlib only, no bcrypt dependency" },
  { item: "Constant-time password comparison", done: true, note: "hmac.compare_digest, security.py:83" },
  { item: "JWT access/refresh token separation", done: true, note: "Distinct \"type\" claim; a refresh token can't be used as a bearer token" },
  { item: "Role-based route gating", done: true, note: "Admin, farmer, and buyer routes each check the caller's role server-side" },
  { item: "Per-record authorization (not just role)", done: true, note: "A deal is only visible to its own farmer, its own buyer, or an admin" },
  { item: "Request validation at the boundary (Pydantic)", done: true, note: "Every POST/PATCH body is schema-validated before touching business logic" },
  { item: "Parameterized database queries", done: true, note: "SQLAlchemy ORM throughout — zero raw f-string/format-string SQL found in a full-codebase grep" },
  { item: "CORS allowlist (not wildcard)", done: true, note: "Explicit origin list from CORS_ORIGINS, credentials enabled only for those origins" },
  { item: "Per-route rate limiting", done: true, note: "In-process sliding-window limiter, 27 call sites across 14 route files — register, login, lots, demands, forward, pools, OCR, financing, and more" },
  { item: "Output escaping on generated HTML", done: true, note: "The printable deal receipt escapes every user-supplied field before rendering" },
  { item: "Append-only audit trail", done: true, note: "transaction_events rows are only ever inserted, never updated" },
  { item: "No secrets committed to the repo", done: true, note: ".env, credentials.json, service-account JSON are all gitignored" },
  { item: "Static application security testing (bandit)", done: true, note: "Full backend scan, 2026-09-04: 1 High + 6 Low findings, all fixed (usedforsecurity=False on a non-cryptographic MD5 use, targeted # nosec on 3 reviewed false-positives). Re-run again 2026-09-07 against all the v1.18-v1.21 feature work since — still 0 issues" },
  { item: "Dependency vulnerability scanning (pip-audit)", done: true, note: "2026-09-04, two rounds: first 11 known CVEs across fastapi/starlette/python-dotenv/python-jose→ecdsa, fixed by upgrading fastapi to 0.141.1, starlette to 1.6.0, python-dotenv to 1.2.2, and replacing python-jose+ecdsa with PyJWT (only HS256 is used, so the EC-signing dependency was dead weight). That swap's initial PyJWT 2.10.1 itself carried known CVEs, caught by a second scan and fixed by upgrading to PyJWT 2.13.0. Re-run again 2026-09-07 — still 0 known vulnerabilities" },
  { item: "Security response headers (CSP/HSTS/X-Frame-Options)", done: false, note: "Not configured — Caddy in the deployment terminates TLS but no additional header middleware is set" },
  { item: "Automated dependency/vulnerability scanning wired into CI", done: false, note: "bandit and pip-audit were run manually (2026-09-04 and again 2026-09-07), not on a schedule — no Dependabot/Snyk-equivalent or CI gate wired in yet" },
  { item: "Distributed rate limiting (multi-instance safe)", done: false, note: "Deliberate single-worker design choice, documented in code — would need Redis to scale past one Uvicorn worker" },
];

const RBAC = [
  { feature: "View live mandi prices, /explore dashboard", farmer: "✓", buyer: "✓", admin: "✓", anon: "✓" },
  { feature: "View sell/wait signal & Decision Brief", farmer: "✓", buyer: "✓", admin: "✓", anon: "✓" },
  { feature: "List a lot for sale", farmer: "✓", buyer: "—", admin: "—", anon: "—" },
  { feature: "Post a buying demand", farmer: "—", buyer: "✓", admin: "—", anon: "—" },
  { feature: "Browse lots (Discovery board)", farmer: "—", buyer: "✓", admin: "—", anon: "—" },
  { feature: "Browse demands (Discovery board)", farmer: "✓", buyer: "—", admin: "—", anon: "—" },
  { feature: "Make / accept an offer", farmer: "✓", buyer: "✓", admin: "—", anon: "—" },
  { feature: "Record a deal payment", farmer: "—", buyer: "✓ (payer)", admin: "—", anon: "—" },
  { feature: "Advance a deal's pipeline stage", farmer: "✓ (own deal)", buyer: "✓ (own deal)", admin: "✓ (any)", anon: "—" },
  { feature: "Raise a dispute", farmer: "✓", buyer: "✓", admin: "—", anon: "—" },
  { feature: "Resolve / close a dispute", farmer: "✓ (raiser)", buyer: "✓ (raiser)", admin: "✓ (any)", anon: "—" },
  { feature: "Create / organize an FPO pool", farmer: "✓", buyer: "—", admin: "—", anon: "—" },
  { feature: "Post a forward bid", farmer: "—", buyer: "✓", admin: "—", anon: "—" },
  { feature: "Commit to a forward bid", farmer: "✓", buyer: "—", admin: "—", anon: "—" },
  { feature: "Approve / reject user verification", farmer: "—", buyer: "—", admin: "✓", anon: "—" },
  { feature: "Activate / deactivate an account", farmer: "—", buyer: "—", admin: "✓", anon: "—" },
  { feature: "View admin analytics & audit feed", farmer: "—", buyer: "—", admin: "✓", anon: "—" },
];

export function SecuritySection() {
  return (
    <JudgeSection
      id="security"
      eyebrow="Trust & access"
      title="Security, privacy & role-based access"
      quickAnswer="Two dedicated scanners were run against the backend on 2026-09-04 — bandit (static analysis) and pip-audit (dependency CVEs) — and every finding from both was fixed, not just logged; both now report clean. Re-run again on 2026-09-07 after a further round of feature work — still clean. Every access-control, hashing, and injection-prevention claim below is a direct code citation, re-verified by grep on 2026-09-07."
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="al-card-plain p-5">
          <h3 className="font-heading text-sm font-bold text-[var(--ink)]">Authentication</h3>
          <ul className="mt-2 flex flex-col gap-1.5 text-xs leading-relaxed text-[var(--ink-soft)]">
            <li>Phone + password, PBKDF2-HMAC-SHA256, 600,000 iterations, 16-byte per-user salt</li>
            <li>JWT (HS256) access token (30 min default) + refresh token (7 days default)</li>
            <li>A missing JWT_SECRET_KEY mints a random per-process secret rather than a guessable default — tokens simply won&apos;t survive a restart, they never silently trust an unsigned token</li>
          </ul>
        </div>
        <div className="al-card-plain p-5">
          <h3 className="font-heading text-sm font-bold text-[var(--ink)]">Authorization</h3>
          <ul className="mt-2 flex flex-col gap-1.5 text-xs leading-relaxed text-[var(--ink-soft)]">
            <li>Three real roles: farmer, buyer, admin — enforced at the route level</li>
            <li>Record-level checks beyond role: a deal is only visible to its own two parties or an admin</li>
            <li>Verification is a separate axis from role — unverified/pending/verified/rejected, admin-approved</li>
          </ul>
        </div>
        <div className="al-card-plain p-5">
          <h3 className="font-heading text-sm font-bold text-[var(--ink)]">Data security</h3>
          <ul className="mt-2 flex flex-col gap-1.5 text-xs leading-relaxed text-[var(--ink-soft)]">
            <li>Passwords are never stored in plaintext or reversibly encrypted — only PBKDF2 hashes</li>
            <li>HTTPS is handled by Caddy at the deployment&apos;s reverse-proxy layer</li>
            <li>No payment-card or bank data is collected — payments are instalments recorded by reference, not processed</li>
          </ul>
        </div>
        <div className="al-card-plain p-5">
          <h3 className="font-heading text-sm font-bold text-[var(--ink)]">Application security</h3>
          <ul className="mt-2 flex flex-col gap-1.5 text-xs leading-relaxed text-[var(--ink-soft)]">
            <li>Pydantic validates and rejects malformed input before it reaches business logic</li>
            <li>SQLAlchemy ORM parameterizes every query — zero raw SQL string interpolation in the codebase</li>
            <li>React escapes rendered text by default; the one hand-built HTML surface (the deal receipt) explicitly escapes every field</li>
            <li>27 rate-limited call sites guard against brute-force and scraping</li>
          </ul>
        </div>
      </div>

      <h3 className="mt-8 font-heading text-base font-bold text-[var(--ink)]">Security checklist</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {CHECKLIST.map((c) => (
          <div key={c.item} className="al-card-plain flex items-start gap-3 p-3.5">
            <Icon
              name={c.done ? "checkCircle" : "clock"}
              size={16}
              className={`mt-0.5 shrink-0 ${c.done ? "text-[var(--green-600)]" : "text-[var(--ink-mute)]"}`}
            />
            <div>
              <p className="text-sm font-semibold text-[var(--ink)]">{c.item}</p>
              <p className="mt-0.5 text-xs text-[var(--ink-soft)]">{c.note}</p>
            </div>
          </div>
        ))}
      </div>

      <h3 id="rbac" className="mt-10 scroll-mt-32 font-heading text-base font-bold text-[var(--ink)]">
        Role-based access matrix
      </h3>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">
        These are the system&apos;s three real roles — <code className="rounded bg-[var(--paper)] px-1">farmer</code>,{" "}
        <code className="rounded bg-[var(--paper)] px-1">buyer</code>, and{" "}
        <code className="rounded bg-[var(--paper)] px-1">admin</code> — plus anonymous access.
        There is no separate &quot;Judge&quot; role in the schema; judges evaluate via the seeded demo
        accounts on <code className="rounded bg-[var(--paper)] px-1">/login</code> (see Demo Evidence).
      </p>
      <div className="mt-3">
        <JudgeTable>
          <thead>
            <tr className="border-b border-[var(--line)] bg-[var(--paper)] text-left text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)]">
              <th className="px-4 py-3">Feature</th>
              <th className="px-4 py-3 text-center">Farmer</th>
              <th className="px-4 py-3 text-center">Buyer</th>
              <th className="px-4 py-3 text-center">Admin</th>
              <th className="px-4 py-3 text-center">Anonymous</th>
            </tr>
          </thead>
          <tbody>
            {RBAC.map((r, i) => (
              <tr key={r.feature} className={i % 2 ? "bg-[var(--paper)]/50" : ""}>
                <td className="px-4 py-3 align-top font-semibold text-[var(--ink)]">{r.feature}</td>
                <td className="px-4 py-3 text-center text-[var(--ink-soft)]">{r.farmer}</td>
                <td className="px-4 py-3 text-center text-[var(--ink-soft)]">{r.buyer}</td>
                <td className="px-4 py-3 text-center text-[var(--ink-soft)]">{r.admin}</td>
                <td className="px-4 py-3 text-center text-[var(--ink-soft)]">{r.anon}</td>
              </tr>
            ))}
          </tbody>
        </JudgeTable>
      </div>
    </JudgeSection>
  );
}

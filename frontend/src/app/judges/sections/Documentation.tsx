"use client";

import Link from "next/link";
import { Icon } from "@/components/ui";
import { JudgeSection } from "./shared";

const REPO = "https://github.com/umangjzx/Sih-26132/blob/main";

const DOCS = [
  { icon: "fileText", name: "Technical documentation & API reference", desc: "Full architecture, all 111 endpoints, database schema, every feature explained — 1,650+ lines", href: `${REPO}/README.md` },
  { icon: "connection", name: "Frontend documentation", desc: "Routes, run/test commands, i18n model, frontend-specific config", href: `${REPO}/frontend/README.md` },
  { icon: "warehouse", name: "Backend documentation", desc: "Run, migrations & DB reset, tests, env vars, data sources, known data limitations", href: `${REPO}/backend/README.md` },
  { icon: "truck", name: "Deployment guide", desc: "Single-VM Docker Compose + Caddy, env checklist, demo-user seeder, backup/restore", href: `${REPO}/DEPLOYMENT.md` },
  { icon: "calendar", name: "Roadmap, research & phase plans", desc: "The .planning/ directory — per-phase research notes and summaries from v1.1 through v1.7", href: `${REPO}/.planning` },
  { icon: "shield", name: "Database migrations (source of truth for schema history)", desc: "12 Alembic revisions, browsable in order", href: `${REPO}/backend/alembic/versions` },
];

export function DocumentationSection() {
  return (
    <JudgeSection
      id="documentation"
      eyebrow="Everything, linked"
      title="Project documentation center"
      quickAnswer="Every link below opens the real file in the public repository — nothing here is a placeholder for a document that doesn't exist."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {DOCS.map((d) => (
          <Link
            key={d.name}
            href={d.href}
            className="al-card-plain group flex items-start gap-3.5 p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--green-50)] text-[var(--green-700)]">
              <Icon name={d.icon} size={18} />
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-bold text-[var(--ink)] group-hover:text-[var(--green-700)]">
                {d.name}
                <Icon name="arrowRight" size={13} className="shrink-0 text-[var(--ink-mute)]" />
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--ink-soft)]">{d.desc}</p>
            </div>
          </Link>
        ))}
      </div>
      <p className="mt-4 text-xs text-[var(--ink-mute)]">
        There is no separately maintained Project Proposal, standalone Testing Report, or
        User Manual as distinct files — that content lives inside the README documents
        linked above (API reference doubles as technical spec, the Testing section covers
        the testing report, and the &quot;What it does&quot; route table doubles as the user guide).
        Version history for all of it is the git commit log itself.
      </p>
    </JudgeSection>
  );
}

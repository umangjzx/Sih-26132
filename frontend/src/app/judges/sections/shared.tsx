"use client";

/**
 * Shared primitives for the Judges & Evaluation page. Kept deliberately
 * separate from the rest of the design system (`ui.tsx`) because this page
 * has its own vocabulary — evidence badges, status pills, readiness bars —
 * that doesn't belong in the general product UI kit.
 */

import { useState, type ReactNode } from "react";
import { Icon } from "@/components/ui";

/* ── Section shell — every top-level section shares this frame ─────────── */

export function JudgeSection({
  id,
  eyebrow,
  title,
  quickAnswer,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  quickAnswer?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-32 border-t border-[var(--line)] py-14 sm:py-16">
      <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--green-600)]">
          {eyebrow}
        </p>
        <h2 className="mt-1.5 font-heading text-2xl font-extrabold text-[var(--ink)] sm:text-3xl">
          {title}
        </h2>
        {quickAnswer && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[var(--green-600)]/20 bg-[var(--green-50)] px-4 py-3 sm:max-w-3xl">
            <Icon name="spark" size={16} className="mt-0.5 shrink-0 text-[var(--green-600)]" />
            <p className="text-sm leading-relaxed text-[var(--green-800)]">
              <span className="font-bold">Quick answer — </span>
              {quickAnswer}
            </p>
          </div>
        )}
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

/* ── Evidence badge — is this fact verified, assessed, or missing? ─────── */

export type Evidence = "verified" | "assessed" | "pending";

const EVIDENCE_STYLE: Record<Evidence, { label: string; cls: string; icon: string }> = {
  verified: {
    label: "Verified in codebase",
    cls: "bg-[var(--green-100)] text-[var(--green-700)]",
    icon: "checkCircle",
  },
  assessed: {
    label: "Manually assessed",
    cls: "bg-[var(--amber-100)] text-[var(--amber-700)]",
    icon: "scale",
  },
  pending: {
    label: "Data not yet available",
    cls: "bg-[var(--line)] text-[var(--ink-soft)]",
    icon: "clock",
  },
};

export function EvidenceBadge({ kind, note }: { kind: Evidence; note?: string }) {
  const s = EVIDENCE_STYLE[kind];
  return (
    <span
      className={`al-badge ${s.cls} normal-case tracking-normal`}
      title={note}
    >
      <Icon name={s.icon} size={11} />
      {s.label}
    </span>
  );
}

/* ── Status pill — module / feature implementation status ──────────────── */

export type ModuleStatus = "production" | "functional" | "prototype" | "planned" | "deferred";

const STATUS_STYLE: Record<ModuleStatus, { label: string; cls: string }> = {
  production: { label: "Production ready", cls: "bg-[var(--green-100)] text-[var(--green-700)]" },
  functional: { label: "Functional", cls: "bg-blue-50 text-blue-700" },
  prototype: { label: "Prototype", cls: "bg-[var(--amber-100)] text-[var(--amber-700)]" },
  planned: { label: "Planned", cls: "bg-[var(--line)] text-[var(--ink-soft)]" },
  deferred: { label: "Deferred", cls: "bg-[var(--red-100)] text-[var(--red-700)]" },
};

export function StatusPill({ status }: { status: ModuleStatus }) {
  const s = STATUS_STYLE[status];
  return <span className={`al-badge ${s.cls} normal-case tracking-normal`}>{s.label}</span>;
}

/* ── Test/validation result pill ────────────────────────────────────────── */

export function ResultPill({ result }: { result: "pass" | "partial" | "fail" }) {
  const map = {
    pass: { icon: "check", cls: "text-[var(--green-600)]", label: "Passed" },
    partial: { icon: "alert", cls: "text-[var(--amber-600)]", label: "Partial" },
    fail: { icon: "close", cls: "text-[var(--red-500)]", label: "Failed" },
  } as const;
  const m = map[result];
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-semibold ${m.cls}`}>
      <Icon name={m.icon} size={14} />
      {m.label}
    </span>
  );
}

/* ── Integration status dot ─────────────────────────────────────────────── */

export function IntegrationStatus({ status }: { status: "operational" | "limited" | "planned" }) {
  const map = {
    operational: { cls: "bg-[var(--green-500)]", label: "Operational" },
    limited: { cls: "bg-[var(--amber-500)]", label: "Limited (needs optional key)" },
    planned: { cls: "bg-[var(--ink-mute)]", label: "Planned" },
  } as const;
  const m = map[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-soft)]">
      <span className={`h-2 w-2 shrink-0 rounded-full ${m.cls}`} />
      {m.label}
    </span>
  );
}

/* ── Metric card — for the hero's quick-impact grid ─────────────────────── */

export function MetricCard({
  value,
  label,
  evidence,
}: {
  value: string;
  label: string;
  evidence: Evidence;
}) {
  return (
    <div className="al-stat flex flex-col gap-1 !bg-white/8 !border-white/15 text-left backdrop-blur-md">
      <span className="font-heading text-2xl font-extrabold text-white sm:text-[1.75rem]">
        {value}
      </span>
      <span className="text-xs font-medium leading-snug text-white/65">{label}</span>
      <span className="mt-1">
        <EvidenceBadge kind={evidence} />
      </span>
    </div>
  );
}

/* ── Expandable card — module explorer, tech stack cards, etc. ──────────── */

export function ExpandableCard({
  title,
  subtitle,
  headerRight,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="al-card-plain overflow-hidden !bg-[var(--surface)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-[var(--paper)]"
      >
        <div className="min-w-0">
          <h3 className="font-heading text-base font-bold text-[var(--ink)]">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 truncate text-xs text-[var(--ink-soft)]">{subtitle}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {headerRight}
          <Icon
            name="chevronDown"
            size={18}
            className={`text-[var(--ink-mute)] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>
      {open && (
        <div className="border-t border-[var(--line)] px-5 py-5">{children}</div>
      )}
    </div>
  );
}

/* ── Readiness score bar ────────────────────────────────────────────────── */

export function ReadinessBar({
  label,
  pct,
  evidence,
}: {
  label: string;
  pct: number;
  evidence: string;
}) {
  return (
    <div className="al-card-plain p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="font-heading text-sm font-bold text-[var(--ink)]">{label}</span>
        <span className="font-heading text-lg font-extrabold text-[var(--green-700)]">{pct}%</span>
      </div>
      <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-[var(--line)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--green-500)] to-[var(--green-700)]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[var(--ink-soft)]">{evidence}</p>
    </div>
  );
}

/* ── Simple responsive table wrapper ────────────────────────────────────── */

export function JudgeTable({ children }: { children: ReactNode }) {
  return (
    <div className="al-card-plain overflow-x-auto !bg-[var(--surface)]">
      <table className="w-full min-w-[560px] border-collapse text-sm">{children}</table>
    </div>
  );
}

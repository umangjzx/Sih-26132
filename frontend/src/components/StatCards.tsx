"use client";

import { Icon } from "@/components/ui";

export type Stat = {
  label: string;
  value: string;
  sub?: string;
  icon?: string;
  tone?: "neutral" | "good" | "warn";
};

/** A responsive "at a glance" strip used on the farmer / buyer dashboards. */
export function StatCards({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => {
        const tone =
          s.tone === "good"
            ? "text-[var(--green-700)]"
            : s.tone === "warn"
              ? "text-[var(--amber-700)]"
              : "text-[var(--ink)]";
        return (
          <div
            key={s.label}
            className="flex flex-col gap-1 rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm"
          >
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
              {s.icon && <Icon name={s.icon} size={13} />}
              {s.label}
            </div>
            <div className={`font-heading text-xl font-bold ${tone}`}>{s.value}</div>
            {s.sub && <div className="text-xs text-[var(--ink-soft)]">{s.sub}</div>}
          </div>
        );
      })}
    </div>
  );
}

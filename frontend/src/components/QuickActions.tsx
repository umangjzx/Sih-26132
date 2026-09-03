"use client";

/**
 * A compact row of one-tap shortcuts for the top of a dashboard, so the common
 * next step is never more than a tap away (and never needs the nav drawer).
 * Scrolls horizontally on narrow screens.
 */

import Link from "next/link";

import { Icon } from "./ui";

export type QuickAction = {
  label: string;
  icon: string;
  href?: string;
  onClick?: () => void;
  badge?: number;
  /** highlight when it needs attention (e.g. matches waiting) */
  accent?: boolean;
};

export function QuickActions({ actions }: { actions: QuickAction[] }) {
  const items = actions.filter(Boolean);
  if (items.length === 0) return null;

  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((a) => {
        const cls = `flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold shadow-sm transition ${
          a.accent
            ? "border-[var(--green-600)]/40 bg-[var(--green-100)] text-[var(--green-800)] hover:bg-[var(--green-200)]"
            : "border-[var(--line)] bg-white text-[var(--ink)] hover:border-[var(--green-500)] hover:bg-[var(--paper)]"
        }`;
        const inner = (
          <>
            <Icon name={a.icon} size={16} className={a.accent ? "" : "text-[var(--green-700)]"} />
            {a.label}
            {a.badge != null && a.badge > 0 && (
              <span className="ml-0.5 rounded-full bg-[var(--green-700)] px-1.5 py-0.5 text-[10px] font-extrabold leading-none text-white">
                {a.badge}
              </span>
            )}
          </>
        );
        return a.href ? (
          <Link key={a.label} href={a.href} className={cls}>
            {inner}
          </Link>
        ) : (
          <button key={a.label} type="button" onClick={a.onClick} className={cls}>
            {inner}
          </button>
        );
      })}
    </div>
  );
}

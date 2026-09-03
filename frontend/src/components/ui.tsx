"use client";

/**
 * AgriLink UI kit — icons + layout primitives.
 * Every icon is a 24 px stroke SVG (strokeWidth 1.8, round caps/joins).
 * All surface colours, shadows, and radii reference CSS design tokens — no raw hex.
 */

import type { ReactNode } from "react";

/* ── Icon paths ────────────────────────────────────────────────────────── */

const P = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const PATHS: Record<string, ReactNode> = {
  /* ---- Navigation & layout ---- */
  house: (
    <>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" {...P} />
      <path d="M9 22V12h6v10" {...P} />
    </>
  ),
  menu: <path d="M4 12h16M4 6h16M4 18h16" {...P} />,
  close: <path d="M6 6l12 12M18 6L6 18" {...P} />,
  chevronDown: <path d="M6 9l6 6 6-6" {...P} />,
  chevronRight: <path d="M9 6l6 6-6 6" {...P} />,
  chevronLeft: <path d="M15 18l-6-6 6-6" {...P} />,
  arrowUp:   <path d="M12 19V5M6 11l6-6 6 6"  {...P} />,
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6"  {...P} />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" {...P} />,
  globe: (
    <>
      <circle cx="12" cy="12" r="10" {...P} />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" {...P} />
    </>
  ),
  map: (
    <>
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" {...P} />
      <path d="M9 4v14M15 6v14" {...P} />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" {...P} />
      <circle cx="12" cy="10" r="2.5" {...P} />
    </>
  ),

  /* ---- Agriculture / trade ---- */
  leaf: (
    <>
      <path d="M11 20C6 20 3 16 3 11 3 6 7 4 12 4c3 0 6 0 8-1-1 9-4 17-9 17Z" {...P} />
      <path d="M11 20c0-6 2-10 7-13" {...P} />
    </>
  ),
  truck: (
    <>
      <path d="M3 16V6h11v10M14 9h4l3 3v4h-7" {...P} />
      <circle cx="7.5"  cy="17.5" r="1.8" {...P} />
      <circle cx="17.5" cy="17.5" r="1.8" {...P} />
    </>
  ),
  warehouse: (
    <>
      <path d="M3 21V9l9-4 9 4v12" {...P} />
      <path d="M3 21h18M7 21v-6h10v6M7 13h10" {...P} />
    </>
  ),
  building: (
    <>
      <path d="M3 21h18M5 21V7l7-4 7 4v14" {...P} />
      <path d="M9 21v-6h6v6M9 11h6M9 7h.01M15 7h.01" {...P} />
    </>
  ),
  coins: (
    <>
      <ellipse cx="9"  cy="7"  rx="6" ry="3" {...P} />
      <path d="M3 7v5c0 1.7 2.7 3 6 3M3 12v5c0 1.7 2.7 3 6 3" {...P} />
      <ellipse cx="15" cy="14" rx="6" ry="3" {...P} />
      <path d="M9 14v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" {...P} />
    </>
  ),
  handshake: (
    <>
      <path d="M10 20v-3a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v3M14 20h3a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-3" {...P} />
      <path d="M10 20H7a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h3" {...P} />
      <path d="M8 12a4 4 0 0 1 8 0v0a4 4 0 0 1-8 0z" {...P} />
      <path d="M12 12v3" {...P} />
    </>
  ),
  connection: (
    <>
      <circle cx="18" cy="5"  r="3" {...P} />
      <circle cx="6"  cy="12" r="3" {...P} />
      <circle cx="18" cy="19" r="3" {...P} />
      <path d="M8.59 13.51l6.83 3.98M15.41 6.51L8.59 10.49" {...P} />
    </>
  ),
  scale: (
    <>
      <path d="M12 4v16M7 20h10M6 8h12" {...P} />
      <path d="M6 8 3.5 13a2.5 2.5 0 0 0 5 0L6 8ZM18 8l-2.5 5a2.5 2.5 0 0 0 5 0L18 8Z" {...P} />
    </>
  ),
  forward: (
    <>
      <path d="M12 5v14M19 12l-7 7-7-7" {...P} />
      <path d="M5 5h14" {...P} />
    </>
  ),

  /* ---- Data & analytics ---- */
  chart: (
    <>
      <path d="M4 19h16" {...P} />
      <path d="M6 16l3.5-4.5 3 3L18 8" {...P} />
    </>
  ),
  analytics: (
    <>
      <rect x="3" y="12" width="4"  height="9" rx="1" {...P} />
      <rect x="10" y="7" width="4"  height="14" rx="1" {...P} />
      <rect x="17" y="3" width="4"  height="18" rx="1" {...P} />
    </>
  ),
  spark: <path d="M12 3l2.2 6.2L20 11l-5.8 1.8L12 19l-2.2-6.2L4 11l5.8-1.8L12 3Z" {...P} />,

  /* ---- UI / feedback ---- */
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 6-2 8-2 8h16s-2-2-2-8Z" {...P} />
      <path d="M10 20a2 2 0 0 0 4 0" {...P} />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3Z" {...P} />
      <path d="M9 12l2 2 4-4" {...P} />
    </>
  ),
  alert: (
    <>
      <path d="M12 4 2.5 20h19L12 4Z" {...P} />
      <path d="M12 10v5M12 18h.01" {...P} />
    </>
  ),
  check: <path d="M4 12l5 5L20 6" {...P} />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" {...P} />
      <path d="M8.5 12l2.5 2.5 4.5-5" {...P} />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" {...P} />
      <path d="M12 7v5l3 2" {...P} />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2" {...P} />
      <path d="M3.5 10h17M8 3v4M16 3v4" {...P} />
    </>
  ),
  camera: (
    <>
      <path d="M3 8a2 2 0 0 1 2-2h2.5l1.5-2h6l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" {...P} />
      <circle cx="12" cy="13" r="3.5" {...P} />
    </>
  ),

  /* ---- Documents ---- */
  fileText: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" {...P} />
      <path d="M14 2v6h6M9 13h6M9 17h4M9 9h1" {...P} />
    </>
  ),
  receipt: (
    <>
      <path d="M4 2v20l2-1.5 2 1.5 2-1.5 2 1.5 2-1.5 2 1.5 2-1.5 2 1.5V2" {...P} />
      <path d="M8 8h8M8 12h6M8 16h4" {...P} />
    </>
  ),

  /* ── Weather ── */
  cloudRain: (
    <>
      <path d="M7 15a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.5A3.5 3.5 0 0 1 18 15H7Z" {...P} />
      <path d="M8 18l-1 2M12 18l-1 2M16 18l-1 2" {...P} />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" {...P} />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" {...P} />
    </>
  ),
  wind: <path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h8" {...P} />,

  /* ── Auth ── */
  users: (
    <>
      <circle cx="9" cy="8" r="3" {...P} />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" {...P} />
      <path d="M16 5.5a3 3 0 0 1 0 5.8M21 20c0-2.6-1.6-4.8-4-5.6" {...P} />
    </>
  ),
};

/* ── Icon component ─────────────────────────────────────────────────────── */

export function Icon({
  name,
  size = 20,
  className = "",
}: {
  name: keyof typeof PATHS | string;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name] ?? PATHS.spark}
    </svg>
  );
}

/* ── Layout primitives ──────────────────────────────────────────────────── */

export function Card({
  children,
  className = "",
  as: Tag = "section",
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  as?: React.ElementType;
  hover?: boolean;
}) {
  return (
    <Tag className={`al-card ${hover ? "al-lift" : ""} p-5 sm:p-6 ${className}`}>
      {children}
    </Tag>
  );
}

export function SectionHeader({
  icon,
  title,
  action,
}: {
  icon?: string;
  title: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 font-heading text-base font-semibold text-[var(--ink)]">
        {icon && <Icon name={icon} size={18} className="text-[var(--green-600)]" />}
        {title}
      </h2>
      {action}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "up" | "down";
}) {
  const c =
    tone === "up"
      ? "text-[var(--green-600)]"
      : tone === "down"
        ? "text-[var(--red-500)]"
        : "text-[var(--green-700)]";
  return (
    <div className="al-stat text-center">
      <div className={`font-heading text-2xl font-bold leading-tight ${c}`}>{value}</div>
      <div className="mt-0.5 text-[11px] font-medium text-[var(--ink-soft)]">{label}</div>
      {sub && <div className="text-[11px] text-[var(--ink-soft)]">{sub}</div>}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "amber" | "red";
}) {
  const cls: Record<string, string> = {
    neutral: "al-badge al-badge-muted",
    green:   "al-badge al-badge-green",
    amber:   "al-badge al-badge-amber",
    red:     "al-badge al-badge-red",
  };
  return <span className={cls[tone] ?? cls.neutral}>{children}</span>;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      data-testid="skeleton"
      role="status"
      aria-label="loading"
      className={`al-skeleton ${className}`}
    />
  );
}

export function EmptyState({
  icon = "leaf",
  children,
}: {
  icon?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--line)] bg-white/40 px-6 py-10 text-center">
      <Icon name={icon} size={30} className="text-[var(--green-300)]" />
      <p className="text-sm text-[var(--ink-soft)]">{children}</p>
    </div>
  );
}

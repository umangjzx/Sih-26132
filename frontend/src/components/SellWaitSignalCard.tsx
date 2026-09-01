"use client";

import { useTranslations } from "next-intl";

import type { SellWaitSignalResponse } from "@/lib/api";
import { Icon } from "./ui";

const theme: Record<
  SellWaitSignalResponse["recommendation"],
  { wrap: string; accent: string; icon: string }
> = {
  sell_now: {
    wrap: "border-[var(--green-600)]/40 bg-gradient-to-br from-[var(--green-100)] to-white",
    accent: "text-[var(--green-700)]",
    icon: "check",
  },
  wait: {
    wrap: "border-[var(--red-500)]/40 bg-gradient-to-br from-[var(--red-100)] to-white",
    accent: "text-[var(--red-700)]",
    icon: "clock",
  },
  hold: {
    wrap: "border-[var(--amber-500)]/40 bg-gradient-to-br from-[var(--amber-100)] to-white",
    accent: "text-[var(--amber-700)]",
    icon: "scale",
  },
};

export function SellWaitSignalCard({ signal }: { signal: SellWaitSignalResponse }) {
  const t = useTranslations("signal");
  const s = theme[signal.recommendation];
  const label =
    signal.recommendation === "sell_now"
      ? t("sell_now")
      : signal.recommendation === "wait"
        ? t("wait")
        : t("hold");

  return (
    <section
      className={`al-card overflow-hidden border p-0 ${s.wrap}`}
      aria-live="polite"
    >
      <div className="flex items-center gap-4 border-b border-black/5 p-5 sm:p-6">
        <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/70 ${s.accent}`}>
          <Icon name={s.icon} size={26} />
        </span>
        <div>
          <div className={`text-xs font-bold uppercase tracking-widest ${s.accent} opacity-80`}>
            {t("title")}
          </div>
          <div className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
            {label}
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <h3 className="mb-2 text-sm font-semibold text-[var(--ink-soft)]">{t("why")}</h3>
        <ul className="space-y-2.5 text-sm leading-relaxed text-[var(--ink)]">
          {signal.reasons.map((reason, idx) => (
            <li key={idx} className="flex gap-2.5">
              <span aria-hidden className={`mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full ${s.accent}`} style={{ background: "currentColor" }} />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

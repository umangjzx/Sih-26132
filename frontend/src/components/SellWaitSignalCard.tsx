"use client";

import { useTranslations } from "next-intl";

import type { SellWaitSignalResponse } from "@/lib/api";

const styleByRecommendation: Record<SellWaitSignalResponse["recommendation"], string> = {
  sell_now: "bg-[color-mix(in_srgb,var(--color-sell)_12%,white)] border-[var(--color-sell)] text-[var(--color-sell)]",
  wait: "bg-[color-mix(in_srgb,var(--color-wait)_12%,white)] border-[var(--color-wait)] text-[var(--color-wait)]",
  hold: "bg-[color-mix(in_srgb,var(--color-hold)_12%,white)] border-[var(--color-hold)] text-[var(--color-hold)]",
};

export function SellWaitSignalCard({ signal }: { signal: SellWaitSignalResponse }) {
  const t = useTranslations("signal");
  const label =
    signal.recommendation === "sell_now"
      ? t("sell_now")
      : signal.recommendation === "wait"
        ? t("wait")
        : t("hold");

  return (
    <section
      className={`rounded-xl border-2 p-5 ${styleByRecommendation[signal.recommendation]}`}
      aria-live="polite"
    >
      <h2 className="text-base font-semibold uppercase tracking-wide opacity-80">{t("title")}</h2>
      <p className="mt-1 text-3xl font-bold">{label}</p>
      <div className="mt-4 border-t border-current/20 pt-3">
        <h3 className="text-sm font-semibold opacity-90">{t("why")}</h3>
        <ul className="mt-2 space-y-2 text-sm leading-relaxed text-[var(--color-text)]">
          {signal.reasons.map((reason, idx) => (
            <li key={idx} className="flex gap-2">
              <span aria-hidden className="mt-1 block h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

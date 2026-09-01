"use client";

import { useTranslations } from "next-intl";

import type { SellWaitSignalResponse } from "@/lib/api";

const styleByRecommendation: Record<SellWaitSignalResponse["recommendation"], string> = {
  sell_now: "bg-green-50/80 border-green-300 text-green-900 shadow-green-900/10",
  wait: "bg-red-50/80 border-red-300 text-red-900 shadow-red-900/10",
  hold: "bg-amber-50/80 border-amber-300 text-amber-900 shadow-amber-900/10",
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
      className={`rounded-2xl border backdrop-blur-xl p-6 shadow-xl hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 ${styleByRecommendation[signal.recommendation]}`}
      aria-live="polite"
    >
      <h2 className="text-base font-bold font-heading uppercase tracking-wide opacity-80">{t("title")}</h2>
      <p className="mt-2 text-4xl font-extrabold tracking-tight">{label}</p>
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

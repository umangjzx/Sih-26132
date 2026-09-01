"use client";

import { useTranslations } from "next-intl";

import type { CropMarketState } from "@/lib/useCropMarket";

const selectCls =
  "min-w-40 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] backdrop-blur-md px-4 py-2.5 text-base font-semibold text-[var(--color-text)] shadow-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent focus:outline-none transition-all cursor-pointer";

export function CropMarketPicker({ cm }: { cm: CropMarketState }) {
  const t = useTranslations("dashboard");
  return (
    <div className="flex flex-wrap gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--color-text)]">
        {t("selectCrop")}
        <select value={cm.crop} onChange={(e) => cm.setCrop(e.target.value)} className={selectCls}>
          {cm.crops.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--color-text)]">
        {t("selectMarket")}
        <select value={cm.market} onChange={(e) => cm.setMarket(e.target.value)} className={selectCls}>
          {cm.marketsForCrop.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

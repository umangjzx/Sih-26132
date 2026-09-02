"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import type { CropMarketState } from "@/lib/useCropMarket";
import { Icon } from "./ui";

const fieldCls =
  "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-base font-semibold text-[var(--color-text)] shadow-sm transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]";

/** A searchable select: a filter box that narrows a native <select> (Cordova-safe). */
function FilterSelect({
  label,
  value,
  options,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options;
    const hits = options.filter((o) => o.toLowerCase().includes(needle));
    // keep the current value reachable even if it doesn't match the filter
    return hits.includes(value) || !value ? hits : [value, ...hits];
  }, [q, options, value]);

  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-sm font-semibold text-[var(--color-text)]">
      {label}
      {options.length > 8 && (
        <div className="relative">
          <Icon
            name="pin"
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            className={`${fieldCls} !py-2 !pl-9 !text-sm !font-medium`}
          />
        </div>
      )}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={fieldCls}>
        {filtered.length === 0 && <option value={value}>{value || "—"}</option>}
        {filtered.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CropMarketPicker({ cm }: { cm: CropMarketState }) {
  const t = useTranslations("dashboard");
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
      <FilterSelect
        label={t("selectCrop")}
        value={cm.crop}
        options={cm.crops}
        onChange={cm.setCrop}
        placeholder={t("selectCrop")}
      />
      <FilterSelect
        label={t("selectMarket")}
        value={cm.market}
        options={cm.marketsForCrop}
        onChange={cm.setMarket}
        placeholder={t("selectMarket")}
      />
    </div>
  );
}

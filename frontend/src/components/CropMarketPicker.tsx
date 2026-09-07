"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import type { CropMarketState } from "@/lib/useCropMarket";
import { Icon } from "./ui";

const fieldCls =
  "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-base font-semibold text-[var(--color-text)] shadow-sm transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]";

/** A single selectable entry: `value` is what gets submitted, `key` is a
 * unique React/DOM key — needed because two markets can share a name (e.g.
 * a "Sirsa APMC" in more than one state) while still being distinct rows. */
type SelectOption = { value: string; key: string };

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
  options: SelectOption[];
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const hits = needle ? options.filter((o) => o.value.toLowerCase().includes(needle)) : options;
    // keep the current value reachable even if it doesn't match the filter
    if (hits.some((o) => o.value === value) || !value) return hits;
    const current = options.find((o) => o.value === value);
    return current ? [current, ...hits] : hits;
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
          <option key={o.key} value={o.value}>
            {o.value}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CropMarketPicker({ cm }: { cm: CropMarketState }) {
  const t = useTranslations("dashboard");

  const cropOptions = useMemo<SelectOption[]>(
    () => cm.crops.map((c) => ({ value: c, key: c })),
    [cm.crops],
  );

  // Live AGMARKNET data spans many states, some of which have an identically
  // named market (e.g. "Sirsa APMC" in more than one state/district) — key on
  // market+district+state so those rows get distinct React keys instead of
  // colliding on the market name alone.
  const marketOptions = useMemo<SelectOption[]>(() => {
    const seen = new Set<string>();
    const list: SelectOption[] = [];
    for (const o of cm.options) {
      if (o.crop !== cm.crop) continue;
      const key = `${o.market}__${o.district}__${o.state ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      list.push({ value: o.market, key });
    }
    return list;
  }, [cm.options, cm.crop]);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
      <FilterSelect
        label={t("selectCrop")}
        value={cm.crop}
        options={cropOptions}
        onChange={cm.setCrop}
        placeholder={t("selectCrop")}
      />
      <FilterSelect
        label={t("selectMarket")}
        value={cm.market}
        options={marketOptions}
        onChange={cm.setMarket}
        placeholder={t("selectMarket")}
      />
    </div>
  );
}

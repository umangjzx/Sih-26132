"use client";

/**
 * v1.1 market-intelligence widgets: weather strip, MSP banner, crop-calendar
 * chip, and the best-net-market panel. Each degrades to null on missing data so
 * the dashboard never breaks.
 */

import { useTranslations } from "next-intl";
import { useState } from "react";

import type {
  BestMarketResponse,
  CropCalendar,
  MspInfo,
  WeatherForecast,
} from "@/lib/api";

const card =
  "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] backdrop-blur-xl p-5 shadow-lg";

function rainIcon(mm: number, prob: number | null) {
  if (mm >= 10 || (prob ?? 0) >= 70) return "🌧️";
  if (mm >= 2 || (prob ?? 0) >= 40) return "🌦️";
  return "☀️";
}

export function WeatherStrip({ data }: { data: WeatherForecast | null }) {
  const t = useTranslations("weather");
  if (!data || data.source === "unavailable" || data.days.length === 0) return null;

  return (
    <section className={card}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-heading text-base font-bold">{t("title")}</h2>
        {data.sell_bias === 1 && (
          <span className="rounded-full bg-[var(--color-wait)]/10 px-2.5 py-1 text-xs font-bold text-[var(--color-wait)]">
            ⚠ {t("rain")}
          </span>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {data.days.map((d) => (
          <div
            key={d.date}
            className="flex flex-col items-center gap-0.5 rounded-xl bg-white/50 px-1 py-2 text-center"
          >
            <span className="text-xs text-stone-500">{d.date.slice(5)}</span>
            <span className="text-xl leading-none">{rainIcon(d.precip_mm, d.rain_prob)}</span>
            <span className="text-xs font-semibold">{d.temp_max_c ?? "–"}°</span>
            <span className="text-[10px] text-[var(--color-brand)]">{d.precip_mm}mm</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-stone-600">{data.note}</p>
      {data.rain_anomaly?.note && (
        <p className="mt-1 text-xs text-stone-500">{data.rain_anomaly.note}</p>
      )}
    </section>
  );
}

export function MspBanner({ data }: { data: MspInfo | null }) {
  const t = useTranslations("msp");
  if (!data) return null;

  if (!data.has_msp) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-white/50 px-4 py-3 text-sm text-stone-600">
        {t("noMsp", { crop: data.crop })}
      </div>
    );
  }

  const below = data.below_msp ?? false;
  const gap = Math.abs(data.gap_vs_msp ?? 0);
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        below
          ? "border-[var(--color-wait)]/40 bg-[var(--color-wait)]/10"
          : "border-[var(--color-sell)]/40 bg-[var(--color-sell)]/10"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-heading text-sm font-bold">
          {t("title")} · ₹{data.msp_price}
        </span>
        <span className="text-xs text-stone-500">{data.season}</span>
      </div>
      {data.latest_modal_price != null && (
        <p
          className={`mt-1 text-sm font-semibold ${
            below ? "text-[var(--color-wait)]" : "text-[var(--color-sell)]"
          }`}
        >
          {below
            ? `${t("belowBy")} (₹${gap})`
            : `${t("aboveBy")} (₹${gap})`}
        </p>
      )}
    </div>
  );
}

export function CalendarChip({ data }: { data: CropCalendar | null }) {
  const t = useTranslations("calendar");
  if (!data) return null;
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white/50 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-heading font-bold">{t("title")}</span>
        <span className="rounded-full bg-[var(--color-brand)]/10 px-2 py-0.5 text-xs font-semibold text-[var(--color-brand)]">
          {t("phase")}: {data.current_phase}
        </span>
        {data.glut_risk && (
          <span className="rounded-full bg-[var(--color-hold)]/15 px-2 py-0.5 text-xs font-semibold text-[var(--color-hold)]">
            {t("glutWarning")}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-xs text-stone-500">
        {t("sow")}: {data.sow_months} · {t("harvest")}: {data.harvest_months} · {t("peak")}: {data.peak_arrival_months}
      </p>
      <p className="mt-1 text-xs text-stone-600">{data.note}</p>
    </div>
  );
}

export function BestMarketPanel({ data }: { data: BestMarketResponse | null }) {
  const t = useTranslations("bestmarket");
  const [expanded, setExpanded] = useState(false);
  if (!data || data.ranked.length === 0) return null;

  const rows = expanded ? data.ranked : data.ranked.slice(0, 3);
  return (
    <section className={card}>
      <h2 className="mb-3 font-heading text-base font-bold">{t("title")}</h2>
      <div className="rounded-xl bg-[var(--color-brand)]/10 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-brand)]">
          {t("best")}
        </div>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
          <span className="font-heading text-2xl font-bold text-[var(--color-brand-dark)]">
            ₹{data.best.net_price_per_qtl}
          </span>
          <span className="text-sm font-medium">
            @ {data.best.market} · {data.best.road_km} km
          </span>
        </div>
        {data.note && <p className="mt-1 text-sm text-stone-600">💡 {data.note}</p>}
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[440px] text-left text-sm">
          <thead className="text-xs text-stone-500">
            <tr>
              <th className="py-1.5 pr-3">{t("modal")}</th>
              <th className="py-1.5 pr-3">Market</th>
              <th className="py-1.5 pr-3">{t("roadDistance")}</th>
              <th className="py-1.5 pr-3">{t("transport")}</th>
              <th className="py-1.5 font-bold text-[var(--color-brand)]">{t("netPrice")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.market}
                className={`border-t border-[var(--color-border)] ${
                  data.here && r.market === data.here.market ? "bg-[var(--color-brand)]/5" : ""
                }`}
              >
                <td className="py-1.5 pr-3">₹{r.modal_price}</td>
                <td className="py-1.5 pr-3 font-medium">
                  {r.market}
                  {data.here && r.market === data.here.market && (
                    <span className="ml-1 text-xs text-stone-400">({t("sellHere")})</span>
                  )}
                </td>
                <td className="py-1.5 pr-3">{r.road_km} km</td>
                <td className="py-1.5 pr-3 text-stone-500">−₹{r.transport_cost_per_qtl}</td>
                <td className="py-1.5 font-bold text-[var(--color-brand)]">₹{r.net_price_per_qtl}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.ranked.length > 3 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-sm font-semibold text-[var(--color-brand)] hover:underline"
        >
          {expanded ? t("showLess") : t("showAll")}
        </button>
      )}
    </section>
  );
}

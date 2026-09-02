"use client";

/**
 * v1.1 market-intelligence widgets, restyled on the AgriLink UI kit.
 * Each degrades to null on missing data so a page never breaks.
 */

import { useTranslations } from "next-intl";
import { useState } from "react";

import type {
  BestMarketResponse,
  CropCalendar,
  MspInfo,
  WeatherForecast,
} from "@/lib/api";
import { Badge, Card, Icon, SectionHeader } from "./ui";

function dayIcon(mm: number, prob: number | null) {
  if (mm >= 10 || (prob ?? 0) >= 70) return "cloudRain";
  if (mm >= 2 || (prob ?? 0) >= 40) return "cloudRain";
  return "sun";
}

export function WeatherStrip({ data }: { data: WeatherForecast | null }) {
  const t = useTranslations("weather");
  if (!data || data.source === "unavailable" || data.days.length === 0) return null;

  return (
    <Card>
      <SectionHeader
        icon="cloudRain"
        title={t("title")}
        action={
          data.sell_bias === 1 ? (
            <Badge tone="red">
              <Icon name="alert" size={13} /> {t("rain")}
            </Badge>
          ) : null
        }
      />
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {data.days.map((d, i) => (
          <div
            key={d.date}
            className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-center ${
              i === 0 ? "bg-[var(--green-100)]" : "bg-white/50"
            }`}
          >
            <span className="text-[11px] font-medium text-[var(--ink-soft)]">{d.date.slice(5)}</span>
            <Icon
              name={dayIcon(d.precip_mm, d.rain_prob)}
              size={22}
              className={d.precip_mm >= 2 ? "text-[var(--green-600)]" : "text-[var(--amber-500)]"}
            />
            <span className="text-sm font-bold">{d.temp_max_c ?? "–"}°</span>
            <span className="text-[10px] font-semibold text-[var(--green-600)]">{d.precip_mm}mm</span>
          </div>
        ))}
      </div>
      {data.current && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-white/50 px-3 py-2 text-xs text-[var(--ink-soft)]">
          <span className="font-bold uppercase tracking-wide text-[var(--green-700)]">
            {t("now")}
          </span>
          {data.current.conditions && <span>{data.current.conditions}</span>}
          {data.current.temp_c != null && (
            <span className="font-semibold text-[var(--ink)]">{data.current.temp_c}°</span>
          )}
          {data.current.feels_like_c != null && (
            <span>
              {t("feelsLike")} {data.current.feels_like_c}°
            </span>
          )}
          {data.current.humidity_pct != null && (
            <span>
              {t("humidity")} {data.current.humidity_pct}%
            </span>
          )}
        </div>
      )}
      <p className="mt-3 text-sm text-[var(--ink-soft)]">{data.note}</p>
      {data.rain_anomaly?.note && (
        <p className="mt-1 text-xs text-[var(--ink-soft)]/80">{data.rain_anomaly.note}</p>
      )}
    </Card>
  );
}

export function MspBanner({ data }: { data: MspInfo | null }) {
  const t = useTranslations("msp");
  if (!data) return null;

  if (!data.has_msp) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white/50 px-4 py-3 text-sm text-[var(--ink-soft)]">
        <Icon name="scale" size={16} className="shrink-0 text-[var(--ink-soft)]" />
        {t("noMsp", { crop: data.crop })}
      </div>
    );
  }

  const below = data.below_msp ?? false;
  const gap = Math.abs(data.gap_vs_msp ?? 0);
  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border px-4 py-3 ${
        below
          ? "border-[var(--red-500)]/40 bg-[var(--red-100)]/60"
          : "border-[var(--green-600)]/40 bg-[var(--green-100)]/60"
      }`}
    >
      <span className="flex items-center gap-2 font-heading text-sm font-bold">
        <Icon name="scale" size={16} className={below ? "text-[var(--red-500)]" : "text-[var(--green-600)]"} />
        {t("title")}: ₹{data.msp_price}
      </span>
      {data.latest_modal_price != null && (
        <span className={`text-sm font-semibold ${below ? "text-[var(--red-700)]" : "text-[var(--green-700)]"}`}>
          {below ? `${t("belowBy")} (₹${gap})` : `${t("aboveBy")} (₹${gap})`}
        </span>
      )}
      <span className="ml-auto text-xs text-[var(--ink-soft)]">{data.season}</span>
    </div>
  );
}

export function CalendarChip({ data }: { data: CropCalendar | null }) {
  const t = useTranslations("calendar");
  if (!data) return null;
  return (
    <div className="rounded-xl border border-[var(--line)] bg-white/50 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
        <span className="flex items-center gap-2 font-heading font-bold">
          <Icon name="calendar" size={16} className="text-[var(--green-600)]" />
          {t("title")}
        </span>
        <Badge tone="green">
          {t("phase")}: {data.current_phase}
        </Badge>
        {data.glut_risk && <Badge tone="amber">{t("glutWarning")}</Badge>}
      </div>
      <p className="mt-2 text-xs text-[var(--ink-soft)]">
        {t("sow")}: {data.sow_months} · {t("harvest")}: {data.harvest_months} · {t("peak")}: {data.peak_arrival_months}
      </p>
      <p className="mt-1 text-xs text-[var(--ink-soft)]/85">{data.note}</p>
    </div>
  );
}

export function BestMarketPanel({ data }: { data: BestMarketResponse | null }) {
  const t = useTranslations("bestmarket");
  const [expanded, setExpanded] = useState(false);
  if (!data || data.ranked.length === 0) return null;

  const rows = expanded ? data.ranked : data.ranked.slice(0, 3);
  return (
    <Card>
      <SectionHeader icon="truck" title={t("title")} />
      <div className="rounded-xl bg-[var(--green-100)]/70 p-4">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--green-700)]">
          <Icon name="coins" size={14} /> {t("best")}
        </div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
          <span className="font-heading text-3xl font-bold text-[var(--green-900)]">
            ₹{data.best.net_price_per_qtl}
          </span>
          <span className="flex items-center gap-1 text-sm font-medium text-[var(--ink-soft)]">
            <Icon name="pin" size={14} /> {data.best.market} · {data.best.road_km} km
          </span>
        </div>
        {data.note && (
          <p className="mt-1.5 flex items-start gap-1.5 text-sm text-[var(--ink-soft)]">
            <Icon name="spark" size={14} className="mt-0.5 shrink-0 text-[var(--amber-500)]" />
            {data.note}
          </p>
        )}
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[440px] text-left text-sm">
          <thead className="text-xs font-medium text-[var(--ink-soft)]">
            <tr className="border-b border-[var(--line)]">
              <th className="py-2 pr-3">{t("modal")}</th>
              <th className="py-2 pr-3">Market</th>
              <th className="py-2 pr-3">{t("roadDistance")}</th>
              <th className="py-2 pr-3">{t("transport")}</th>
              <th className="py-2 font-bold text-[var(--green-700)]">{t("netPrice")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.market}
                className={`border-b border-[var(--line)]/60 ${
                  data.here && r.market === data.here.market ? "bg-[var(--green-100)]/50" : ""
                }`}
              >
                <td className="py-2 pr-3">₹{r.modal_price}</td>
                <td className="py-2 pr-3 font-medium">
                  {r.market}
                  {data.here && r.market === data.here.market && (
                    <span className="ml-1 text-xs text-[var(--ink-soft)]/70">({t("sellHere")})</span>
                  )}
                </td>
                <td className="py-2 pr-3">{r.road_km} km</td>
                <td className="py-2 pr-3 text-[var(--ink-soft)]">−₹{r.transport_cost_per_qtl}</td>
                <td className="py-2 font-bold text-[var(--green-700)]">₹{r.net_price_per_qtl}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.ranked.length > 3 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-sm font-semibold text-[var(--green-700)] hover:underline"
        >
          {expanded ? t("showLess") : t("showAll")}
        </button>
      )}
      {data.freight && (
        <p className="mt-3 flex items-start gap-1.5 border-t border-[var(--line)]/60 pt-2 text-xs text-[var(--ink-soft)]">
          <Icon name="shield" size={13} className="mt-0.5 shrink-0" />
          {t("freightBasis", {
            diesel: data.freight.diesel_inr_per_l,
            rate: data.freight.rate_per_qtl_km,
            handling: data.freight.breakdown.handling,
            fuel: data.freight.breakdown.fuel,
            asOf: data.freight.as_of,
          })}
        </p>
      )}
    </Card>
  );
}

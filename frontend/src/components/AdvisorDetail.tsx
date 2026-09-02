"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAppLocale } from "@/i18n/LocaleProvider";
import {
  fetchAdvisorSummary,
  fetchCalendar,
  fetchHolidays,
  fetchMsp,
  fetchSignal,
  fetchWeather,
  type CropCalendar,
  type HolidayInfo,
  type MspInfo,
  type SellWaitSignalResponse,
  type WeatherForecast,
} from "@/lib/api";
import type { CropMarketState } from "@/lib/useCropMarket";
import { CalendarChip, MspBanner, WeatherStrip } from "./intel";
import { SignalGaugeChart } from "./SignalGaugeChart";
import { Icon, Skeleton } from "./ui";

const SIGNAL_BG: Record<SellWaitSignalResponse["recommendation"], string> = {
  sell_now: "from-[var(--green-700)] to-[var(--green-900)]",
  wait: "from-[#7a1f1f] to-[#4a1010]",
  hold: "from-[#7a5a00] to-[#4a3800]",
};

type FactorTone = "positive" | "neutral" | "negative";

function FactorCard({
  icon,
  label,
  value,
  description,
  tone = "neutral",
  index,
}: {
  icon: string;
  label: string;
  value: string;
  description: string;
  tone?: FactorTone;
  index: number;
}) {
  const toneConfig = {
    positive: {
      dot: "bg-[var(--green-600)]",
      badge: "bg-[var(--green-100)] text-[var(--green-700)]",
      border: "border-[var(--green-600)]/20",
    },
    neutral: {
      dot: "bg-[var(--amber-500)]",
      badge: "bg-[var(--amber-100)] text-[var(--amber-700)]",
      border: "border-[var(--amber-500)]/20",
    },
    negative: {
      dot: "bg-[var(--red-500)]",
      badge: "bg-[var(--red-100)] text-[var(--red-700)]",
      border: "border-[var(--red-500)]/20",
    },
  }[tone];

  return (
    <div className={`relative flex gap-4 rounded-2xl border bg-white p-4 shadow-sm ${toneConfig.border}`}>
      {/* Step number */}
      <div className="flex flex-col items-center gap-1">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-white ${toneConfig.dot}`}
        >
          {index + 1}
        </div>
        <div className={`w-0.5 flex-1 ${toneConfig.dot} opacity-20`}></div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Icon name={icon} size={16} className="text-[var(--ink-soft)]" />
            <span className="text-sm font-bold text-[var(--ink)]">{label}</span>
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${toneConfig.badge}`}>
            {value}
          </span>
        </div>
        <p className="mt-1.5 text-xs text-[var(--ink-soft)] leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

/**
 * Classify a backend reason string into a factor by keyword, so the label and
 * tone always match the sentence — the reason ORDER from the API is not fixed
 * (price → volume → [weather] → [MSP] → [holiday]).
 */
function classifyReason(reason: string, ctx: {
  weatherCaution: boolean;
  belowMsp: boolean;
  hasMsp: boolean;
  glutRisk: boolean;
  phase: string | null;
}): { key: string; icon: string; value: string; tone: FactorTone } {
  const r = reason.toLowerCase();
  if (/support price|\bmsp\b/.test(r)) {
    return {
      key: "msp",
      icon: "scale",
      value: ctx.belowMsp ? "belowMsp" : ctx.hasMsp ? "aboveMsp" : "na",
      tone: ctx.belowMsp ? "negative" : ctx.hasMsp ? "positive" : "neutral",
    };
  }
  if (/rain|weather|wet|dry spell|monsoon/.test(r)) {
    return {
      key: "weather",
      icon: "cloudRain",
      value: ctx.weatherCaution ? "caution" : "stable",
      tone: ctx.weatherCaution ? "negative" : "neutral",
    };
  }
  if (/arrival|volume|supply|glut/.test(r)) {
    return { key: "arrivals", icon: "warehouse", value: "analysed", tone: "neutral" };
  }
  if (/holiday|mandi closed|apmc/.test(r)) {
    return { key: "holiday", icon: "calendar", value: "note", tone: "neutral" };
  }
  if (/trending up|trending down|next 7 days|look flat/.test(r)) {
    const up = /trending up/.test(r);
    const down = /trending down/.test(r);
    return {
      key: "forecast",
      icon: "spark",
      value: up ? "rising" : down ? "falling" : "flat",
      tone: down ? "positive" : up ? "negative" : "neutral",
    };
  }
  if (/sow|harvest|calendar|season/.test(r)) {
    return {
      key: "calendar",
      icon: "calendar",
      value: ctx.phase ?? "na",
      tone: ctx.glutRisk ? "negative" : "neutral",
    };
  }
  // default: price momentum
  return { key: "price", icon: "chart", value: "momentum", tone: "neutral" };
}

export function AdvisorDetail({ cm }: { cm: CropMarketState }) {
  const tc = useTranslations("common");
  const ts = useTranslations("signal");
  const ta = useTranslations("advisor");
  const { locale } = useAppLocale();
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [signal, setSignal] = useState<SellWaitSignalResponse | null>(null);
  const [weather, setWeather] = useState<WeatherForecast | null>(null);
  const [msp, setMsp] = useState<MspInfo | null>(null);
  const [calendar, setCalendar] = useState<CropCalendar | null>(null);
  const [holidays, setHolidays] = useState<{ holidays: HolidayInfo[]; note: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!cm.crop || !cm.market) return;
    setLoading(true);
    setError(false);
    try {
      const sig = await fetchSignal(cm.crop, cm.market).catch(() => null);
      setSignal(sig);
      const [w, m, c, h] = await Promise.allSettled([
        fetchWeather({ market: cm.market, district: cm.district, includeAnomaly: true, lang: locale }),
        fetchMsp(cm.crop, cm.market),
        fetchCalendar(cm.crop),
        fetchHolidays(45),
      ]);
      setWeather(w.status === "fulfilled" ? w.value : null);
      setMsp(m.status === "fulfilled" ? m.value : null);
      setCalendar(c.status === "fulfilled" ? c.value : null);
      setHolidays(h.status === "fulfilled" ? h.value : null);
      if (!sig) setError(true);
      setAiSummary(null);
      fetchAdvisorSummary(cm.crop, cm.market, locale)
        .then((r) => setAiSummary(r.available ? r.summary : null))
        .catch(() => setAiSummary(null));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [cm.crop, cm.market, cm.district, locale]);

  useEffect(() => { load(); }, [load]);

  // Factor cards from signal reasons — labelled by keyword, not by position, so
  // each card matches the sentence the backend actually sent. Declared before
  // any early return so hook order stays stable.
  const factors = useMemo(() => {
    if (!signal) return [];
    const ctx = {
      weatherCaution: weather?.sell_bias === 1,
      belowMsp: Boolean(msp?.below_msp),
      hasMsp: Boolean(msp?.has_msp),
      glutRisk: Boolean(calendar?.glut_risk),
      phase: calendar?.current_phase ?? null,
    };
    return signal.reasons.map((reason) => {
      const c = classifyReason(reason, ctx);
      const rawValue = ["momentum", "analysed", "note", "caution", "stable", "belowMsp", "aboveMsp", "na", "rising", "falling", "flat"].includes(c.value)
        ? ta(`value_${c.value}` as
            | "value_momentum" | "value_analysed" | "value_note" | "value_caution"
            | "value_stable" | "value_belowMsp" | "value_aboveMsp" | "value_na"
            | "value_rising" | "value_falling" | "value_flat")
        : c.value; // calendar phase string comes straight from the API
      return {
        icon: c.icon,
        label: ta(`factor_${c.key}` as
          | "factor_price" | "factor_arrivals" | "factor_weather"
          | "factor_msp" | "factor_calendar" | "factor_holiday" | "factor_forecast"),
        value: rawValue,
        description: reason,
        tone: c.tone,
      };
    });
  }, [signal, weather?.sell_bias, msp?.below_msp, msp?.has_msp, calendar?.glut_risk, calendar?.current_phase, ta]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error && !signal) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl border-2 border-[var(--red-500)]/30 bg-[var(--red-100)] px-5 py-4 text-[var(--red-700)]">
        <p className="font-semibold">{tc("error")}</p>
        <button
          type="button"
          onClick={load}
          className="rounded-xl border-2 border-[var(--red-500)]/50 bg-white px-4 py-2 text-sm font-semibold"
        >
          {tc("retry")}
        </button>
      </div>
    );
  }

  const bgGradient = signal ? SIGNAL_BG[signal.recommendation] : "from-[var(--green-700)] to-[var(--green-900)]";
  const recLabel = signal ? ts(signal.recommendation).toUpperCase() : "—";

  return (
    <div className="flex flex-col gap-6">
      {/* Hero Recommendation Card */}
      {signal && (
        <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${bgGradient} p-6 text-white shadow-xl`}>
          {/* Decorative circles */}
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5"></div>
          <div className="absolute -bottom-5 right-16 h-24 w-24 rounded-full bg-white/5"></div>

          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-10">
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-widest text-white/50">
                {ta("recommendation")}
              </p>
              <div className="mt-2 font-heading text-5xl font-extrabold tracking-tight">
                {recLabel}
              </div>
              <div className="mt-3 flex items-center gap-2 flex-wrap text-sm">
                {signal.days_of_data > 0 && (
                  <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1">
                    <div className="h-2 w-2 rounded-full bg-[var(--amber-500)]"></div>
                    <span>{ta("daysOfData", { n: signal.days_of_data })}</span>
                  </div>
                )}
                {signal.current_price > 0 && (
                  <span className="text-white/60">· {ta("current")}: ₹{signal.current_price.toFixed(0)}/qtl</span>
                )}
              </div>
            </div>

            <div className="w-48 shrink-0 self-center">
              <SignalGaugeChart recommendation={signal.recommendation} />
            </div>
          </div>
        </div>
      )}

      {/* Plain-language summary (LLM readability layer; hidden without a key) */}
      {aiSummary && (
        <div className="rounded-2xl border border-[var(--green-600)]/25 bg-[var(--green-50)] p-5">
          <div className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--green-700)]">
            <Icon name="spark" size={14} /> {ta("aiSummary")}
          </div>
          <p className="text-sm leading-relaxed text-[var(--ink)]">{aiSummary}</p>
        </div>
      )}

      {/* MSP Banner */}
      <MspBanner data={msp} />

      {/* Decision Breakdown Timeline */}
      {factors.length > 0 && (
        <div>
          <h2 className="mb-4 font-heading text-base font-bold text-[var(--ink)]">
            <Icon name="spark" size={16} className="mr-2 inline text-[var(--amber-500)]" />
            {ta("breakdown")}
          </h2>
          <div className="flex flex-col gap-3">
            {factors.map((f, i) => (
              <FactorCard key={f.label} {...f} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Calendar */}
      <CalendarChip data={calendar} />

      {/* Weather Detail */}
      <WeatherStrip data={weather} />

      {/* Holiday Notice */}
      {holidays?.note && (
        <div className="flex items-start gap-3 rounded-2xl border border-[var(--amber-500)]/30 bg-[var(--amber-100)]/60 px-5 py-4 text-sm text-[var(--amber-700)]">
          <Icon name="calendar" size={18} className="mt-0.5 shrink-0" />
          <span>{holidays.note}</span>
        </div>
      )}
    </div>
  );
}

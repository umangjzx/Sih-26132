"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import {
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

const SIGNAL_LABEL: Record<SellWaitSignalResponse["recommendation"], string> = {
  sell_now: "SELL NOW",
  wait: "WAIT",
  hold: "HOLD",
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

export function AdvisorDetail({ cm }: { cm: CropMarketState }) {
  const tc = useTranslations("common");
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
        fetchWeather({ market: cm.market, includeAnomaly: true }),
        fetchMsp(cm.crop, cm.market),
        fetchCalendar(cm.crop),
        fetchHolidays(45),
      ]);
      setWeather(w.status === "fulfilled" ? w.value : null);
      setMsp(m.status === "fulfilled" ? m.value : null);
      setCalendar(c.status === "fulfilled" ? c.value : null);
      setHolidays(h.status === "fulfilled" ? h.value : null);
      if (!sig) setError(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [cm.crop, cm.market]);

  useEffect(() => { load(); }, [load]);

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

  // Build factor cards from signal reasons
  const factors: Array<{
    icon: string;
    label: string;
    value: string;
    description: string;
    tone: FactorTone;
  }> = [];

  if (signal) {
    // Price momentum
    factors.push({
      icon: "chart",
      label: "Price Momentum",
      value: signal.recommendation === "sell_now" ? "Positive" : signal.recommendation === "hold" ? "Neutral" : "Negative",
      description: signal.reasons[0] ?? "Based on current price trend vs previous period.",
      tone: signal.recommendation === "sell_now" ? "positive" : signal.recommendation === "hold" ? "neutral" : "negative",
    });

    if (signal.reasons[1]) {
      factors.push({
        icon: "cloudRain",
        label: "Weather Pressure",
        value: weather?.sell_bias === 1 ? "Caution" : "Stable",
        description: signal.reasons[1],
        tone: weather?.sell_bias === 1 ? "negative" : "neutral",
      });
    }

    if (signal.reasons[2]) {
      factors.push({
        icon: "scale",
        label: "MSP Comparison",
        value: msp?.below_msp ? "Below MSP" : msp?.has_msp ? "Above MSP" : "N/A",
        description: signal.reasons[2],
        tone: msp?.below_msp ? "negative" : msp?.has_msp ? "positive" : "neutral",
      });
    }

    if (signal.reasons[3]) {
      factors.push({
        icon: "calendar",
        label: "Crop Calendar",
        value: calendar?.current_phase ?? "N/A",
        description: signal.reasons[3],
        tone: calendar?.glut_risk ? "negative" : "neutral",
      });
    }

    if (signal.reasons.slice(4).length > 0) {
      factors.push({
        icon: "chart",
        label: "Arrival Trend",
        value: "Analysed",
        description: signal.reasons.slice(4).join(" "),
        tone: "neutral",
      });
    }
  }

  const bgGradient = signal ? SIGNAL_BG[signal.recommendation] : "from-[var(--green-700)] to-[var(--green-900)]";
  const recLabel = signal ? SIGNAL_LABEL[signal.recommendation] : "—";

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
                Our Recommendation
              </p>
              <div className="mt-2 font-heading text-5xl font-extrabold tracking-tight">
                {recLabel}
              </div>
              <div className="mt-3 flex items-center gap-2 flex-wrap text-sm">
                {signal.days_of_data > 0 && (
                  <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1">
                    <div className="h-2 w-2 rounded-full bg-[var(--amber-500)]"></div>
                    <span>{signal.days_of_data}d of data</span>
                  </div>
                )}
                {signal.current_price > 0 && (
                  <span className="text-white/60">· Current: ₹{signal.current_price.toFixed(0)}/qtl</span>
                )}
              </div>
            </div>

            <div className="w-48 shrink-0 self-center">
              <SignalGaugeChart recommendation={signal.recommendation} />
            </div>
          </div>
        </div>
      )}

      {/* MSP Banner */}
      <MspBanner data={msp} />

      {/* Decision Breakdown Timeline */}
      {factors.length > 0 && (
        <div>
          <h2 className="mb-4 font-heading text-base font-bold text-[var(--ink)]">
            <Icon name="spark" size={16} className="mr-2 inline text-[var(--amber-500)]" />
            Decision Breakdown
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

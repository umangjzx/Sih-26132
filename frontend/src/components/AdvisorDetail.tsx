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
import { SellWaitSignalCard } from "./SellWaitSignalCard";

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
        fetchWeather(cm.market, { includeAnomaly: true }),
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

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div data-testid="skeleton" role="status" aria-label={tc("loading")} className="h-44 w-full animate-pulse rounded-lg bg-stone-200" />
        <div className="h-40 w-full animate-pulse rounded-lg bg-stone-200" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {error && !signal && (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border-2 border-red-300 bg-red-50 px-4 py-3 text-red-800">
          <p>{tc("error")}</p>
          <button type="button" onClick={load} className="rounded-lg border-2 border-red-400 bg-white px-4 py-2 text-sm font-semibold">
            {tc("retry")}
          </button>
        </div>
      )}

      <MspBanner data={msp} />
      <CalendarChip data={calendar} />
      {signal && <SellWaitSignalCard signal={signal} />}
      <WeatherStrip data={weather} />

      {holidays?.note && (
        <div className="rounded-xl border border-[var(--color-hold)]/40 bg-[var(--color-hold)]/10 px-4 py-3 text-sm text-[var(--color-hold)]">
          📅 {holidays.note}
        </div>
      )}
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fetchNearby,
  fetchOptions,
  fetchSignal,
  fetchTrend,
  type CropMarketOption,
  type NearestMarketComparison,
  type PriceTrendResponse,
  type SellWaitSignalResponse,
} from "@/lib/api";
import { NearbyMarketsTable } from "./NearbyMarketsTable";
import { PriceTrendChart } from "./PriceTrendChart";
import { SellWaitSignalCard } from "./SellWaitSignalCard";

const DAY_OPTIONS = [7, 30, 90] as const;

function Skeleton({ className = "" }: { className?: string }) {
  const tc = useTranslations("common");
  return (
    <div
      data-testid="skeleton"
      role="status"
      aria-label={tc("loading")}
      className={`animate-pulse rounded-lg bg-stone-200 ${className}`}
    />
  );
}

export function PriceDashboard() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");

  const [options, setOptions] = useState<CropMarketOption[]>([]);
  const [crop, setCrop] = useState<string>("");
  const [market, setMarket] = useState<string>("");
  const [days, setDays] = useState<(typeof DAY_OPTIONS)[number]>(30);

  const [trend, setTrend] = useState<PriceTrendResponse | null>(null);
  const [signal, setSignal] = useState<SellWaitSignalResponse | null>(null);
  const [nearby, setNearby] = useState<NearestMarketComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const crops = useMemo(() => [...new Set(options.map((o) => o.crop))].sort(), [options]);
  const marketsForCrop = useMemo(
    () => options.filter((o) => o.crop === crop).map((o) => o.market),
    [options, crop],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      // Recover a failed (or first-ever) options fetch: if we have no options
      // yet, fetch them and seed the selection, then let the dep change re-run
      // load() for the trend/signal/nearby calls.
      if (options.length === 0) {
        const opts = await fetchOptions();
        setOptions(opts);
        if (opts.length > 0) {
          setCrop(opts[0].crop);
          setMarket(opts[0].market);
        }
        return;
      }

      if (!crop || !market) return;

      const district = options.find((o) => o.crop === crop && o.market === market)?.district ?? "";

      const [trendRes, signalRes, nearbyRes] = await Promise.all([
        fetchTrend(crop, market, days),
        fetchSignal(crop, market),
        fetchNearby(crop, district),
      ]);
      setTrend(trendRes);
      setSignal(signalRes);
      setNearby(nearbyRes);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [crop, market, days, options]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">{t("title")}</h1>
        <p className="mt-1 text-stone-600">{t("subtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-stone-700">
          {t("selectCrop")}
          <select
            value={crop}
            onChange={(e) => {
              const nextCrop = e.target.value;
              setCrop(nextCrop);
              const firstMarket = options.find((o) => o.crop === nextCrop)?.market ?? "";
              setMarket(firstMarket);
            }}
            className="min-w-40 rounded-lg border-2 border-stone-300 bg-white px-3 py-2 text-base font-semibold text-stone-800 focus:border-green-700 focus:outline-none"
          >
            {crops.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-stone-700">
          {t("selectMarket")}
          <select
            value={market}
            onChange={(e) => setMarket(e.target.value)}
            className="min-w-40 rounded-lg border-2 border-stone-300 bg-white px-3 py-2 text-base font-semibold text-stone-800 focus:border-green-700 focus:outline-none"
          >
            {marketsForCrop.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end gap-2" role="group" aria-label="date-range">
          {DAY_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-lg border-2 px-4 py-2 text-sm font-semibold transition-colors ${
                days === d
                  ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-white"
                  : "border-stone-300 bg-white text-stone-700"
              }`}
            >
              {t(`days${d}` as "days7" | "days30" | "days90")}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-lg border-2 border-red-300 bg-red-50 px-4 py-3 text-red-800"
        >
          <p>{tc("error")}</p>
          <button
            type="button"
            onClick={() => load()}
            className="rounded-lg border-2 border-red-400 bg-white px-4 py-2 text-sm font-semibold text-red-800"
          >
            {tc("retry")}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <>
          {trend && trend.points.length > 0 ? (
            <section className="rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold">
                  {trend.crop} · {trend.market}
                </h2>
                <span className="text-sm text-stone-500">
                  {t("asOf")}: {trend.points[trend.points.length - 1]?.date}
                </span>
              </div>
              <PriceTrendChart points={trend.points} />
              <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div>
                  <dt className="text-xs text-stone-500">{t("minPrice")}</dt>
                  <dd className="text-lg font-bold">₹{trend.points[trend.points.length - 1]?.min_price.toFixed(0)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-stone-500">{t("modalPrice")}</dt>
                  <dd className="text-lg font-bold text-[var(--color-brand)]">
                    ₹{trend.points[trend.points.length - 1]?.modal_price.toFixed(0)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-stone-500">{t("maxPrice")}</dt>
                  <dd className="text-lg font-bold">₹{trend.points[trend.points.length - 1]?.max_price.toFixed(0)}</dd>
                </div>
              </dl>
              <p className="mt-1 text-center text-xs text-stone-500">{t("perQuintal")}</p>
            </section>
          ) : (
            <p className="rounded-lg border-2 border-[var(--color-border)] bg-white px-4 py-3 text-stone-600">
              {t("noData")}
            </p>
          )}

          {signal && <SellWaitSignalCard signal={signal} />}

          {nearby.length > 0 && <NearbyMarketsTable markets={nearby} />}
        </>
      )}
    </div>
  );
}

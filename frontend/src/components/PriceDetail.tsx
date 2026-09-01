"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import {
  fetchBestMarkets,
  fetchNearby,
  fetchTrend,
  type BestMarketResponse,
  type NearestMarketComparison,
  type PriceTrendResponse,
} from "@/lib/api";
import type { CropMarketState } from "@/lib/useCropMarket";
import { BestMarketPanel } from "./intel";
import { NearbyMarketsTable } from "./NearbyMarketsTable";
import { PriceTrendChart } from "./PriceTrendChart";

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

export function PriceDetail({ cm }: { cm: CropMarketState }) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const [days, setDays] = useState<(typeof DAY_OPTIONS)[number]>(30);

  const [trend, setTrend] = useState<PriceTrendResponse | null>(null);
  const [nearby, setNearby] = useState<NearestMarketComparison[]>([]);
  const [best, setBest] = useState<BestMarketResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!cm.crop || !cm.market) return;
    setLoading(true);
    setError(false);
    try {
      const [trendRes, nearbyRes] = await Promise.all([
        fetchTrend(cm.crop, cm.market, days),
        fetchNearby(cm.crop, cm.district),
      ]);
      setTrend(trendRes);
      setNearby(nearbyRes);
      const b = await fetchBestMarkets(cm.crop, cm.market, true).catch(() => null);
      setBest(b);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [cm.crop, cm.market, cm.district, days]);

  useEffect(() => {
    load();
  }, [load]);

  const last = trend?.points[trend.points.length - 1];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end gap-2" role="group" aria-label="date-range">
        {DAY_OPTIONS.map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold shadow-sm transition-all ${
              days === d
                ? "bg-[var(--color-brand)] text-white ring-2 ring-[var(--color-brand)] ring-offset-1"
                : "bg-[var(--color-surface)] backdrop-blur-md text-[var(--color-text)] border border-[var(--color-border)] hover:bg-white/90"
            }`}
          >
            {t(`days${d}` as "days7" | "days30" | "days90")}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border-2 border-red-300 bg-red-50 px-4 py-3 text-red-800">
          <p>{tc("error")}</p>
          <button type="button" onClick={load} className="rounded-lg border-2 border-red-400 bg-white px-4 py-2 text-sm font-semibold">
            {tc("retry")}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <>
          {trend && trend.points.length > 0 ? (
            <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] backdrop-blur-xl p-6 shadow-xl">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-bold font-heading">
                  {trend.crop} · {trend.market}
                </h2>
                <span className="text-sm text-stone-500">
                  {t("asOf")}: {last?.date}
                </span>
              </div>
              <PriceTrendChart points={trend.points} />
              <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div>
                  <dt className="text-xs text-stone-500">{t("minPrice")}</dt>
                  <dd className="text-lg font-bold">₹{last?.min_price.toFixed(0)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-stone-500">{t("modalPrice")}</dt>
                  <dd className="text-lg font-bold text-[var(--color-brand)]">₹{last?.modal_price.toFixed(0)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-stone-500">{t("maxPrice")}</dt>
                  <dd className="text-lg font-bold">₹{last?.max_price.toFixed(0)}</dd>
                </div>
              </dl>
              <p className="mt-2 text-center text-xs text-stone-500 font-medium">{t("perQuintal")}</p>
            </section>
          ) : (
            <p className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-4 text-stone-600 shadow-md">
              {t("noData")}
            </p>
          )}

          <BestMarketPanel data={best} />
          {nearby.length > 0 && <NearbyMarketsTable markets={nearby} />}
        </>
      )}
    </div>
  );
}

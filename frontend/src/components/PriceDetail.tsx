"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import {
  fetchBestMarkets,
  fetchForecast,
  fetchNearby,
  fetchTrend,
  type BestMarketResponse,
  type NearestMarketComparison,
  type PriceForecast,
  type PriceTrendResponse,
} from "@/lib/api";
import type { CropMarketState } from "@/lib/useCropMarket";
import { BestMarketPanel } from "./intel";
import { MarketComparisonChart } from "./MarketComparisonChart";
import { PriceTrendChart } from "./PriceTrendChart";
import { Card, SectionHeader, Skeleton } from "./ui";

const DAY_OPTIONS = [7, 30, 90] as const;

export function PriceDetail({ cm }: { cm: CropMarketState }) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const [days, setDays] = useState<(typeof DAY_OPTIONS)[number]>(30);

  const [trend, setTrend] = useState<PriceTrendResponse | null>(null);
  const [forecast, setForecast] = useState<PriceForecast | null>(null);
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
      fetchForecast(cm.crop, cm.market, 30)
        .then((f) => setForecast(f.available ? f : null))
        .catch(() => setForecast(null));
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
            <Card>
              <SectionHeader
                icon="chart"
                title={`${trend.crop} · ${trend.market}`}
                action={
                  <span className="text-sm text-[var(--ink-soft)]">
                    {t("asOf")}: {last?.date}
                  </span>
                }
              />
              <PriceTrendChart points={trend.points} forecast={forecast?.points} />
              {forecast?.note && (
                <p className="mt-2 flex items-center justify-center gap-1.5 text-xs font-medium text-[var(--amber-700)]">
                  <span className="h-2 w-4 rounded-full border-b-2 border-dashed border-[var(--amber-600)]" />
                  {forecast.note}
                </p>
              )}
              <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div>
                  <dt className="text-xs text-[var(--ink-soft)]">{t("minPrice")}</dt>
                  <dd className="font-heading text-lg font-bold">₹{last?.min_price.toFixed(0)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--ink-soft)]">{t("modalPrice")}</dt>
                  <dd className="font-heading text-lg font-bold text-[var(--green-700)]">
                    ₹{last?.modal_price.toFixed(0)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--ink-soft)]">{t("maxPrice")}</dt>
                  <dd className="font-heading text-lg font-bold">₹{last?.max_price.toFixed(0)}</dd>
                </div>
              </dl>
              <p className="mt-2 text-center text-xs font-medium text-[var(--ink-soft)]">{t("perQuintal")}</p>
            </Card>
          ) : (
            <Card>{t("noData")}</Card>
          )}

          <BestMarketPanel data={best} />
          {nearby.length > 0 && last && (
            <Card>
              <SectionHeader icon="map" title="Nearby Markets Comparison" />
              <MarketComparisonChart
                markets={nearby}
                currentMarket={cm.market}
                currentPrice={last.modal_price}
              />
            </Card>
          )}
        </>
      )}
    </div>
  );
}

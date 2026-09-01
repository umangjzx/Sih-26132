"use client";

/** Public statewide price-transparency dashboard (v1.1). No login. Sharable. */

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, EmptyState, Icon, SectionHeader, Skeleton, Stat } from "@/components/ui";
import { fetchPublicOverview, type PublicOverview } from "@/lib/api";

function MoverList({
  title,
  icon,
  rows,
}: {
  title: string;
  icon: string;
  rows: { crop: string; avg_modal_price: number; change_7d_pct: number }[];
}) {
  return (
    <Card>
      <SectionHeader icon={icon} title={title} />
      <ul className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <li key={r.crop} className="flex items-center justify-between text-sm">
            <span className="font-medium">{r.crop}</span>
            <span className="flex items-center gap-2">
              <span className="text-[var(--ink-soft)]">₹{r.avg_modal_price}</span>
              <span
                className={`flex items-center gap-0.5 font-bold ${
                  r.change_7d_pct >= 0 ? "text-[var(--green-600)]" : "text-[var(--red-500)]"
                }`}
              >
                <Icon name={r.change_7d_pct >= 0 ? "arrowUp" : "arrowDown"} size={13} />
                {Math.abs(r.change_7d_pct)}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function ExplorePage() {
  const t = useTranslations("explore");
  const [data, setData] = useState<PublicOverview | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      setData(await fetchPublicOverview());
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <EmptyState icon="map">{t("noData")}</EmptyState>;
  if (!data)
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-52" />
      </div>
    );

  const a = data.activity;
  const chart = data.price_trend.map((p) => ({ date: p.date.slice(5), avg: p.avg_modal_price }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-3xl font-extrabold tracking-tight text-[var(--green-900)]">
          {t("title")}
        </h1>
        <p className="mt-1 text-[var(--ink-soft)]">{t("subtitle")}</p>
        {data.as_of && (
          <p className="mt-1 text-xs text-[var(--ink-soft)]/70">
            {t("asOf")}: {data.as_of}
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <Stat label={t("marketsReporting")} value={a.markets_reporting ?? 0} />
        <Stat label={t("cropsTracked")} value={a.crops_tracked ?? 0} />
        <Stat label={t("openLots")} value={a.open_lots ?? 0} />
        <Stat label={t("openDemands")} value={a.open_demands ?? 0} />
        <Stat label={t("deals")} value={a.total_deals ?? 0} />
        <Stat label={t("openDisputes")} value={a.open_disputes ?? 0} />
      </div>

      {chart.length > 1 && (
        <Card>
          <SectionHeader icon="chart" title={t("statewideTrend")} />
          <div className="h-52 w-full" role="img" aria-label={t("statewideTrend")}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
                <YAxis tick={{ fontSize: 11 }} width={52} />
                <Tooltip contentStyle={{ fontSize: 13, borderRadius: 10 }} />
                <Line
                  type="monotone"
                  dataKey="avg"
                  stroke="var(--green-600)"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {(data.gainers.length > 0 || data.losers.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          <MoverList title={t("gainers")} icon="arrowUp" rows={data.gainers} />
          <MoverList title={t("losers")} icon="arrowDown" rows={data.losers} />
        </div>
      )}

      <Card>
        <SectionHeader icon="scale" title={t("allCrops")} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[380px] text-left text-sm">
            <thead className="text-xs font-medium text-[var(--ink-soft)]">
              <tr className="border-b border-[var(--line)]">
                <th className="py-2 pr-3">{t("crop")}</th>
                <th className="py-2 pr-3">{t("price")}</th>
                <th className="py-2">{t("change")}</th>
              </tr>
            </thead>
            <tbody>
              {data.crops.map((c) => (
                <tr key={c.crop} className="border-b border-[var(--line)]/60">
                  <td className="py-2 pr-3 font-medium">{c.crop}</td>
                  <td className="py-2 pr-3">₹{c.avg_modal_price}</td>
                  <td className="py-2">
                    {c.change_7d_pct == null ? (
                      <span className="text-[var(--ink-soft)]/50">—</span>
                    ) : (
                      <span
                        className={
                          c.change_7d_pct >= 0 ? "text-[var(--green-600)]" : "text-[var(--red-500)]"
                        }
                      >
                        {c.change_7d_pct >= 0 ? "+" : ""}
                        {c.change_7d_pct}%
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

"use client";

/** Public statewide price-transparency dashboard (v1.1). No login. Sharable. */

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
  Cell,
} from "recharts";

import { Card, EmptyState, Icon, SectionHeader, Skeleton, Stat } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { fetchPublicOverview, type PublicOverview } from "@/lib/api";
import { useLocation } from "@/lib/useLocation";

function MoverChart({
  title,
  icon,
  rows,
  isGainer,
}: {
  title: string;
  icon: string;
  rows: { crop: string; avg_modal_price: number; change_7d_pct: number }[];
  isGainer: boolean;
}) {
  return (
    <Card>
      <SectionHeader icon={icon} title={title} />
      <div className="h-48 w-full mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 30, left: -20, bottom: 0 }}>
            <XAxis type="number" hide />
            <YAxis dataKey="crop" type="category" axisLine={false} tickLine={false} width={100} tick={{ fontSize: 12, fill: "var(--ink-soft)", fontWeight: 500 }} />
            <Tooltip
              cursor={{ fill: "rgba(0,0,0,0.02)" }}
              formatter={(value) => [`${Math.abs(Number(value))}%`, isGainer ? "Gain" : "Loss"]}
              contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "var(--shadow-md)" }}
            />
            <Bar dataKey="change_7d_pct" radius={4} barSize={20} isAnimationActive={false}>
              {rows.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={isGainer ? "var(--green-600)" : "var(--red-500)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export default function ExplorePage() {
  const t = useTranslations("explore");
  const { location, warmTick } = useLocation();
  const [data, setData] = useState<PublicOverview | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      setData(await fetchPublicOverview(location?.state));
    } catch {
      setError(true);
    }
  }, [location?.state, warmTick]);

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
      <PageHeader
        icon="globe"
        title={t("title")}
        subtitle={t("subtitle")}
      />
      {a.state && (
        <p className="-mt-4 mb-2 text-xs font-semibold text-[var(--green-700)]">
          {t("showing")}: {a.state}
        </p>
      )}
      {data.as_of && (
        <p className="-mt-4 mb-2 text-xs text-[var(--ink-soft)]/70">
          {t("asOf")}: {data.as_of}
        </p>
      )}

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
              <AreaChart data={chart} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--green-600)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--green-600)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--ink-soft)" }} axisLine={false} minTickGap={24} />
                <YAxis tick={{ fontSize: 11, fill: "var(--ink-soft)" }} axisLine={false} width={52} />
                <Tooltip contentStyle={{ fontSize: 13, borderRadius: 10, border: "none", boxShadow: "var(--shadow-md)" }} />
                <Area
                  type="monotone"
                  dataKey="avg"
                  stroke="var(--green-600)"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorAvg)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {(data.gainers.length > 0 || data.losers.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          <MoverChart title={t("gainers")} icon="arrowUp" rows={data.gainers} isGainer={true} />
          <MoverChart title={t("losers")} icon="arrowDown" rows={data.losers.map(r => ({ ...r, change_7d_pct: Math.abs(r.change_7d_pct) }))} isGainer={false} />
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

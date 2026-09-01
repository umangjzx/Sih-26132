"use client";

/**
 * Public statewide price-transparency dashboard (v1.1). No login. Sharable.
 */

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

import { fetchPublicOverview, type PublicOverview } from "@/lib/api";

const card =
  "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] backdrop-blur-xl p-5 shadow-lg";

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white/50 p-3 text-center">
      <div className="font-heading text-2xl font-bold text-[var(--color-brand-dark)]">{value}</div>
      <div className="text-[11px] text-stone-500">{label}</div>
    </div>
  );
}

function MoverList({
  title,
  rows,
}: {
  title: string;
  rows: { crop: string; avg_modal_price: number; change_7d_pct: number }[];
}) {
  return (
    <div className={card}>
      <h2 className="mb-2 font-heading text-sm font-bold">{title}</h2>
      <ul className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <li key={r.crop} className="flex items-center justify-between text-sm">
            <span className="font-medium">{r.crop}</span>
            <span className="flex items-center gap-2">
              <span className="text-stone-500">₹{r.avg_modal_price}</span>
              <span
                className={`font-bold ${
                  r.change_7d_pct >= 0 ? "text-[var(--color-sell)]" : "text-[var(--color-wait)]"
                }`}
              >
                {r.change_7d_pct >= 0 ? "▲" : "▼"} {Math.abs(r.change_7d_pct)}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
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

  if (error) {
    return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{t("noData")}</p>;
  }
  if (!data) return <p className="text-sm opacity-60">…</p>;

  const a = data.activity;
  const chart = data.price_trend.map((p) => ({ date: p.date.slice(5), avg: p.avg_modal_price }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-stone-600">{t("subtitle")}</p>
        {data.as_of && (
          <p className="mt-1 text-xs text-stone-400">
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
        <section className={card}>
          <h2 className="mb-2 font-heading text-sm font-bold">{t("statewideTrend")}</h2>
          <div className="h-52 w-full" role="img" aria-label={t("statewideTrend")}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
                <YAxis tick={{ fontSize: 11 }} width={52} />
                <Tooltip contentStyle={{ fontSize: 13, borderRadius: 8 }} />
                <Line
                  type="monotone"
                  dataKey="avg"
                  stroke="var(--color-brand)"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {(data.gainers.length > 0 || data.losers.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          <MoverList title={t("gainers")} rows={data.gainers} />
          <MoverList title={t("losers")} rows={data.losers} />
        </div>
      )}

      <section className={card}>
        <h2 className="mb-3 font-heading text-sm font-bold">{t("allCrops")}</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[380px] text-left text-sm">
            <thead className="text-xs text-stone-500">
              <tr>
                <th className="py-1.5 pr-3">{t("crop")}</th>
                <th className="py-1.5 pr-3">{t("price")}</th>
                <th className="py-1.5">{t("change")}</th>
              </tr>
            </thead>
            <tbody>
              {data.crops.map((c) => (
                <tr key={c.crop} className="border-t border-[var(--color-border)]">
                  <td className="py-1.5 pr-3 font-medium">{c.crop}</td>
                  <td className="py-1.5 pr-3">₹{c.avg_modal_price}</td>
                  <td className="py-1.5">
                    {c.change_7d_pct == null ? (
                      <span className="text-stone-400">—</span>
                    ) : (
                      <span
                        className={
                          c.change_7d_pct >= 0
                            ? "text-[var(--color-sell)]"
                            : "text-[var(--color-wait)]"
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
      </section>
    </div>
  );
}

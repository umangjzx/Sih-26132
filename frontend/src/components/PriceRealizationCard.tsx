"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { fetchRealization, type RealizationReport } from "@/lib/api";
import { Card, Icon, SectionHeader, Skeleton } from "./ui";

function pct(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

export function PriceRealizationCard({ token }: { token: string }) {
  const t = useTranslations("realization");
  const [report, setReport] = useState<RealizationReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReport(await fetchRealization(token));
    } catch {
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <Card>
        <SectionHeader icon="coins" title={t("title")} />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="mt-3 h-52 w-full" />
      </Card>
    );
  }

  if (!report || report.deals.length === 0) {
    return (
      <Card>
        <SectionHeader icon="coins" title={t("title")} />
        <p className="text-sm text-[var(--ink-soft)]">{t("noDeals")}</p>
      </Card>
    );
  }

  const s = report.summary;
  const uplift = s.uplift_vs_mandi_pct;
  const upliftGood = (uplift ?? 0) >= 0;

  const chartData = report.deals
    .filter((d) => d.completed && d.mandi_benchmark_per_qtl != null)
    .map((d) => ({
      name: `${d.crop} ${d.date.slice(5)}`,
      [t("realized")]: d.realized_per_qtl,
      [t("mandi")]: d.mandi_benchmark_per_qtl,
      ...(d.msp_per_qtl != null ? { [t("msp")]: d.msp_per_qtl } : {}),
    }));

  return (
    <Card>
      <SectionHeader icon="coins" title={t("title")} />
      <p className="-mt-2 mb-3 text-sm text-[var(--ink-soft)]">{t("subtitle")}</p>

      {/* headline uplift */}
      <div
        className={`rounded-xl p-4 ${
          upliftGood ? "bg-[var(--green-100)]/60" : "bg-[var(--amber-100)]/60"
        }`}
      >
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)]">
          <Icon name={upliftGood ? "arrowUp" : "arrowDown"} size={14} />
          {t("upliftLabel")}
        </div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
          <span
            className={`font-heading text-3xl font-extrabold ${
              upliftGood ? "text-[var(--green-800)]" : "text-[var(--amber-700)]"
            }`}
          >
            {pct(uplift)}
          </span>
          <span className="text-sm text-[var(--ink-soft)]">
            {t("completedCount", { n: s.deals_completed })} ·{" "}
            {t("totalValue")} ₹{s.total_value_inr.toLocaleString()} ·{" "}
            {t("volume")} {(s.total_quantity_kg / 100).toFixed(0)} qtl
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-2 text-xs">
          {s.best_deal && (
            <span className="rounded-full bg-white/70 px-2 py-0.5 font-medium text-[var(--green-700)]">
              {t("bestDeal", { crop: s.best_deal.crop, pct: pct(s.best_deal.vs_mandi_pct) })}
            </span>
          )}
          {s.below_msp_deals > 0 && (
            <span className="rounded-full bg-white/70 px-2 py-0.5 font-medium text-[var(--red-700)]">
              {t("belowMsp", { n: s.below_msp_deals })}
            </span>
          )}
        </div>
      </div>

      {/* per-deal comparison */}
      {chartData.length > 0 && (
        <div className="mt-4 h-60 w-full" role="img" aria-label={t("title")}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--ink-soft)" }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--ink-soft)" }} tickLine={false} axisLine={false} width={48} />
              <Tooltip
                formatter={(v) => `₹${Number(v).toFixed(0)}`}
                contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "var(--shadow-md)" }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey={t("realized")} fill="var(--green-600)" radius={[3, 3, 0, 0]} />
              <Bar dataKey={t("mandi")} fill="var(--ink-soft)" radius={[3, 3, 0, 0]} />
              <Bar dataKey={t("msp")} fill="var(--amber-500)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* per-deal table */}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead className="text-xs font-medium text-[var(--ink-soft)]">
            <tr className="border-b border-[var(--line)]">
              <th className="py-2 pr-3">{t("colDeal")}</th>
              <th className="py-2 pr-3">{t("colYouGot")}</th>
              <th className="py-2 pr-3">{t("colMandi")}</th>
              <th className="py-2">{t("colGap")}</th>
            </tr>
          </thead>
          <tbody>
            {report.deals.map((d) => (
              <tr key={d.deal_id} className="border-b border-[var(--line)]/60">
                <td className="py-2 pr-3 font-medium">
                  {d.crop} <span className="text-xs text-[var(--ink-soft)]">{d.date.slice(5)}</span>
                  {!d.completed && (
                    <span className="ml-1 rounded-full bg-[var(--amber-100)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--amber-700)]">
                      {t("pending")}
                    </span>
                  )}
                </td>
                <td className="py-2 pr-3 tabular-nums">₹{d.realized_per_qtl.toFixed(0)}</td>
                <td className="py-2 pr-3 tabular-nums text-[var(--ink-soft)]">
                  {d.mandi_benchmark_per_qtl != null ? `₹${d.mandi_benchmark_per_qtl.toFixed(0)}` : "—"}
                </td>
                <td
                  className={`py-2 font-semibold tabular-nums ${
                    d.vs_mandi_pct == null
                      ? "text-[var(--ink-soft)]"
                      : d.vs_mandi_pct >= 0
                      ? "text-[var(--green-700)]"
                      : "text-[var(--red-600)]"
                  }`}
                >
                  {pct(d.vs_mandi_pct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 flex items-start gap-1.5 border-t border-[var(--line)]/60 pt-2 text-xs text-[var(--ink-soft)]">
        <Icon name="shield" size={13} className="mt-0.5 shrink-0" />
        {t("basisNote")}
      </p>
    </Card>
  );
}

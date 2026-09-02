"use client";

/**
 * Admin oversight dashboard (Phase 3, ADMIN-01) — read only.
 *
 * Aggregate counts, a 30-day average-modal-price sparkline, and the open-dispute
 * queue from GET /api/admin/dashboard. Non-admins are redirected to /login.
 * Client component (Cordova constraint).
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { useAuth } from "@/components/AuthProvider";
import {
  getAdminDashboard,
  getMatchingHealth,
  type AdminDashboardResponse,
  type MatchingHealth,
} from "@/lib/api";

export default function AdminPage() {
  const { user, token, isAuthenticated } = useAuth();
  const router = useRouter();
  const t = useTranslations("admin");

  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [health, setHealth] = useState<MatchingHealth | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "admin") router.replace("/login");
  }, [isAuthenticated, user, router]);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      setData(await getAdminDashboard(token));
    } catch {
      setError(t("loadError"));
    }
    try {
      setHealth(await getMatchingHealth(token));
    } catch {
      // match-health panel is optional — don't block the dashboard
    }
  }, [token, t]);

  useEffect(() => {
    load();
  }, [load]);

  if (!isAuthenticated || user?.role !== "admin") return null;
  if (error) {
    return (
      <p className="rounded-md border border-[var(--color-wait)] bg-[var(--color-wait)]/10 px-4 py-3 text-sm text-[var(--color-wait)]">
        {error}
      </p>
    );
  }
  if (!data) return <p className="text-sm opacity-60">…</p>;

  const stats: [string, number][] = [
    [t("totalLots"), data.total_lots],
    [t("openLots"), data.open_lots],
    [t("totalDemands"), data.total_demands],
    [t("openDemands"), data.open_demands],
    [t("totalDeals"), data.total_deals],
    [t("openDisputes"), data.open_disputes_count],
  ];

  const chartData = data.price_trend_summary.map((p) => ({
    date: p.date.slice(5),
    avg: Math.round(p.avg_modal_price),
  }));

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-lg font-semibold">{t("title")}</h1>

      {/* Stats grid */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-center"
          >
            <div className="font-serif text-2xl font-bold text-[var(--color-brand-dark)]">
              {value}
            </div>
            <div className="text-xs opacity-60">{label}</div>
          </div>
        ))}
      </section>

      {/* Match quality — every live match re-scored against the current lot & demand */}
      {health && (
        <section>
          <h2 className="mb-1 text-sm font-semibold opacity-80">{t("matchHealth")}</h2>
          <p className="mb-3 text-xs opacity-60">{t("matchHealthSubtitle")}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-center">
              <div className="font-serif text-2xl font-bold text-[var(--color-brand-dark)]">{health.total_matches}</div>
              <div className="text-xs opacity-60">{t("mh_total")}</div>
            </div>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-center">
              <div className="font-serif text-2xl font-bold text-[var(--color-brand-dark)]">{Math.round(health.precision * 100)}%</div>
              <div className="text-xs opacity-60">{t("mh_precision")}</div>
            </div>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-center">
              <div className="font-serif text-2xl font-bold text-[var(--color-brand-dark)]">{health.mean_abs_score_delta}</div>
              <div className="text-xs opacity-60">{t("mh_drift")}</div>
            </div>
            <div
              className={`rounded-xl border p-4 text-center ${
                health.healthy
                  ? "border-[var(--color-sell)]/40 bg-[var(--color-sell)]/10 text-[var(--color-sell)]"
                  : "border-[var(--color-wait)]/40 bg-[var(--color-wait)]/10 text-[var(--color-wait)]"
              }`}
            >
              <div className="font-serif text-lg font-bold">{health.healthy ? t("mh_healthy") : t("mh_unhealthy")}</div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {(
              [
                ["mh_consistent", health.buckets.consistent, "text-[var(--color-sell)]"],
                ["mh_drifted", health.buckets.drifted, "text-[var(--color-brand-dark)]"],
                ["mh_degraded", health.buckets.degraded, "text-[var(--color-wait)]"],
                ["mh_orphaned", health.buckets.orphaned, "text-[var(--color-wait)]"],
              ] as const
            ).map(([key, n, cls]) => (
              <span
                key={key}
                className="rounded-full border border-[var(--color-border)] bg-white/50 px-3 py-1"
              >
                {t(key)}: <span className={`font-bold ${cls}`}>{n}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Price trend sparkline */}
      <section>
        <h2 className="mb-2 text-sm font-semibold opacity-80">{t("priceTrend")}</h2>
        <div className="h-44 w-full" role="img" aria-label={t("priceTrend")}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
              <YAxis tick={{ fontSize: 11 }} width={48} />
              <Tooltip contentStyle={{ fontSize: 13, borderRadius: 8 }} />
              <Line
                type="monotone"
                dataKey="avg"
                stroke="var(--color-brand)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Dispute queue */}
      <section>
        <h2 className="mb-2 text-sm font-semibold opacity-80">{t("disputeQueue")}</h2>
        {data.dispute_queue.length === 0 ? (
          <p className="text-sm opacity-60">{t("noDisputes")}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="bg-[var(--color-border)]/40">
                <tr>
                  <th className="px-3 py-2 font-semibold">{t("dealId")}</th>
                  <th className="px-3 py-2 font-semibold">{t("raisedBy")}</th>
                  <th className="px-3 py-2 font-semibold">{t("reason")}</th>
                  <th className="px-3 py-2 font-semibold">{t("date")}</th>
                </tr>
              </thead>
              <tbody>
                {data.dispute_queue.map((d) => (
                  <tr key={d.id} className="border-t border-[var(--color-border)]">
                    <td className="px-3 py-2">
                      <Link
                        href={`/deals/${d.deal_id}`}
                        className="font-medium text-[var(--color-brand)] hover:underline"
                      >
                        #{d.deal_id}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{d.raised_by}</td>
                    <td className="px-3 py-2">
                      {d.reason.length > 60 ? `${d.reason.slice(0, 60)}…` : d.reason}
                    </td>
                    <td className="px-3 py-2">{d.created_at.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* v1.1 analytics */}
      {data.district_price_gaps?.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold opacity-80">
            District price-realisation gap (vs state average)
          </h2>
          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
            <table className="w-full min-w-[360px] text-left text-sm">
              <thead className="bg-[var(--color-border)]/40">
                <tr>
                  <th className="px-3 py-2 font-semibold">District</th>
                  <th className="px-3 py-2 font-semibold">Avg modal ₹</th>
                  <th className="px-3 py-2 font-semibold">Gap vs state</th>
                </tr>
              </thead>
              <tbody>
                {data.district_price_gaps.slice(0, 12).map((g) => (
                  <tr key={g.district} className="border-t border-[var(--color-border)]">
                    <td className="px-3 py-2 font-medium">{g.district}</td>
                    <td className="px-3 py-2">₹{g.avg_modal_price}</td>
                    <td
                      className={`px-3 py-2 font-semibold ${
                        g.gap_vs_state_pct < 0 ? "text-[var(--color-wait)]" : "text-[var(--color-sell)]"
                      }`}
                    >
                      {g.gap_vs_state_pct > 0 ? "+" : ""}
                      {g.gap_vs_state_pct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {data.price_anomalies?.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold opacity-80">
            Price anomalies (latest modal vs its 7-day average)
          </h2>
          <ul className="flex flex-col gap-1.5">
            {data.price_anomalies.map((an) => (
              <li
                key={`${an.crop}-${an.market}`}
                className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-white/50 px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-semibold">{an.crop}</span> · {an.market}
                </span>
                <span
                  className={`font-bold ${
                    an.deviation_pct >= 0 ? "text-[var(--color-sell)]" : "text-[var(--color-wait)]"
                  }`}
                >
                  ₹{an.modal_price} ({an.deviation_pct >= 0 ? "+" : ""}
                  {an.deviation_pct}% vs ₹{an.avg_7d})
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.disputes_by_district && Object.keys(data.disputes_by_district).length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold opacity-80">Disputes by district</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.disputes_by_district).map(([d, n]) => (
              <span
                key={d}
                className="rounded-full border border-[var(--color-border)] bg-white/50 px-3 py-1 text-sm"
              >
                {d}: <span className="font-bold">{n}</span>
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

"use client";

/**
 * Admin analytics dashboard — read only.
 *
 * Pulls three admin endpoints (/dashboard, /analytics, /matching-health) and
 * renders a KPI strip plus chart blocks: marketplace funnel, supply vs demand,
 * weekly activity, price index, deal pipeline, match-score spread, user mix,
 * price movers, district price gaps, match-quality, disputes, anomalies.
 * Non-admins are redirected. Client component (Cordova constraint).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/components/AuthProvider";
import { Icon } from "@/components/ui";
import {
  downloadAdminEventsCsv,
  getAdminAnalytics,
  getAdminDashboard,
  getAdminEvents,
  getMatchingHealth,
  type AdminAnalytics,
  type AdminDashboardResponse,
  type AdminEvent,
  type MatchingHealth,
} from "@/lib/api";

const C = {
  green: "var(--chart-green)",
  amber: "var(--chart-amber)",
  red: "var(--chart-red)",
  blue: "var(--chart-blue)",
  purple: "var(--chart-purple)",
};

function inr(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
}

function Card({
  title,
  hint,
  children,
  className = "",
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm ${className}`}
    >
      <h2 className="text-sm font-bold text-[var(--color-text)]">{title}</h2>
      {hint && <p className="mb-3 mt-0.5 text-xs opacity-55">{hint}</p>}
      {!hint && <div className="mb-3" />}
      {children}
    </section>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "up" | "down";
}) {
  const toneCls =
    tone === "up"
      ? "text-[var(--color-sell)]"
      : tone === "down"
        ? "text-[var(--color-wait)]"
        : "text-[var(--color-brand-dark)]";
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider opacity-55">{label}</div>
      <div className={`mt-1 font-serif text-2xl font-bold ${toneCls}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs opacity-60">{sub}</div>}
    </div>
  );
}

const tooltipStyle = {
  fontSize: 12,
  borderRadius: 10,
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
};

export default function AdminPage() {
  const { user, token, isAuthenticated, ready } = useAuth();
  const router = useRouter();
  const t = useTranslations("admin");

  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [an, setAn] = useState<AdminAnalytics | null>(null);
  const [health, setHealth] = useState<MatchingHealth | null>(null);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated || user?.role !== "admin") router.replace("/login");
  }, [ready, isAuthenticated, user, router]);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      setData(await getAdminDashboard(token));
    } catch {
      setError(t("loadError"));
    }
    try {
      setAn(await getAdminAnalytics(token));
    } catch {
      /* analytics block is optional */
    }
    try {
      setHealth(await getMatchingHealth(token));
    } catch {
      /* match-health panel is optional */
    }
    try {
      setEvents(await getAdminEvents(token));
    } catch {
      /* activity ledger is optional */
    }
  }, [token, t]);

  useEffect(() => {
    load();
  }, [load]);

  const priceTrend = useMemo(
    () =>
      (data?.price_trend_summary ?? []).map((p) => ({
        date: p.date.slice(5),
        avg: Math.round(p.avg_modal_price),
      })),
    [data],
  );

  const roleData = useMemo(
    () =>
      Object.entries(an?.users_by_role ?? {}).map(([role, count]) => ({ role, count })),
    [an],
  );

  if (!ready || !isAuthenticated || user?.role !== "admin") return null;
  if (error) {
    return (
      <p className="rounded-md border border-[var(--color-wait)] bg-[var(--color-wait)]/10 px-4 py-3 text-sm text-[var(--color-wait)]">
        {error}
      </p>
    );
  }
  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--color-border)]/50" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-[var(--color-border)]/40" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-2xl bg-[var(--color-border)]/40" />
          ))}
        </div>
      </div>
    );
  }

  const roleColors = [C.green, C.blue, C.purple, C.amber, C.red];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-brand)]/10 text-[var(--color-brand-dark)]">
          <Icon name="shield" size={20} />
        </div>
        <div>
          <h1 className="font-serif text-lg font-bold">{t("title")}</h1>
          <p className="text-xs opacity-55">{t("subtitle")}</p>
        </div>
      </div>

      {/* ---- KPI strip ---- */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <Kpi
          label={t("kpiGmv")}
          value={an ? inr(an.gmv_inr) : "—"}
          sub={an ? t("kpiGmvSub", { v: inr(an.avg_deal_value_inr) }) : undefined}
        />
        <Kpi label={t("totalDeals")} value={String(data.total_deals)} sub={t("kpiDealsSub", { closed: an?.deal_pipeline?.closed ?? 0 })} />
        <Kpi
          label={t("kpiMatchConv")}
          value={an ? `${an.match_conversion_pct}%` : "—"}
          sub={t("kpiMatchConvSub")}
        />
        <Kpi
          label={t("kpiPriceIndex")}
          value={an ? `₹${an.price_index_latest}` : "—"}
          sub={an ? t("kpiPriceIndexSub", { pct: an.price_index_change_pct }) : undefined}
          tone={an ? (an.price_index_change_pct >= 0 ? "up" : "down") : "neutral"}
        />
        <Kpi label={t("kpiUsers")} value={an ? String(an.users_total) : "—"} sub={
          an
            ? `${an.users_by_role.farmer ?? 0} ${t("roleFarmers")} · ${an.users_by_role.buyer ?? 0} ${t("roleBuyers")}`
            : undefined
        } />
        <Kpi label={t("kpiCoverage")} value={an ? String(an.markets_tracked) : "—"} sub={
          an ? t("kpiCoverageSub", { d: an.districts_tracked, s: an.states_tracked }) : undefined
        } />
        <Kpi label={t("openLots")} value={String(data.open_lots)} sub={`${data.total_lots} ${t("kpiAllTime")}`} />
        <Kpi
          label={t("openDisputes")}
          value={String(data.open_disputes_count)}
          tone={data.open_disputes_count > 0 ? "down" : "neutral"}
        />
      </section>

      {/* ---- charts grid ---- */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {an && (
          <Card title={t("chFunnel")} hint={t("chFunnelHint")}>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={an.funnel} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <CartesianGrid horizontal={false} stroke="var(--color-border)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="stage" tick={{ fontSize: 11 }} width={72} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-border)", opacity: 0.3 }} />
                  <Bar dataKey="count" fill={C.green} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {an && an.supply_demand.length > 0 && (
          <Card title={t("chSupplyDemand")} hint={t("chSupplyDemandHint")}>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={an.supply_demand.slice(0, 7)} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="crop" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={48} />
                  <YAxis tick={{ fontSize: 11 }} width={44} tickFormatter={(v) => `${Math.round(v / 1000)}t`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${Math.round(Number(v)).toLocaleString()} kg`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar name={t("supply")} dataKey="supply_kg" fill={C.green} radius={[4, 4, 0, 0]} />
                  <Bar name={t("demand")} dataKey="demand_kg" fill={C.blue} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {an && (
          <Card title={t("chActivity")} hint={t("chActivityHint")}>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={an.weekly_activity} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} tickFormatter={(w: string) => w.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} width={28} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area name={t("deals")} type="monotone" dataKey="deals" stroke={C.green} fill={C.green} fillOpacity={0.15} />
                  <Line name={t("offers")} type="monotone" dataKey="offers" stroke={C.amber} strokeWidth={2} dot={false} />
                  <Line name={t("newUsers")} type="monotone" dataKey="new_users" stroke={C.purple} strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        <Card title={t("priceTrend")} hint={t("chPriceTrendHint")}>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={priceTrend} margin={{ left: 0, right: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={24} />
                <YAxis tick={{ fontSize: 11 }} width={44} domain={["auto", "auto"]} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => `₹${v}`} />
                <Area type="monotone" dataKey="avg" stroke={C.green} fill={C.green} fillOpacity={0.15} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {an && (
          <Card title={t("chPipeline")} hint={t("chPipelineHint")}>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={Object.entries(an.deal_pipeline).map(([k, v]) => ({ stage: t(`pipe_${k}` as "pipe_matched"), count: v }))}
                  layout="vertical"
                  margin={{ left: 8, right: 24 }}
                >
                  <CartesianGrid horizontal={false} stroke="var(--color-border)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="stage" tick={{ fontSize: 10 }} width={96} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-border)", opacity: 0.3 }} />
                  <Bar dataKey="count" fill={C.blue} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {an && (
          <Card title={t("chScoreDist")} hint={t("chScoreDistHint")}>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={an.score_distribution} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={28} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-border)", opacity: 0.3 }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {an.score_distribution.map((_, i) => (
                      <Cell key={i} fill={[C.red, C.amber, C.blue, C.green][i]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {an && roleData.length > 0 && (
          <Card title={t("chUserMix")} hint={t("chUserMixHint")}>
            <div className="flex h-52 items-center">
              <ResponsiveContainer width="55%" height="100%">
                <PieChart>
                  <Pie data={roleData} dataKey="count" nameKey="role" innerRadius={38} outerRadius={64} paddingAngle={2}>
                    {roleData.map((_, i) => (
                      <Cell key={i} fill={roleColors[i % roleColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="flex flex-col gap-1.5 text-sm">
                {roleData.map((r, i) => (
                  <li key={r.role} className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: roleColors[i % roleColors.length] }}
                    />
                    <span className="capitalize">{r.role}</span>
                    <span className="font-bold">{r.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        )}

        {an && an.price_pulse.length > 0 && (
          <Card title={t("chMovers")} hint={t("chMoversHint")}>
            <ul className="flex flex-col divide-y divide-[var(--color-border)]">
              {an.price_pulse.slice(0, 7).map((p) => (
                <li key={p.crop} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                  <span className="truncate">{p.crop}</span>
                  <span className="flex items-center gap-2">
                    <span className="opacity-60">₹{p.latest}</span>
                    <span
                      className={`w-16 text-right font-bold ${
                        p.change_pct >= 0 ? "text-[var(--color-sell)]" : "text-[var(--color-wait)]"
                      }`}
                    >
                      {p.change_pct >= 0 ? "+" : ""}
                      {p.change_pct}%
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {/* ---- deal health (v1.4 phase 4) ---- */}
      {an && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title={t("dhTitle")} hint={t("dhHint")}>
            <div className="grid grid-cols-2 gap-3">
              <Kpi
                label={t("dhSuccess")}
                value={`${an.deal_success_rate_pct}%`}
                tone={an.deal_success_rate_pct >= 50 ? "up" : "down"}
              />
              <Kpi
                label={t("dhTimeToDeal")}
                value={an.avg_hours_to_deal == null ? "—" : an.avg_hours_to_deal < 48
                  ? `${an.avg_hours_to_deal.toFixed(0)} h`
                  : `${(an.avg_hours_to_deal / 24).toFixed(1)} d`}
              />
            </div>
            <div className="mt-3 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={Object.entries(an.payment_status_split).map(([name, value]) => ({ name, value }))}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={30}
                    outerRadius={55}
                    paddingAngle={2}
                  >
                    {Object.keys(an.payment_status_split).map((k, i) => (
                      <Cell key={k} fill={k === "paid" ? C.green : C.amber} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend iconSize={9} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <p className="text-center text-[11px] opacity-55">{t("dhPaymentSplit")}</p>
          </Card>

          <Card title={t("dhMspTitle")} hint={t("dhMspHint")}>
            {an.price_vs_msp.length === 0 ? (
              <p className="text-sm opacity-60">{t("dhMspNone")}</p>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={an.price_vs_msp.slice(0, 8)} layout="vertical" margin={{ left: 8, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} unit="%" />
                    <YAxis type="category" dataKey="crop" tick={{ fontSize: 10 }} width={90} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, t("dhMspGap")]} />
                    <Bar dataKey="gap_pct" radius={[0, 4, 4, 0]}>
                      {an.price_vs_msp.slice(0, 8).map((p, i) => (
                        <Cell key={i} fill={p.gap_pct < 0 ? C.red : C.green} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ---- match quality ---- */}
      {health && (
        <Card title={t("matchHealth")} hint={t("matchHealthSubtitle")}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                [t("mh_total"), String(health.total_matches), "neutral"],
                [t("mh_precision"), `${Math.round(health.precision * 100)}%`, "neutral"],
                [t("mh_drift"), String(health.mean_abs_score_delta), "neutral"],
                [
                  health.healthy ? t("mh_healthy") : t("mh_unhealthy"),
                  "",
                  health.healthy ? "up" : "down",
                ],
              ] as [string, string, "neutral" | "up" | "down"][]
            ).map(([label, value, tone], i) => (
              <div
                key={i}
                className={`rounded-xl border p-3 text-center ${
                  tone === "up"
                    ? "border-[var(--color-sell)]/40 bg-[var(--color-sell)]/10 text-[var(--color-sell)]"
                    : tone === "down"
                      ? "border-[var(--color-wait)]/40 bg-[var(--color-wait)]/10 text-[var(--color-wait)]"
                      : "border-[var(--color-border)] bg-[var(--color-bg)]"
                }`}
              >
                {value && <div className="font-serif text-xl font-bold">{value}</div>}
                <div className={`text-xs ${value ? "opacity-60" : "font-serif text-lg font-bold"}`}>{label}</div>
              </div>
            ))}
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
              <span key={key} className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1">
                {t(key)}: <span className={`font-bold ${cls}`}>{n}</span>
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* ---- district price gaps ---- */}
      {data.district_price_gaps?.length > 0 && (
        <Card title={t("chDistrictGap")} hint={t("chDistrictGapHint")}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[...data.district_price_gaps].sort((a, b) => a.gap_vs_state_pct - b.gap_vs_state_pct).slice(0, 14)}
                layout="vertical"
                margin={{ left: 8, right: 24 }}
              >
                <CartesianGrid horizontal={false} stroke="var(--color-border)" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="district" tick={{ fontSize: 10 }} width={90} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${v}% vs state avg`} />
                <Bar dataKey="gap_vs_state_pct" radius={[0, 4, 4, 0]}>
                  {data.district_price_gaps
                    .slice()
                    .sort((a, b) => a.gap_vs_state_pct - b.gap_vs_state_pct)
                    .slice(0, 14)
                    .map((g, i) => (
                      <Cell key={i} fill={g.gap_vs_state_pct < 0 ? C.red : C.green} />
                    ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* ---- disputes + anomalies ---- */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title={t("disputeQueue")}>
          {data.dispute_queue.length === 0 ? (
            <p className="text-sm opacity-60">{t("noDisputes")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[380px] text-left text-sm">
                <thead className="border-b border-[var(--color-border)] text-xs uppercase opacity-55">
                  <tr>
                    <th className="py-2 font-semibold">{t("dealId")}</th>
                    <th className="py-2 font-semibold">{t("reason")}</th>
                    <th className="py-2 font-semibold">{t("date")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.dispute_queue.map((d) => (
                    <tr key={d.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="py-2">
                        <Link href={`/deals/${d.deal_id}`} className="font-medium text-[var(--color-brand)] hover:underline">
                          #{d.deal_id}
                        </Link>
                      </td>
                      <td className="py-2">{d.reason.length > 48 ? `${d.reason.slice(0, 48)}…` : d.reason}</td>
                      <td className="py-2 opacity-60">{d.created_at.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title={t("chAnomalies")} hint={t("chAnomaliesHint")}>
          {(!data.price_anomalies || data.price_anomalies.length === 0) ? (
            <p className="text-sm opacity-60">{t("noAnomalies")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--color-border)]">
              {data.price_anomalies.map((a) => (
                <li key={`${a.crop}-${a.market}`} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-semibold">{a.crop}</span>
                    <span className="opacity-55"> · {a.market}</span>
                  </span>
                  <span
                    className={`shrink-0 font-bold ${
                      a.deviation_pct >= 0 ? "text-[var(--color-sell)]" : "text-[var(--color-wait)]"
                    }`}
                  >
                    ₹{a.modal_price} ({a.deviation_pct >= 0 ? "+" : ""}
                    {a.deviation_pct}%)
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Activity ledger — the append-only transaction log */}
      <Card title={t("activityTitle")} hint={t("activityHint")}>
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={() => token && downloadAdminEventsCsv(token).catch(() => {})}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-bold opacity-80 hover:opacity-100"
          >
            <Icon name="chart" size={13} /> {t("downloadCsv")}
          </button>
        </div>
        {events.length === 0 ? (
          <p className="text-sm opacity-60">{t("noActivity")}</p>
        ) : (
          <ul className="flex max-h-96 flex-col divide-y divide-[var(--color-border)] overflow-y-auto text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1.5">
                <span className="min-w-0">
                  <span className="font-semibold">{e.action.replace(/_/g, " ")}</span>
                  <span className="opacity-55">
                    {" "}· {e.entity_type} #{e.entity_id} · {e.actor_name}
                  </span>
                </span>
                <span className="shrink-0 text-xs opacity-50">
                  {e.created_at ? new Date(e.created_at).toLocaleString() : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

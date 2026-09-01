"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Suspense, useCallback, useEffect, useState } from "react";

import { CropMarketPicker } from "@/components/CropMarketPicker";
import { PriceTrendChart } from "@/components/PriceTrendChart";
import { SignalGaugeChart } from "@/components/SignalGaugeChart";
import { MarketComparisonChart } from "@/components/MarketComparisonChart";
import { BestMarketPanel, WeatherStrip, MspBanner } from "@/components/intel";
import { Icon, Skeleton } from "@/components/ui";
import {
  fetchBestMarkets,
  fetchMsp,
  fetchNearby,
  fetchPublicOverview,
  fetchSignal,
  fetchTrend,
  fetchWeather,
  type BestMarketResponse,
  type MspInfo,
  type NearestMarketComparison,
  type PricePoint,
  type PublicOverview,
  type SellWaitSignalResponse,
  type WeatherForecast,
} from "@/lib/api";
import { useCropMarket } from "@/lib/useCropMarket";
import { useLocation } from "@/lib/useLocation";

const SIGNAL_LABEL: Record<SellWaitSignalResponse["recommendation"], string> = {
  sell_now: "SELL NOW",
  wait: "WAIT",
  hold: "HOLD",
};

const SIGNAL_COLORS: Record<
  SellWaitSignalResponse["recommendation"],
  { bg: string; text: string; border: string }
> = {
  sell_now: {
    bg: "bg-[var(--green-100)]",
    text: "text-[var(--green-700)]",
    border: "border-[var(--green-600)]/30",
  },
  wait: {
    bg: "bg-[var(--red-100)]",
    text: "text-[var(--red-700)]",
    border: "border-[var(--red-500)]/30",
  },
  hold: {
    bg: "bg-[var(--amber-100)]",
    text: "text-[var(--amber-700)]",
    border: "border-[var(--amber-500)]/30",
  },
};

function StatCard({
  icon,
  label,
  value,
  sub,
  iconColor = "text-[var(--green-600)]",
}: {
  icon: string;
  label: string;
  value: string | number;
  sub?: string;
  iconColor?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-[var(--line)] bg-white/80 p-4 shadow-sm backdrop-blur-sm">
      <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest ${iconColor}`}>
        <Icon name={icon} size={15} />
        <span>{label}</span>
      </div>
      <div className="font-heading text-2xl font-extrabold text-[var(--ink)] leading-tight">
        {value}
      </div>
      {sub && <div className="text-xs text-[var(--ink-soft)]">{sub}</div>}
    </div>
  );
}

function HomeInner() {
  const t = useTranslations("home");
  const td = useTranslations("dashboard");
  const ts = useTranslations("signal");
  const cm = useCropMarket();
  const { location } = useLocation();

  const [price, setPrice] = useState<number | null>(null);
  const [pctChange, setPctChange] = useState<number | null>(null);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [trendPoints, setTrendPoints] = useState<PricePoint[]>([]);
  const [nearbyMarkets, setNearbyMarkets] = useState<NearestMarketComparison[]>([]);
  const [rec, setRec] = useState<SellWaitSignalResponse | null>(null);
  const [weather, setWeather] = useState<WeatherForecast | null>(null);
  const [msp, setMsp] = useState<MspInfo | null>(null);
  const [bestMarket, setBestMarket] = useState<BestMarketResponse | null>(null);
  const [overview, setOverview] = useState<PublicOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!cm.crop || !cm.market) return;
    setLoading(true);
    const [tr, sg, wx, mp, bm, nb] = await Promise.allSettled([
      fetchTrend(cm.crop, cm.market, 7),
      fetchSignal(cm.crop, cm.market),
      fetchWeather({ market: cm.market }),
      fetchMsp(cm.crop),
      fetchBestMarkets(cm.crop, cm.market),
      fetchNearby(cm.crop, cm.market),
    ]);
    if (tr.status === "fulfilled") {
      const pts = tr.value.points;
      const last = pts[pts.length - 1];
      const prev = pts[pts.length - 2];
      setPrice(last?.modal_price ?? null);
      setAsOf(last?.date ?? null);
      setTrendPoints(pts);
      if (last && prev && prev.modal_price) {
        setPctChange(((last.modal_price - prev.modal_price) / prev.modal_price) * 100);
      }
    }
    setRec(sg.status === "fulfilled" ? sg.value : null);
    setWeather(wx.status === "fulfilled" ? wx.value : null);
    setMsp(mp.status === "fulfilled" ? mp.value : null);
    setBestMarket(bm.status === "fulfilled" ? bm.value : null);
    setNearbyMarkets(nb.status === "fulfilled" ? nb.value : []);
    setLoading(false);
  }, [cm.crop, cm.market, location]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetchPublicOverview(location?.state)
      .then(setOverview)
      .catch(() => setOverview(null));
  }, [location?.state]);

  const recLabel = rec ? SIGNAL_LABEL[rec.recommendation] : null;
  const signalColors = rec ? SIGNAL_COLORS[rec.recommendation] : null;

  return (
    <div className="flex flex-col gap-0">
      {/* ─── HERO ─── */}
      <section
        className="relative -mx-4 -mt-4 mb-8 overflow-hidden rounded-b-3xl sm:-mx-6 sm:-mt-6 lg:-mx-8 lg:-mt-8"
        style={{
          background:
            "linear-gradient(135deg, #0e3b20 0%, #1E5B3A 50%, #2E7D32 100%)",
          minHeight: 320,
        }}
      >
        {/* Decorative grid overlay */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, white 0px, white 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, white 0px, white 1px, transparent 1px, transparent 40px)",
          }}
        />
        {/* Leaf decorations */}
        <div className="absolute -right-12 -top-12 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-8 left-1/3 h-40 w-40 rounded-full bg-[var(--amber-500)]/10 blur-2xl" />

        <div className="relative flex flex-col gap-8 px-6 py-10 lg:flex-row lg:items-center lg:px-12 lg:py-14">
          {/* Left: Headline */}
          <div className="flex-1">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-white/80">
              <Icon name="leaf" size={13} />
              {location?.district ?? location?.state ?? "Maharashtra"} · Real-Time
            </span>
            <h1 className="mt-4 font-heading text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
              Smarter Markets.
              <br />
              <span className="text-[var(--amber-500)]">Better Decisions.</span>
            </h1>
            <p className="mt-3 max-w-lg text-base text-white/70">
              Real-time agricultural market intelligence for farmers, FPOs, and buyers across Maharashtra.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={`/prices?crop=${cm.crop}&market=${cm.market}`}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--amber-500)] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-900/30 transition hover:brightness-110"
              >
                <Icon name="chart" size={16} />
                View Prices
              </Link>
              <Link
                href={`/advisor?crop=${cm.crop}&market=${cm.market}`}
                className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                <Icon name="spark" size={16} />
                Get Advice
              </Link>
            </div>
          </div>

          {/* Right: Crop & Market Picker */}
          <div className="w-full max-w-sm rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-md">
            <p className="mb-3 text-sm font-bold uppercase tracking-widest text-white/60">
              Explore Market
            </p>
            <CropMarketPicker cm={cm} />
          </div>
        </div>
      </section>

      {/* ─── ROW 1: Key Insight Cards ─── */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Today's Modal Price */}
        <div className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--ink-soft)]">
                {td("modalPrice")}
              </p>
              <p className="mt-0.5 text-sm text-[var(--ink-soft)]">
                {cm.crop || "—"} · {cm.market || "—"}
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--green-100)] text-[var(--green-700)]">
              <Icon name="coins" size={20} />
            </span>
          </div>
          {loading ? (
            <Skeleton className="mt-4 h-10 w-36" />
          ) : (
            <>
              <div className="mt-3 font-heading text-4xl font-extrabold text-[var(--green-700)]">
                {price != null ? `₹${price.toFixed(0)}` : "—"}
                <span className="text-base font-medium text-[var(--ink-soft)]"> /qtl</span>
              </div>
              {pctChange != null && (
                <div
                  className={`mt-2 flex items-center gap-1 text-sm font-semibold ${pctChange >= 0 ? "text-[var(--green-600)]" : "text-[var(--red-500)]"}`}
                >
                  <Icon name={pctChange >= 0 ? "arrowUp" : "arrowDown"} size={14} />
                  {Math.abs(pctChange).toFixed(2)}% vs yesterday
                </div>
              )}
              {asOf && <p className="mt-1 text-xs text-[var(--ink-soft)]">{td("asOf")}: {asOf}</p>}
            </>
          )}
        </div>

        {/* Sell / Wait Signal */}
        <div
          className={`rounded-2xl border p-5 shadow-sm ${
            signalColors ? `${signalColors.bg} ${signalColors.border}` : "border-[var(--line)] bg-white"
          }`}
        >
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--ink-soft)]">
            {ts("title")}
          </p>
          {loading ? (
            <Skeleton className="mt-4 h-20 w-full" />
          ) : rec ? (
            <>
              <SignalGaugeChart recommendation={rec.recommendation} />
              <Link
                href={`/advisor?crop=${cm.crop}&market=${cm.market}`}
                className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[var(--green-700)] hover:underline"
              >
                See full analysis →
              </Link>
            </>
          ) : (
            <p className="mt-4 text-sm text-[var(--ink-soft)]">Select crop &amp; market</p>
          )}
        </div>

        {/* Weather */}
        <div className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--ink-soft)]">Weather</p>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-500">
              <Icon name="cloudRain" size={20} />
            </span>
          </div>
          {loading ? (
            <Skeleton className="mt-4 h-16 w-full" />
          ) : weather?.current ? (
            <>
              <div className="mt-3 font-heading text-3xl font-extrabold text-[var(--ink)]">
                {weather.current.temp_c != null ? `${weather.current.temp_c}°C` : "—"}
              </div>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">
                {weather.current.conditions ?? "—"}
              </p>
              {weather.current.humidity_pct != null && (
                <p className="mt-1 text-xs text-[var(--ink-soft)]">
                  Humidity: {weather.current.humidity_pct}%
                </p>
              )}
            </>
          ) : (
            <p className="mt-4 text-sm text-[var(--ink-soft)]">Weather unavailable</p>
          )}
        </div>

        {/* MSP */}
        <div className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--ink-soft)]">MSP</p>
              <p className="mt-0.5 text-sm text-[var(--ink-soft)]">{cm.crop || "—"}</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--amber-100)] text-[var(--amber-700)]">
              <Icon name="scale" size={20} />
            </span>
          </div>
          {loading ? (
            <Skeleton className="mt-4 h-16 w-full" />
          ) : msp?.has_msp ? (
            <>
              <div className="mt-3 font-heading text-3xl font-extrabold text-[var(--ink)]">
                ₹{msp.msp_price}
                <span className="text-base font-medium text-[var(--ink-soft)]"> /qtl</span>
              </div>
              {msp.gap_vs_msp != null && (
                <div
                  className={`mt-2 text-sm font-semibold ${msp.below_msp ? "text-[var(--red-500)]" : "text-[var(--green-600)]"}`}
                >
                  Gap: {msp.below_msp ? "−" : "+"}₹{Math.abs(msp.gap_vs_msp)} vs mandi
                </div>
              )}
            </>
          ) : (
            <p className="mt-4 text-sm text-[var(--ink-soft)]">No MSP for this crop</p>
          )}
        </div>
      </div>

      {/* ─── ROW 2: Market Intelligence ─── */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        {/* Price Trend (large) */}
        <div className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-heading text-base font-bold text-[var(--ink)]">
                <Icon name="chart" size={16} className="mr-2 inline text-[var(--green-600)]" />
                7-Day Price Trend
              </h2>
              <p className="text-xs text-[var(--ink-soft)]">{cm.crop} · {cm.market}</p>
            </div>
            <Link
              href={`/prices?crop=${cm.crop}&market=${cm.market}`}
              className="text-xs font-semibold text-[var(--green-700)] hover:underline"
            >
              View Full Chart →
            </Link>
          </div>
          <PriceTrendChart points={trendPoints} />
        </div>

        {/* Best Market Card */}
        <div className="rounded-2xl border border-[var(--green-600)]/20 bg-gradient-to-br from-[var(--green-700)] to-[var(--green-900)] p-5 shadow-lg text-white">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/60">
            <Icon name="pin" size={14} />
            Best Market For You
          </div>
          {loading ? (
            <div className="mt-4 space-y-3">
              <div className="h-4 rounded bg-white/20"></div>
              <div className="h-8 rounded bg-white/20"></div>
              <div className="h-4 w-2/3 rounded bg-white/20"></div>
            </div>
          ) : bestMarket?.best ? (
            <>
              <div className="mt-3 font-heading text-3xl font-extrabold">
                {bestMarket.best.market}
              </div>
              <div className="mt-1 font-heading text-xl font-bold text-[var(--amber-500)]">
                ₹{bestMarket.best.net_price_per_qtl}
                <span className="text-sm font-normal text-white/70"> /qtl net</span>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between border-t border-white/10 pt-2">
                  <span className="text-white/60">Transport cost</span>
                  <span className="font-semibold">−₹{bestMarket.best.transport_cost_per_qtl}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Distance</span>
                  <span className="font-semibold">{bestMarket.best.road_km} km</span>
                </div>
              </div>
              <Link
                href={`/prices?crop=${cm.crop}&market=${bestMarket.best.market}`}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/25"
              >
                <Icon name="map" size={15} />
                View Market Details
              </Link>
            </>
          ) : (
            <p className="mt-4 text-sm text-white/60">Select crop &amp; location to see best market</p>
          )}
        </div>
      </div>

      {/* ─── ROW 2B: Market Comparison ─── */}
      {cm.crop && cm.market && (
        <div className="mb-6 rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-heading text-base font-bold text-[var(--ink)]">
              <Icon name="warehouse" size={16} className="mr-2 inline text-[var(--green-600)]" />
              Nearby Market Comparison
            </h2>
            <Link
              href={`/prices?crop=${cm.crop}&market=${cm.market}`}
              className="text-xs font-semibold text-[var(--green-700)] hover:underline"
            >
              View all markets →
            </Link>
          </div>
          <MarketComparisonChart
            markets={nearbyMarkets}
            currentMarket={cm.market}
            currentPrice={price ?? 0}
          />
        </div>
      )}

      {/* ─── Weather Detail ─── */}
      {weather && <WeatherStrip data={weather} />}

      {/* ─── ROW 3: Platform Overview Stats ─── */}
      {overview && (
        <div className="mb-6 mt-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-heading text-base font-bold text-[var(--ink)]">
              <Icon name="globe" size={16} className="mr-2 inline text-[var(--green-600)]" />
              Platform Overview · {location?.state ?? "Maharashtra"}
            </h2>
            <Link href="/explore" className="text-xs font-semibold text-[var(--green-700)] hover:underline">
              Full Dashboard →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <StatCard icon="warehouse" label="Markets" value={overview.activity.markets_reporting ?? 0} sub="Reporting today" />
            <StatCard icon="leaf" label="Crops" value={overview.activity.crops_tracked ?? 0} sub="Being tracked" />
            <StatCard icon="chart" label="Open Lots" value={overview.activity.open_lots ?? 0} sub="By farmers" />
            <StatCard icon="users" label="Demands" value={overview.activity.open_demands ?? 0} sub="By buyers" />
            <StatCard icon="handshake" label="Deals" value={overview.activity.total_deals ?? 0} sub="Completed" iconColor="text-[var(--amber-700)]" />
            <StatCard icon="alert" label="Disputes" value={overview.activity.open_disputes ?? 0} sub="Open" iconColor="text-[var(--red-500)]" />
          </div>
        </div>
      )}

      {/* ─── Crop Price Snapshot ─── */}
      {overview && overview.crops.length > 0 && (
        <div className="mb-2 rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-heading text-base font-bold text-[var(--ink)]">
              <Icon name="spark" size={16} className="mr-2 inline text-[var(--amber-500)]" />
              Live Crop Prices
            </h2>
            <Link href="/explore" className="text-xs font-semibold text-[var(--green-700)] hover:underline">
              All crops →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {overview.crops.slice(0, 10).map((c) => (
              <Link
                key={c.crop}
                href={`/prices?crop=${c.crop}`}
                className="group flex flex-col gap-1 rounded-xl border border-[var(--line)] p-3 transition hover:border-[var(--green-600)]/40 hover:bg-[var(--green-50)]"
              >
                <span className="text-xs font-bold text-[var(--ink-soft)] group-hover:text-[var(--green-700)]">
                  {c.crop}
                </span>
                <span className="font-heading text-lg font-extrabold text-[var(--green-900)]">
                  ₹{c.avg_modal_price}
                </span>
                {c.change_7d_pct != null && (
                  <span
                    className={`flex items-center gap-0.5 text-xs font-semibold ${
                      c.change_7d_pct >= 0 ? "text-[var(--green-600)]" : "text-[var(--red-500)]"
                    }`}
                  >
                    <Icon name={c.change_7d_pct >= 0 ? "arrowUp" : "arrowDown"} size={11} />
                    {Math.abs(c.change_7d_pct)}%
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ─── Footer Value Props ─── */}
      <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-[var(--green-700)] p-6 text-white sm:grid-cols-4">
        {[
          { icon: "chart", label: "Data-Driven Insights", sub: "Real mandi prices & trends" },
          { icon: "spark", label: "Better Decisions", sub: "Sell at the right time" },
          { icon: "connection", label: "Market Linkage", sub: "Connects farmers & buyers" },
          { icon: "shield", label: "Transparency", sub: "Open & trusted platform" },
        ].map((f) => (
          <div key={f.label} className="flex flex-col gap-1">
            <Icon name={f.icon} size={20} className="text-[var(--amber-500)]" />
            <span className="font-heading text-sm font-bold">{f.label}</span>
            <span className="text-xs text-white/60">{f.sub}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="al-skeleton h-40" />}>
      <HomeInner />
    </Suspense>
  );
}

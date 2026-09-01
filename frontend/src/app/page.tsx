"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Suspense, useCallback, useEffect, useState } from "react";

import { CropMarketPicker } from "@/components/CropMarketPicker";
import {
  fetchPublicOverview,
  fetchSignal,
  fetchTrend,
  type PublicOverview,
  type SellWaitSignalResponse,
} from "@/lib/api";
import { useCropMarket } from "@/lib/useCropMarket";

const recStyle: Record<SellWaitSignalResponse["recommendation"], string> = {
  sell_now: "bg-green-50 border-green-300 text-green-900",
  wait: "bg-red-50 border-red-300 text-red-900",
  hold: "bg-amber-50 border-amber-300 text-amber-900",
};

function NavCard({ href, emoji, title, desc }: { href: string; emoji: string; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] backdrop-blur-xl p-5 shadow-lg transition-all hover:-translate-y-1 hover:shadow-2xl"
    >
      <span className="text-2xl">{emoji}</span>
      <span className="font-heading text-base font-bold">{title}</span>
      <span className="text-sm text-stone-600">{desc}</span>
    </Link>
  );
}

function HomeInner() {
  const t = useTranslations("home");
  const td = useTranslations("dashboard");
  const ts = useTranslations("signal");
  const cm = useCropMarket();

  const [price, setPrice] = useState<number | null>(null);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [rec, setRec] = useState<SellWaitSignalResponse | null>(null);
  const [overview, setOverview] = useState<PublicOverview | null>(null);

  const load = useCallback(async () => {
    if (!cm.crop || !cm.market) return;
    const [tr, sg] = await Promise.allSettled([
      fetchTrend(cm.crop, cm.market, 7),
      fetchSignal(cm.crop, cm.market),
    ]);
    if (tr.status === "fulfilled") {
      const last = tr.value.points[tr.value.points.length - 1];
      setPrice(last?.modal_price ?? null);
      setAsOf(last?.date ?? null);
    }
    setRec(sg.status === "fulfilled" ? sg.value : null);
  }, [cm.crop, cm.market]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    fetchPublicOverview().then(setOverview).catch(() => setOverview(null));
  }, []);

  const recLabel = rec
    ? rec.recommendation === "sell_now"
      ? ts("sell_now")
      : rec.recommendation === "wait"
        ? ts("wait")
        : ts("hold")
    : null;

  return (
    <div className="flex flex-col gap-8">
      {/* Hero */}
      <section className="rounded-3xl border border-[var(--color-border)] bg-gradient-to-br from-white/70 to-[var(--color-brand)]/10 p-8 shadow-xl">
        <h1 className="font-heading text-4xl font-extrabold tracking-tight text-[var(--color-brand-dark)]">
          {t("heroTitle")}
        </h1>
        <p className="mt-2 max-w-2xl text-lg text-stone-600">{t("heroSubtitle")}</p>

        <div className="mt-6">
          <CropMarketPicker cm={cm} />
        </div>

        {(price != null || recLabel) && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--color-border)] bg-white/70 p-5">
              <div className="text-xs uppercase tracking-wide text-stone-500">
                {td("modalPrice")} · {cm.market}
              </div>
              <div className="mt-1 font-heading text-3xl font-bold text-[var(--color-brand)]">
                {price != null ? `₹${price.toFixed(0)}` : "—"}
              </div>
              <div className="text-xs text-stone-400">
                {td("asOf")}: {asOf ?? "—"} · {td("perQuintal")}
              </div>
            </div>
            {rec && (
              <div className={`rounded-2xl border p-5 ${recStyle[rec.recommendation]}`}>
                <div className="text-xs font-bold uppercase tracking-wide opacity-70">
                  {ts("title")}
                </div>
                <div className="mt-1 font-heading text-3xl font-extrabold">{recLabel}</div>
                <Link href={`/advisor?crop=${cm.crop}&market=${cm.market}`} className="mt-1 inline-block text-sm font-semibold underline">
                  {t("seeWhy")}
                </Link>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Section links */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <NavCard href={`/prices?crop=${cm.crop}&market=${cm.market}`} emoji="📈" title={t("pricesTitle")} desc={t("pricesDesc")} />
        <NavCard href={`/advisor?crop=${cm.crop}&market=${cm.market}`} emoji="🌦️" title={t("advisorTitle")} desc={t("advisorDesc")} />
        <NavCard href="/directory" emoji="🏬" title={t("directoryTitle")} desc={t("directoryDesc")} />
        <NavCard href="/explore" emoji="🗺️" title={t("exploreTitle")} desc={t("exploreDesc")} />
      </div>

      {/* Statewide snapshot */}
      {overview && overview.crops.length > 0 && (
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] backdrop-blur-xl p-5 shadow-lg">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-heading text-sm font-bold">{t("snapshotTitle")}</h2>
            <Link href="/explore" className="text-xs font-semibold text-[var(--color-brand)] hover:underline">
              {t("snapshotMore")}
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {overview.crops.map((c) => (
              <div key={c.crop} className="rounded-xl border border-[var(--color-border)] bg-white/50 p-3 text-center">
                <div className="text-xs text-stone-500">{c.crop}</div>
                <div className="font-heading text-lg font-bold">₹{c.avg_modal_price}</div>
                {c.change_7d_pct != null && (
                  <div className={`text-xs font-semibold ${c.change_7d_pct >= 0 ? "text-[var(--color-sell)]" : "text-[var(--color-wait)]"}`}>
                    {c.change_7d_pct >= 0 ? "▲" : "▼"} {Math.abs(c.change_7d_pct)}%
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-stone-200" />}>
      <HomeInner />
    </Suspense>
  );
}

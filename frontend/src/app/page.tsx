"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Suspense, useCallback, useEffect, useState } from "react";

import { CropMarketPicker } from "@/components/CropMarketPicker";
import { SignalGaugeChart } from "@/components/SignalGaugeChart";
import { Card, Icon, SectionHeader } from "@/components/ui";
import {
  fetchPublicOverview,
  fetchSignal,
  fetchTrend,
  type PublicOverview,
  type SellWaitSignalResponse,
} from "@/lib/api";
import { useCropMarket } from "@/lib/useCropMarket";
import { useLocation } from "@/lib/useLocation";

const recTheme: Record<SellWaitSignalResponse["recommendation"], { cls: string; icon: string }> = {
  sell_now: { cls: "bg-[var(--green-100)] text-[var(--green-700)]", icon: "check" },
  wait: { cls: "bg-[var(--red-100)] text-[var(--red-700)]", icon: "clock" },
  hold: { cls: "bg-[var(--amber-100)] text-[var(--amber-700)]", icon: "scale" },
};

function NavCard({
  href,
  icon,
  title,
  desc,
}: {
  href: string;
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <Link href={href}>
      <Card as="div" hover className="h-full">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--green-100)] text-[var(--green-700)]">
          <Icon name={icon} size={20} />
        </span>
        <span className="mt-3 block font-heading text-base font-bold">{title}</span>
        <span className="mt-0.5 block text-sm text-[var(--ink-soft)]">{desc}</span>
      </Card>
    </Link>
  );
}

function HomeInner() {
  const t = useTranslations("home");
  const td = useTranslations("dashboard");
  const ts = useTranslations("signal");
  const cm = useCropMarket();
  const { location } = useLocation();

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
    fetchPublicOverview(location?.state)
      .then(setOverview)
      .catch(() => setOverview(null));
  }, [location?.state]);

  const recLabel = rec
    ? rec.recommendation === "sell_now"
      ? ts("sell_now")
      : rec.recommendation === "wait"
        ? ts("wait")
        : ts("hold")
    : null;
  const rt = rec ? recTheme[rec.recommendation] : null;

  return (
    <div className="flex flex-col gap-8">
      {/* Hero */}
      <section className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--green-100)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[var(--green-700)]">
            <Icon name="leaf" size={13} /> {location?.state ?? "Maharashtra"} · SIH 2026
          </span>
          <h1 className="mt-3 font-heading text-4xl font-extrabold leading-[1.1] tracking-tight text-[var(--green-900)] sm:text-5xl">
            {t("heroTitle")}
          </h1>
          <p className="mt-3 max-w-xl text-lg text-[var(--ink-soft)]">{t("heroSubtitle")}</p>
          <div className="mt-6">
            <CropMarketPicker cm={cm} />
          </div>
        </div>

        <Card className="lg:justify-self-end lg:max-w-sm">
          <SectionHeader icon="chart" title={`${td("modalPrice")} · ${cm.market || "…"}`} />
          <div className="font-heading text-4xl font-bold text-[var(--green-700)]">
            {price != null ? `₹${price.toFixed(0)}` : "—"}
          </div>
          <div className="text-xs text-[var(--ink-soft)]">
            {td("asOf")}: {asOf ?? "—"} · {td("perQuintal")}
          </div>

          {rec && rt && (
            <div className="mt-6 pt-6 border-t border-[var(--line)] relative">
              <SignalGaugeChart recommendation={rec.recommendation} />
              <div className="mt-6 text-center">
                <Link
                  href={`/advisor?crop=${cm.crop}&market=${cm.market}`}
                  className="inline-flex items-center gap-1 text-sm font-bold text-[var(--green-700)] hover:underline"
                >
                  {t("seeWhy")} <Icon name="arrowRight" size={14} />
                </Link>
              </div>
            </div>
          )}
        </Card>
      </section>

      {/* Section links */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <NavCard href={`/prices?crop=${cm.crop}&market=${cm.market}`} icon="chart" title={t("pricesTitle")} desc={t("pricesDesc")} />
        <NavCard href={`/advisor?crop=${cm.crop}&market=${cm.market}`} icon="cloudRain" title={t("advisorTitle")} desc={t("advisorDesc")} />
        <NavCard href="/directory" icon="warehouse" title={t("directoryTitle")} desc={t("directoryDesc")} />
        <NavCard href="/explore" icon="map" title={t("exploreTitle")} desc={t("exploreDesc")} />
      </div>

      {/* Statewide snapshot */}
      {overview && overview.crops.length > 0 && (
        <Card>
          <SectionHeader
            icon="spark"
            title={t("snapshotTitle")}
            action={
              <Link href="/explore" className="text-xs font-semibold text-[var(--green-700)] hover:underline">
                {t("snapshotMore")}
              </Link>
            }
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {overview.crops.map((c) => (
              <div key={c.crop} className="al-card-plain p-3 text-center">
                <div className="text-xs text-[var(--ink-soft)]">{c.crop}</div>
                <div className="font-heading text-lg font-bold text-[var(--green-900)]">₹{c.avg_modal_price}</div>
                {c.change_7d_pct != null && (
                  <div
                    className={`flex items-center justify-center gap-0.5 text-xs font-semibold ${
                      c.change_7d_pct >= 0 ? "text-[var(--green-600)]" : "text-[var(--red-500)]"
                    }`}
                  >
                    <Icon name={c.change_7d_pct >= 0 ? "arrowUp" : "arrowDown"} size={12} />
                    {Math.abs(c.change_7d_pct)}%
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
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

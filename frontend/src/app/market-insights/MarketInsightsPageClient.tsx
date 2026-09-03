"use client";

/**
 * /market-insights — Showcase AgriLink's data intelligence capabilities.
 *
 * Layout: Hero → Live stats banner → Data showcase cards → Interactive
 * preview section → CTA to /explore.
 */

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { fetchPublicOverview, type PublicOverview } from "@/lib/api";
import { useLocation } from "@/lib/useLocation";
import { Icon } from "@/components/ui";

/* ── Reveal animation ───────────────────────────────────────────────────── */

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.12 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.65s cubic-bezier(.22,1,.36,1) ${delay}s, transform 0.65s cubic-bezier(.22,1,.36,1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

/* ── Animated counter ───────────────────────────────────────────────────── */

function AnimatedNumber({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          obs.disconnect();
          const duration = 1200;
          const start = performance.now();
          const animate = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [target]);

  return (
    <span ref={ref} className="font-heading text-4xl font-extrabold sm:text-5xl">
      {value.toLocaleString()}{suffix}
    </span>
  );
}

/* ── Data capability card ───────────────────────────────────────────────── */

function CapabilityCard({
  icon,
  title,
  body,
  gradient,
  iconColor,
}: {
  icon: string;
  title: string;
  body: string;
  gradient: string;
  iconColor: string;
}) {
  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-8 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
      {/* Background glow on hover */}
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-0 blur-[60px] transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: gradient }}
      />

      <div className="relative z-10">
        <div className={`mb-5 inline-flex items-center justify-center rounded-2xl p-3.5 ${iconColor} shadow-sm`}
          style={{ background: `${gradient}22` }}>
          <Icon name={icon} size={26} />
        </div>
        <h3 className="font-heading text-xl font-bold text-[var(--ink)]">{title}</h3>
        <p className="mt-2.5 text-[15px] leading-relaxed text-[var(--ink-soft)]">{body}</p>
      </div>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────────────── */

export default function MarketInsightsPageClient() {
  const t = useTranslations("marketInsightsPage");
  const { location } = useLocation();
  const [overview, setOverview] = useState<PublicOverview | null>(null);

  useEffect(() => {
    fetchPublicOverview(location?.state).then(setOverview).catch(() => null);
  }, [location?.state]);

  const act = overview?.activity;

  return (
    <div className="flex flex-col gap-20 pb-20">

      {/* ── HERO ── */}
      <section
        className="relative -mx-4 -mt-4 overflow-hidden rounded-b-[2.5rem] sm:-mx-6 sm:-mt-6 lg:-mx-8 lg:-mt-8"
        style={{
          background: "linear-gradient(155deg, #0a1e14 0%, #143826 40%, #1b5a34 70%, #2E7D32 100%)",
          minHeight: 420,
        }}
      >
        <div className="pointer-events-none absolute right-0 top-0 h-96 w-96 rounded-full bg-[var(--amber-400)]/8 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-[var(--green-400)]/10 blur-[90px]" />
        <div className="al-grid-overlay pointer-events-none absolute inset-0" />

        <div className="relative z-10 mx-auto flex max-w-screen-xl flex-col items-center px-6 py-20 text-center sm:py-28 lg:py-32">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/8 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white/70 backdrop-blur-sm">
            <Icon name="chart" size={13} className="text-[var(--amber-400)]" />
            {t("heroBadge")}
          </span>

          <h1 className="mt-7 font-heading text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
            {t("heroTitle1")}{" "}
            <span className="bg-gradient-to-r from-[var(--amber-400)] to-[var(--amber-500)] bg-clip-text text-transparent">
              {t("heroTitle2")}
            </span>
          </h1>

          <p className="mt-5 max-w-2xl text-[1.05rem] leading-relaxed text-white/65">
            {t("heroSub")}
          </p>

          <div className="mt-9 flex flex-wrap justify-center gap-4">
            <Link href="/explore" className="al-btn-primary px-7 py-3.5 text-base">
              <Icon name="chart" size={17} />
              {t("ctaOpenDashboard")}
            </Link>
            <Link href="/login" className="al-btn-ghost px-7 py-3.5 text-base">
              <Icon name="leaf" size={17} />
              {t("ctaGetStarted")}
            </Link>
          </div>
        </div>
      </section>

      {/* ── LIVE STATS BANNER ── */}
      {act && (
        <Reveal>
          <section className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 gap-6 rounded-3xl bg-gradient-to-br from-[var(--green-700)] to-[var(--green-900)] p-8 text-center text-white sm:grid-cols-4 sm:p-10">
              <div className="flex flex-col gap-1">
                <AnimatedNumber target={act.markets_reporting ?? 0} />
                <span className="text-xs font-medium text-white/60">{t("statMarkets")}</span>
              </div>
              <div className="flex flex-col gap-1">
                <AnimatedNumber target={act.crops_tracked ?? 0} />
                <span className="text-xs font-medium text-white/60">{t("statCrops")}</span>
              </div>
              <div className="flex flex-col gap-1">
                <AnimatedNumber target={act.open_lots ?? 0} />
                <span className="text-xs font-medium text-white/60">{t("statLots")}</span>
              </div>
              <div className="flex flex-col gap-1">
                <AnimatedNumber target={act.total_deals ?? 0} />
                <span className="text-xs font-medium text-white/60">{t("statDeals")}</span>
              </div>
            </div>
          </section>
        </Reveal>
      )}

      {/* ── DATA CAPABILITIES ── */}
      <section className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mb-12 text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--green-600)]">
              {t("capEyebrow")}
            </span>
            <h2 className="mt-2 font-heading text-3xl font-extrabold text-[var(--ink)] sm:text-4xl">
              {t("capHeading")}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-[var(--ink-soft)]">
              {t("capSub")}
            </p>
          </div>
        </Reveal>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Reveal delay={0.05} className="h-full">
            <CapabilityCard
              icon="chart"
              title={t("cap1Title")}
              body={t("cap1Body")}
              gradient="var(--green-600)"
              iconColor="text-[var(--green-700)]"
            />
          </Reveal>
          <Reveal delay={0.1} className="h-full">
            <CapabilityCard
              icon="pin"
              title={t("cap2Title")}
              body={t("cap2Body")}
              gradient="var(--amber-500)"
              iconColor="text-[var(--amber-700)]"
            />
          </Reveal>
          <Reveal delay={0.15} className="h-full">
            <CapabilityCard
              icon="cloudRain"
              title={t("cap3Title")}
              body={t("cap3Body")}
              gradient="#1d6fa5"
              iconColor="text-blue-600"
            />
          </Reveal>
          <Reveal delay={0.2} className="h-full">
            <CapabilityCard
              icon="scale"
              title={t("cap4Title")}
              body={t("cap4Body")}
              gradient="var(--green-700)"
              iconColor="text-[var(--green-800)]"
            />
          </Reveal>
          <Reveal delay={0.25} className="h-full">
            <CapabilityCard
              icon="spark"
              title={t("cap5Title")}
              body={t("cap5Body")}
              gradient="#7c3aed"
              iconColor="text-purple-600"
            />
          </Reveal>
          <Reveal delay={0.3} className="h-full">
            <CapabilityCard
              icon="alert"
              title={t("cap6Title")}
              body={t("cap6Body")}
              gradient="var(--red-500)"
              iconColor="text-[var(--red-500)]"
            />
          </Reveal>
        </div>
      </section>

      {/* ── DATA SOURCES SECTION ── */}
      <Reveal>
        <section className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-8 sm:p-12">
            <div className="mb-10 text-center">
              <span className="text-xs font-bold uppercase tracking-widest text-[var(--green-600)]">
                {t("sourcesEyebrow")}
              </span>
              <h2 className="mt-2 font-heading text-2xl font-extrabold text-[var(--ink)] sm:text-3xl">
                {t("sourcesHeading")}
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-[var(--ink-soft)]">
                {t("sourcesSub")}
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
              {[
                { name: "AGMARKNET", desc: t("sourceAgmarknetDesc"), icon: "chart" },
                { name: "Open-Meteo", desc: t("sourceMeteoDesc"), icon: "cloudRain" },
                { name: "NASA POWER", desc: t("sourceNasaDesc"), icon: "globe" },
                { name: "OSRM", desc: t("sourceOsrmDesc"), icon: "truck" },
                { name: "Nager.Date", desc: t("sourceNagerDesc"), icon: "calendar" },
              ].map((source) => (
                <div
                  key={source.name}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5 text-center transition-all duration-200 hover:border-[var(--green-400)]/40 hover:shadow-md"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--green-100)] text-[var(--green-700)]">
                    <Icon name={source.icon} size={20} />
                  </div>
                  <span className="font-heading text-sm font-bold text-[var(--ink)]">{source.name}</span>
                  <span className="text-xs text-[var(--ink-soft)]">{source.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      {/* ── EXPLORE PREVIEW ── */}
      <Reveal>
        <section className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--green-700)] to-[var(--green-900)] text-white">
            <div className="flex flex-col lg:flex-row lg:items-center">
              <div className="flex-1 p-8 sm:p-12">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-white/70">
                  <Icon name="globe" size={12} />
                  {t("previewBadge")}
                </span>
                <h2 className="mt-5 font-heading text-3xl font-extrabold sm:text-4xl">
                  {t("previewHeading")}
                </h2>
                <p className="mt-4 max-w-lg text-white/65">
                  {t("previewSub")}
                </p>
                <div className="mt-8">
                  <Link
                    href="/explore"
                    className="inline-flex items-center gap-2 rounded-xl bg-[var(--amber-500)] px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-amber-900/30 transition hover:brightness-110"
                  >
                    <Icon name="chart" size={17} />
                    {t("previewCtaOpen")}
                  </Link>
                </div>
              </div>

              {/* Mock dashboard preview */}
              <div className="flex-1 p-6 sm:p-8">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-widest text-white/50">{t("previewStatewideAvg")}</span>
                    <span className="text-xs text-white/40">{t("previewTrend30d")}</span>
                  </div>
                  {/* Fake sparkline bars */}
                  <div className="flex items-end gap-1">
                    {[35, 42, 38, 55, 48, 62, 58, 72, 65, 78, 74, 85, 80, 92, 88].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t-sm bg-gradient-to-t from-white/20 to-white/40"
                        style={{ height: `${h}px` }}
                      />
                    ))}
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {[
                      { label: t("previewTopGainer"), val: "Onion +12%" },
                      { label: t("previewTopFaller"), val: "Tomato −8%" },
                      { label: t("previewMarkets"), val: `${act?.markets_reporting ?? 420}` },
                    ].map((s) => (
                      <div key={s.label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                        <span className="block text-[10px] font-bold uppercase text-white/40">{s.label}</span>
                        <span className="font-heading text-sm font-bold text-white">{s.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      {/* ── CLOSING CTA ── */}
      <Reveal>
        <section className="mx-auto max-w-screen-xl rounded-3xl px-6 py-16 text-center sm:px-12 sm:py-20">
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--green-600)]">
            {t("closingEyebrow")}
          </span>
          <h2 className="mt-3 font-heading text-3xl font-extrabold text-[var(--ink)] sm:text-4xl">
            {t("closingHeading")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[var(--ink-soft)]">
            {t("closingSub")}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/login" className="al-btn-primary px-8 py-3.5 text-base">
              <Icon name="leaf" size={17} />
              {t("closingCtaStart")}
            </Link>
            <Link href="/explore" className="al-btn-outline px-8 py-3.5 text-base">
              {t("closingCtaBrowse")}
            </Link>
          </div>
        </section>
      </Reveal>
    </div>
  );
}

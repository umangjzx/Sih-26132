"use client";

/**
 * /about — AgriLink's story, mission, values, and the team behind the platform.
 *
 * Layout: Hero → Mission & Vision cards → Impact numbers → Values grid →
 * Problem statement → Team/SIH context → Closing CTA.
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

/* ── Value card ─────────────────────────────────────────────────────────── */

function ValueCard({
  icon,
  title,
  body,
  delay = 0,
}: {
  icon: string;
  title: string;
  body: string;
  delay?: number;
}) {
  return (
    <Reveal delay={delay} className="h-full">
      <div className="group flex h-full flex-col gap-4 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-7 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--green-100)] text-[var(--green-700)] transition-transform duration-300 group-hover:scale-110">
          <Icon name={icon} size={26} />
        </div>
        <h3 className="font-heading text-lg font-bold text-[var(--ink)]">{title}</h3>
        <p className="text-[15px] leading-relaxed text-[var(--ink-soft)]">{body}</p>
      </div>
    </Reveal>
  );
}

/* ── Main page ──────────────────────────────────────────────────────────── */

export default function AboutPageClient() {
  const t = useTranslations("aboutPage");
  const { location } = useLocation();
  const [overview, setOverview] = useState<PublicOverview | null>(null);

  useEffect(() => {
    fetchPublicOverview(location?.state).then(setOverview).catch(() => null);
  }, [location?.state]);

  const act = overview?.activity;
  const marketsLabel = act?.markets_reporting != null ? `${act.markets_reporting}` : "500+";
  const cropsLabel = act?.crops_tracked != null ? `${act.crops_tracked}` : "150+";

  return (
    <div className="flex flex-col gap-20 pb-20">

      {/* ── HERO ── */}
      <section
        className="relative -mx-4 -mt-4 overflow-hidden rounded-b-[2.5rem] sm:-mx-6 sm:-mt-6 lg:-mx-8 lg:-mt-8"
        style={{
          background: "linear-gradient(155deg, #071a0f 0%, #0e3421 35%, #1a4a2e 65%, #2E7D32 100%)",
          minHeight: 480,
        }}
      >
        <div className="pointer-events-none absolute -left-24 top-1/4 h-80 w-80 rounded-full bg-[var(--amber-400)]/8 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-16 right-1/4 h-64 w-64 rounded-full bg-[var(--green-400)]/12 blur-[80px]" />
        <div className="al-grid-overlay pointer-events-none absolute inset-0" />

        <div className="relative z-10 mx-auto flex max-w-screen-xl flex-col items-center px-6 py-24 text-center sm:py-32">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/8 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white/70 backdrop-blur-sm">
            <Icon name="leaf" size={13} className="text-[var(--amber-400)]" />
            {t("heroBadge")}
          </span>

          <h1 className="mt-7 font-heading text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.75rem]">
            {t("heroTitle1")}{" "}
            <span className="bg-gradient-to-r from-[var(--amber-400)] to-[var(--amber-500)] bg-clip-text text-transparent">
              {t("heroTitle2")}
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/65">
            {t("heroSub")}
          </p>
        </div>
      </section>

      {/* ── MISSION & VISION ── */}
      <section className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <Reveal delay={0.05}>
            <div className="flex h-full flex-col justify-between rounded-3xl bg-gradient-to-br from-[var(--green-700)] to-[var(--green-900)] p-8 text-white sm:p-12">
              <div>
                <div className="mb-5 inline-flex items-center justify-center rounded-2xl bg-white/10 p-3.5 text-[var(--amber-400)]">
                  <Icon name="spark" size={28} />
                </div>
                <h2 className="font-heading text-3xl font-extrabold">{t("missionTitle")}</h2>
                <p className="mt-4 max-w-md text-lg leading-relaxed text-white/75">
                  {t("missionBody")}
                </p>
              </div>
              <div className="mt-8 flex items-center gap-3 rounded-xl border border-white/15 bg-white/8 p-4 backdrop-blur-md">
                <Icon name="shield" size={20} className="text-[var(--amber-400)]" />
                <span className="text-sm font-semibold text-white/80">
                  {t("missionNote")}
                </span>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="flex h-full flex-col justify-between rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-8 sm:p-12">
              <div>
                <div className="mb-5 inline-flex items-center justify-center rounded-2xl bg-[var(--amber-100)] p-3.5 text-[var(--amber-700)]">
                  <Icon name="globe" size={28} />
                </div>
                <h2 className="font-heading text-3xl font-extrabold text-[var(--ink)]">{t("visionTitle")}</h2>
                <p className="mt-4 max-w-md text-lg leading-relaxed text-[var(--ink-soft)]">
                  {t("visionBody")}
                </p>
              </div>
              <div className="mt-8 flex items-center gap-3 rounded-xl border border-[var(--green-600)]/20 bg-[var(--green-50)] p-4">
                <Icon name="connection" size={20} className="text-[var(--green-700)]" />
                <span className="text-sm font-semibold text-[var(--green-800)]">
                  {t("visionNote")}
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── IMPACT NUMBERS ── */}
      <Reveal>
        <section className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-6 rounded-3xl bg-gradient-to-br from-[var(--green-700)] to-[var(--green-900)] p-8 text-center text-white sm:grid-cols-4 sm:p-12">
            {[
              { value: marketsLabel, label: t("statMarkets") },
              { value: cropsLabel, label: t("statCrops") },
              { value: "3", label: t("statLanguages") },
              { value: "6", label: t("statDataSources") },
            ].map((s) => (
              <div key={s.label} className="flex flex-col gap-1">
                <span className="font-heading text-3xl font-extrabold sm:text-4xl">{s.value}</span>
                <span className="text-xs font-medium text-white/60">{s.label}</span>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {/* ── VALUES GRID ── */}
      <section className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mb-12 text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--green-600)]">
              {t("valuesEyebrow")}
            </span>
            <h2 className="mt-2 font-heading text-3xl font-extrabold text-[var(--ink)] sm:text-4xl">
              {t("valuesHeading")}
            </h2>
          </div>
        </Reveal>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <ValueCard
            icon="chart"
            title={t("value1Title")}
            body={t("value1Body")}
            delay={0.05}
          />
          <ValueCard
            icon="spark"
            title={t("value2Title")}
            body={t("value2Body")}
            delay={0.1}
          />
          <ValueCard
            icon="connection"
            title={t("value3Title")}
            body={t("value3Body")}
            delay={0.15}
          />
          <ValueCard
            icon="shield"
            title={t("value4Title")}
            body={t("value4Body")}
            delay={0.2}
          />
        </div>
      </section>

      {/* ── PROBLEM STATEMENT ── */}
      <Reveal>
        <section className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)]">
            <div className="flex flex-col lg:flex-row">
              {/* Visual */}
              <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-[var(--green-700)] to-[var(--green-900)] p-12 text-white">
                <div className="text-center">
                  <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-white/10 backdrop-blur-md">
                    <Icon name="leaf" size={48} className="text-[var(--amber-400)]" />
                  </div>
                  <h3 className="font-heading text-2xl font-extrabold">{t("challengeOrgTitle")}</h3>
                  <p className="mt-2 text-sm text-white/60">{t("challengePS")}</p>
                  <p className="mt-1 text-sm text-white/60">{t("challengeGovt")}</p>
                </div>
              </div>

              {/* Copy */}
              <div className="flex-1 p-8 sm:p-12">
                <span className="text-xs font-bold uppercase tracking-widest text-[var(--green-600)]">
                  {t("challengeEyebrow")}
                </span>
                <h2 className="mt-3 font-heading text-2xl font-extrabold text-[var(--ink)] sm:text-3xl">
                  {t("challengeHeading")}
                </h2>
                <p className="mt-4 text-[15px] leading-relaxed text-[var(--ink-soft)]">
                  {t("challengeBody1")}
                </p>
                <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-soft)]">
                  {t("challengeBody2")}
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {["data.gov.in", "Open-Meteo", "NASA POWER", "OSRM", "Nager.Date"].map((s) => (
                    <span
                      key={s}
                      className="rounded-full border border-[var(--line)] bg-[var(--paper)] px-3 py-1 text-xs font-semibold text-[var(--ink-soft)]"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      {/* ── TECH STACK HIGHLIGHTS ── */}
      <Reveal>
        <section className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--green-600)]">
              {t("techEyebrow")}
            </span>
            <h2 className="mt-2 font-heading text-3xl font-extrabold text-[var(--ink)] sm:text-4xl">
              {t("techHeading")}
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: "globe", title: t("tech1Title"), body: t("tech1Body") },
              { icon: "connection", title: t("tech2Title"), body: t("tech2Body") },
              { icon: "shield", title: t("tech3Title"), body: t("tech3Body") },
              { icon: "chart", title: t("tech4Title"), body: t("tech4Body") },
              { icon: "spark", title: t("tech5Title"), body: t("tech5Body") },
              { icon: "coins", title: t("tech6Title"), body: t("tech6Body") },
            ].map((item, i) => (
              <Reveal key={item.title} delay={i * 0.05} className="h-full">
                <div className="h-full rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 transition-all duration-200 hover:shadow-md">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--green-100)] text-[var(--green-700)]">
                    <Icon name={item.icon} size={20} />
                  </div>
                  <h3 className="font-heading text-base font-bold text-[var(--ink)]">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-soft)]">{item.body}</p>
                </div>
              </Reveal>
            ))}
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
            <Link href="/features" className="al-btn-outline px-8 py-3.5 text-base">
              {t("closingCtaFeatures")}
            </Link>
          </div>
        </section>
      </Reveal>
    </div>
  );
}

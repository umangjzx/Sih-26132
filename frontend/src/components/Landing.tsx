"use client";

/**
 * AgriLink public landing page — "/" for logged-out visitors.
 *
 * Sections:
 *   1. Hero          — photo bg + green scrim, headline, two CTAs, live chips
 *   2. Live snapshot — platform activity, no login
 *   3. Features      — four benefit cards  (id="features")
 *   4. How it works  — three numbered steps (id="how")
 *   5. About strip   — tagline + brand values (id="about")
 *   6. Closing CTA   — repeated hero treatment
 *
 * Typography: Poppins throughout (via --font-poppins CSS var + font-heading).
 * Colours: 100 % CSS tokens — no raw hex.
 */

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { fetchPublicOverview, type PublicOverview } from "@/lib/api";
import { useLocation } from "@/lib/useLocation";
import { Icon } from "./ui";

/* ── Micro-components ─────────────────────────────────────────────────── */

function LiveStat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-heading text-3xl font-extrabold leading-tight text-white">
        {value}
      </span>
      <span className="text-xs font-medium text-white/60">{label}</span>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
  accent = false,
}: {
  icon: string;
  title: string;
  body: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`
        group flex flex-col gap-4 rounded-2xl border p-6 shadow-[var(--shadow-sm)]
        transition-all duration-200 hover:shadow-[var(--shadow-md)] hover:-translate-y-1
        ${accent
          ? "border-[var(--green-600)]/20 bg-gradient-to-br from-[var(--green-700)] to-[var(--green-900)] text-white"
          : "border-[var(--line)] bg-[var(--surface)]"
        }
      `}
    >
      <span
        className={`
          flex h-12 w-12 items-center justify-center rounded-xl
          ${accent
            ? "bg-white/15 text-[var(--amber-400)]"
            : "bg-[var(--green-50)] text-[var(--green-700)]"
          }
        `}
      >
        <Icon name={icon} size={24} />
      </span>
      <div>
        <h3
          className={`font-heading text-base font-bold leading-snug ${
            accent ? "text-white" : "text-[var(--ink)]"
          }`}
        >
          {title}
        </h3>
        <p
          className={`mt-1.5 text-sm leading-relaxed ${
            accent ? "text-white/75" : "text-[var(--ink-soft)]"
          }`}
        >
          {body}
        </p>
      </div>
    </div>
  );
}

function StepCard({
  n,
  icon,
  title,
  body,
}: {
  n: number;
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--green-700)] text-sm font-extrabold text-white">
          {n}
        </span>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--green-50)] text-[var(--green-700)]">
          <Icon name={icon} size={20} />
        </span>
      </div>
      <div>
        <h3 className="font-heading text-base font-bold text-[var(--ink)]">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-soft)]">{body}</p>
      </div>
    </li>
  );
}

function ValueProp({
  icon,
  label,
  sub,
}: {
  icon: string;
  label: string;
  sub: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
        <Icon name={icon} size={20} className="text-[var(--amber-400)]" />
      </span>
      <span className="font-heading text-sm font-bold text-white">{label}</span>
      <span className="text-xs text-white/60">{sub}</span>
    </div>
  );
}

/* ── Landing page ─────────────────────────────────────────────────────── */

export function Landing() {
  const t                       = useTranslations("landing");
  const tn                      = useTranslations("nav");
  const { location }            = useLocation();
  const [overview, setOverview] = useState<PublicOverview | null>(null);

  useEffect(() => {
    fetchPublicOverview(location?.state).then(setOverview).catch(() => null);
  }, [location?.state]);

  const act = overview?.activity;

  const benefits = [
    { icon: "chart",     title: t("b1Title"), body: t("b1Body"), accent: false },
    { icon: "handshake", title: t("b2Title"), body: t("b2Body"), accent: false },
    { icon: "spark",     title: t("b3Title"), body: t("b3Body"), accent: true  },
    { icon: "coins",     title: t("b4Title"), body: t("b4Body"), accent: false },
  ];

  const steps = [
    { icon: "chart",     title: t("s1Title"), body: t("s1Body") },
    { icon: "leaf",      title: t("s2Title"), body: t("s2Body") },
    { icon: "truck",     title: t("s3Title"), body: t("s3Body") },
  ];

  return (
    <div className="flex flex-col gap-16 pb-8">

      {/* ── 1. Hero ───────────────────────────────────────────────────── */}
      <section
        aria-label="Hero"
        className="
          relative -mx-4 -mt-4 overflow-hidden rounded-b-3xl text-white
          sm:-mx-6 sm:-mt-6
          lg:-mx-8 lg:-mt-8
        "
        style={{
          backgroundImage:
            "linear-gradient(105deg, rgba(7,26,15,0.97) 0%, rgba(7,26,15,0.95) 42%, rgba(14,52,33,0.75) 62%, rgba(14,52,33,0.30) 100%), url('/landing-hero.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center center",
        }}
      >
        {/* Grid overlay */}
        <div className="al-grid-overlay absolute inset-0 pointer-events-none" />

        {/* Ambient glow */}
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-[var(--green-600)]/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 h-48 w-80 rounded-full bg-[var(--amber-500)]/8 blur-3xl pointer-events-none" />

        {/* Inner flex: left copy + right panel */}
        <div className="relative z-10 flex min-h-[560px] flex-col items-start gap-10 px-6 py-16 sm:px-10 sm:py-20 lg:min-h-[640px] lg:flex-row lg:items-center lg:gap-16 lg:px-16 lg:py-24">

          {/* ── Left: copy ── */}
          <div className="w-full lg:max-w-[50%]">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/30 px-3 py-1 text-xs font-bold uppercase tracking-widest text-white/80 backdrop-blur-sm">
              <Icon name="leaf" size={12} />
              {t("badge")}
            </span>

            <h1 className="mt-5 font-heading text-4xl font-extrabold leading-[1.04] tracking-tight sm:text-5xl lg:text-[3.6rem]">
              {t("heroLine1")}{" "}
              <span className="text-[var(--amber-400)]">{t("heroLine2")}</span>
            </h1>

            <p className="mt-5 max-w-lg text-[1.05rem] leading-[1.65] text-white/75">
              {t("heroSubtitle")}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="al-btn-primary px-7 py-3 text-base">
                <Icon name="leaf" size={17} />
                {t("ctaGetStarted")}
              </Link>
              <Link href="/explore" className="al-btn-ghost px-7 py-3 text-base">
                <Icon name="chart" size={17} />
                {t("ctaSeePrices")}
              </Link>
            </div>

            <p className="mt-7 text-xs text-white/40">{t("heroFoot")}</p>
          </div>

          {/* ── Right: feature panel — always visible, never empty ── */}
          <div className="w-full lg:flex-1">
            {/* Shared container — same card style whether data loaded or not */}
            <div className="rounded-2xl border border-white/10 bg-black/20 p-6 backdrop-blur-md ring-1 ring-white/5">

              {/* Stats grid — shown when API data is available */}
              {act && (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/70">
                    {t("liveTitle", { area: act.state ?? "India" })}
                  </p>
                  <div className="mt-3 mb-5 grid grid-cols-2 gap-x-6 gap-y-4 border-b border-white/10 pb-5">
                    <LiveStat value={act.markets_reporting ?? 0} label={t("liveMarkets")} />
                    <LiveStat value={act.crops_tracked    ?? 0} label={t("liveCrops")}   />
                    <LiveStat value={act.open_lots        ?? 0} label={t("liveLots")}    />
                    <LiveStat value={act.open_demands     ?? 0} label={t("liveDemands")} />
                  </div>
                  {overview?.as_of && (
                    <p className="mb-4 text-[10px] text-white/45">{t("liveAsOf")}: {overview.as_of}</p>
                  )}
                </>
              )}

              {/* Feature rows — always visible */}
              <div className="flex flex-col gap-2.5">
                {[
                  { icon: "chart",     label: t("chipTrend"),      sub: "7 / 30 / 90-day price trends"        },
                  { icon: "pin",       label: t("chipBestMarket"), sub: "Net price after transport cost"      },
                  { icon: "cloudRain", label: t("chipWeather"),    sub: "7-day forecast + MSP gap"            },
                  { icon: "shield",    label: t("chipVerified"),   sub: "Admin-verified seller & buyer badges"},
                ].map(({ icon, label, sub }) => (
                  <div key={label} className="flex items-center gap-3 rounded-xl bg-white/5 px-3.5 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--amber-500)]/15">
                      <Icon name={icon} size={17} className="text-[var(--amber-400)]" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-snug text-white">{label}</p>
                      <p className="text-[11px] leading-snug text-white/45 truncate">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ── 2. Live snapshot (mobile only — desktop shows inside hero) ── */}
      {act && (
        <section
          aria-label="Live platform stats"
          className="
            -mt-10 rounded-2xl border border-[var(--line)] bg-[var(--surface)]
            p-5 shadow-[var(--shadow-md)] lg:hidden
          "
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--green-700)]">
              {t("liveTitle", { area: act.state ?? "India" })}
            </p>
            <Link href="/explore" className="text-xs font-bold text-[var(--green-700)] hover:underline">
              {t("liveMore")} →
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <LiveStat value={act.markets_reporting ?? 0} label={t("liveMarkets")} />
            <LiveStat value={act.crops_tracked    ?? 0} label={t("liveCrops")}   />
            <LiveStat value={act.open_lots        ?? 0} label={t("liveLots")}    />
            <LiveStat value={act.open_demands     ?? 0} label={t("liveDemands")} />
          </div>
        </section>
      )}

      {/* ── 3. Features ───────────────────────────────────────────────── */}
      <section id="features" className="scroll-mt-[4.5rem]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--green-600)]">
              {tn("features")}
            </p>
            <h2 className="mt-1 font-heading text-3xl font-extrabold text-[var(--ink)]">
              {t("benefitsHeading")}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--ink-soft)]">
              {t("benefitsSub")}
            </p>
          </div>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((b) => (
            <FeatureCard key={b.title} {...b} />
          ))}
        </div>
      </section>

      {/* ── 4. How it works ────────────────────────────────────────────── */}
      <section
        id="how"
        className="scroll-mt-[4.5rem] rounded-3xl bg-[var(--green-50)] px-6 py-10 sm:px-10 sm:py-12"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--green-600)]">
          {tn("howItWorks")}
        </p>
        <h2 className="mt-1 font-heading text-3xl font-extrabold text-[var(--ink)]">
          {t("howHeading")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--ink-soft)]">
          {t("howSub")}
        </p>
        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          {steps.map((s, i) => (
            <StepCard key={s.title} n={i + 1} icon={s.icon} title={s.title} body={s.body} />
          ))}
        </ol>
        <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-[var(--ink-soft)]">
          <Icon name="shield" size={14} className="mt-0.5 shrink-0 text-[var(--green-600)]" />
          {t("howNote")}
        </p>
      </section>

      {/* ── 5. About value props ───────────────────────────────────────── */}
      <section
        id="about"
        className="scroll-mt-[4.5rem] overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--green-700)] to-[var(--green-900)] px-6 py-10 sm:px-10 sm:py-12"
      >
        <div className="al-grid-overlay absolute inset-0 pointer-events-none rounded-3xl" />
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--green-300)]">
            {tn("about")}
          </p>
          <h2 className="mt-1 font-heading text-3xl font-extrabold text-white">
            AgriLink
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70">
            SIH 2026 · PS-26132 · Govt. of Maharashtra / MSInS
          </p>
          <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
            <ValueProp icon="chart"     label="Data-driven"   sub="Real mandi prices & trends"     />
            <ValueProp icon="spark"     label="Explainable"   sub="Every factor shown on screen"   />
            <ValueProp icon="connection" label="Market linkage" sub="Connects farmers & buyers"    />
            <ValueProp icon="shield"    label="Transparent"   sub="Open & trusted platform"        />
          </div>
        </div>
      </section>

      {/* ── 6. Closing CTA ─────────────────────────────────────────────── */}
      <section
        className="overflow-hidden rounded-3xl p-8 text-center text-white sm:p-12"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(7,26,15,0.88), rgba(14,52,33,0.94)), url('/landing-hero.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="al-grid-overlay absolute inset-0 pointer-events-none rounded-3xl" />
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--green-300)]">
            {t("tagline")}
          </p>
          <h2 className="mt-3 font-heading text-3xl font-extrabold sm:text-4xl">
            {t("ctaHeading")}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/75">
            {t("ctaSub")}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/login"   className="al-btn-primary px-7 py-3">
              <Icon name="leaf" size={16} />
              {t("ctaGetStarted")}
            </Link>
            <Link href="/explore" className="al-btn-ghost px-7 py-3">
              {t("ctaBrowse")}
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}

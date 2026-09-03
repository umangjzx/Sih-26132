"use client";

/**
 * AgriLink public landing page — "/" for logged-out visitors.
 *
 * Premium SaaS landing experience:
 *   1. Hero — Full-bleed gradient with bg-image, dual CTAs, live stats panel
 *   2. Trust bar — Government & data credibility
 *   3. Features — Bento-style preview cards
 *   4. How it works — Three-step visual
 *   5. Ecosystem links — Cross-page navigation
 *   6. Closing CTA — Conversion-focused dark-gradient section
 *
 * Note: This component is rendered inside ClientAppShell's public layout,
 * which wraps content in px-4/6/8 + max-w-screen-xl. Negative margins
 * (-mx-4 etc.) are used to break out for full-bleed hero/CTA sections.
 */

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { fetchPublicOverview, type PublicOverview } from "@/lib/api";
import { useLocation } from "@/lib/useLocation";
import { Icon } from "./ui";

/* ── Reveal (intersection-based fade-up) ───────────────────────────────── */

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
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
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
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.7s cubic-bezier(.22,1,.36,1) ${delay}s, transform 0.7s cubic-bezier(.22,1,.36,1) ${delay}s`,
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
          const duration = 1400;
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
    <span ref={ref}>
      {value.toLocaleString()}
      {suffix}
    </span>
  );
}

/* ── Live stat component ────────────────────────────────────────────────── */

function LiveStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col gap-1 text-center">
      <span className="font-heading text-3xl font-extrabold leading-tight text-white sm:text-4xl">
        <AnimatedNumber target={value} />
      </span>
      <span className="text-xs font-medium text-white/55">{label}</span>
    </div>
  );
}

/* ── Feature preview card ───────────────────────────────────────────────── */

function FeaturePreviewCard({
  icon,
  title,
  body,
  iconBg,
  iconColor,
}: {
  icon: string;
  title: string;
  body: string;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="group flex h-full flex-col gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconBg} ${iconColor} transition-transform duration-300 group-hover:scale-110`}
      >
        <Icon name={icon} size={22} />
      </div>
      <h3 className="font-heading text-base font-bold text-[var(--ink)]">{title}</h3>
      <p className="text-sm leading-relaxed text-[var(--ink-soft)]">{body}</p>
    </div>
  );
}

/* ── Step card ──────────────────────────────────────────────────────────── */

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
    <div className="relative flex h-full flex-col items-center gap-4 text-center">
      <div className="relative">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--green-600)] to-[var(--green-700)] shadow-lg shadow-green-900/20">
          <Icon name={icon} size={28} className="text-white" />
        </div>
        <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--amber-500)] text-xs font-extrabold text-white shadow-md">
          {n}
        </span>
      </div>
      <h3 className="font-heading text-lg font-bold text-[var(--ink)]">{title}</h3>
      <p className="max-w-xs text-sm leading-relaxed text-[var(--ink-soft)]">{body}</p>
    </div>
  );
}

/* ── Ecosystem link card ────────────────────────────────────────────────── */

function EcoCard({
  href,
  icon,
  title,
  body,
}: {
  href: string;
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="group flex h-full items-start gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm transition-all duration-300 hover:border-[var(--green-400)]/40 hover:shadow-md"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--green-100)] text-[var(--green-700)] transition-transform duration-200 group-hover:scale-110">
        <Icon name={icon} size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-heading text-sm font-bold text-[var(--ink)] group-hover:text-[var(--green-700)]">
          {title}
        </h3>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--ink-soft)]">{body}</p>
      </div>
      <Icon
        name="arrowUp"
        size={16}
        className="mt-0.5 shrink-0 rotate-45 text-[var(--ink-mute)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--green-600)]"
      />
    </Link>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Landing page
   ═══════════════════════════════════════════════════════════════════════════ */

export function Landing() {
  const t = useTranslations("landing");
  const { location } = useLocation();
  const [overview, setOverview] = useState<PublicOverview | null>(null);

  useEffect(() => {
    fetchPublicOverview(location?.state)
      .then(setOverview)
      .catch(() => null);
  }, [location?.state]);

  const act = overview?.activity;

  return (
    <div className="flex flex-col gap-0 pb-0">
      {/* ── 1. HERO ──────────────────────────────────────────────────── */}
      <section
        aria-label="Hero"
        className="relative -mx-4 -mt-[5.75rem] overflow-hidden rounded-b-[2.5rem] text-white sm:-mx-6 lg:-mx-8"
        style={{
          background:
            "linear-gradient(145deg, #071a0f 0%, #0e3421 30%, #1a4a2e 60%, #2E7D32 100%)",
        }}
      >
        {/* Background image overlay */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "url('/bg-image.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.08,
          }}
        />
        {/* Decorative grid overlay */}
        <div className="al-grid-overlay pointer-events-none absolute inset-0" />
        {/* Ambient orbs */}
        <div
          className="pointer-events-none absolute right-0 top-0 h-[500px] w-[500px] rounded-full blur-[120px]"
          style={{ background: "rgba(129, 199, 132, 0.08)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-24 left-1/4 h-80 w-80 rounded-full blur-[100px]"
          style={{ background: "rgba(244, 164, 0, 0.06)" }}
        />

        <div className="relative z-10 mx-auto flex min-h-[580px] max-w-screen-xl flex-col items-start gap-12 px-6 py-20 sm:px-10 sm:py-24 lg:min-h-[640px] lg:flex-row lg:items-center lg:gap-16 lg:px-16 lg:py-28">
          {/* Left: Copy */}
          <div className="w-full lg:max-w-[55%]">
            <span
              className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-widest backdrop-blur-sm"
              style={{
                borderColor: "rgba(255,255,255,0.2)",
                background: "rgba(0,0,0,0.3)",
                color: "rgba(255,255,255,0.75)",
              }}
            >
              <Icon name="leaf" size={13} className="text-[var(--amber-400)]" />
              {t("badge")}
            </span>

            <h1 className="mt-6 font-heading text-[2.75rem] font-extrabold leading-[1.06] tracking-tight sm:text-5xl lg:text-[3.75rem]">
              {t("heroLine1")}{" "}
              <span className="bg-gradient-to-r from-[var(--amber-400)] to-[var(--amber-500)] bg-clip-text text-transparent">
                {t("heroLine2")}
              </span>
            </h1>

            <p
              className="mt-5 max-w-xl text-[1.075rem] leading-[1.7]"
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              {t("heroSubtitle")}
            </p>

            <div className="mt-9 flex flex-wrap gap-3.5">
              <Link
                href="/login"
                className="al-btn-primary px-8 py-3.5 text-base shadow-lg shadow-amber-900/30"
              >
                <Icon name="leaf" size={17} />
                {t("ctaGetStarted")}
              </Link>
              <Link href="/explore" className="al-btn-ghost px-8 py-3.5 text-base">
                <Icon name="chart" size={17} />
                {t("ctaSeePrices")}
              </Link>
            </div>

            <p className="mt-8 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
              {t("heroFoot")}
            </p>
          </div>

          {/* Right: Live stats + feature chips */}
          <div className="w-full lg:flex-1">
            <div
              className="rounded-3xl border p-6 backdrop-blur-xl sm:p-8"
              style={{
                borderColor: "rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)",
              }}
            >
              {/* Live stats */}
              {act && (
                <>
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.14em]"
                    style={{ color: "rgba(255,255,255,0.6)" }}
                  >
                    {t("liveTitle", { area: act.state ?? "India" })}
                  </p>
                  <div
                    className="mb-6 mt-3 grid grid-cols-2 gap-x-6 gap-y-4 border-b pb-6"
                    style={{ borderColor: "rgba(255,255,255,0.1)" }}
                  >
                    <LiveStat value={act.markets_reporting ?? 0} label={t("liveMarkets")} />
                    <LiveStat value={act.crops_tracked ?? 0} label={t("liveCrops")} />
                    <LiveStat value={act.open_lots ?? 0} label={t("liveLots")} />
                    <LiveStat value={act.open_demands ?? 0} label={t("liveDemands")} />
                  </div>
                  {overview?.as_of && (
                    <p className="mb-5 text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                      {t("liveAsOf")}: {overview.as_of}
                    </p>
                  )}
                </>
              )}

              {/* Feature chips */}
              <div className="flex flex-col gap-3">
                {[
                  { icon: "chart", label: t("chipTrend"), sub: "7 / 30 / 90-day price trends" },
                  { icon: "pin", label: t("chipBestMarket"), sub: "Net price after transport cost" },
                  { icon: "cloudRain", label: t("chipWeather"), sub: "7-day forecast + MSP gap" },
                  { icon: "shield", label: t("chipVerified"), sub: "Admin-verified seller & buyer badges" },
                ].map(({ icon, label, sub }) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 rounded-xl border px-4 py-2.5 transition-colors duration-200"
                    style={{
                      borderColor: "rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.04)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.08)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)";
                    }}
                  >
                    <Icon name={icon} size={18} className="shrink-0 text-[var(--amber-400)]" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-snug text-white">{label}</p>
                      <p
                        className="truncate text-[11px] leading-snug"
                        style={{ color: "rgba(255,255,255,0.4)" }}
                      >
                        {sub}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. TRUST BAR ─────────────────────────────────────────────── */}
      <Reveal>
        <section className="mx-auto -mt-6 w-full max-w-screen-xl">
          <div className="flex flex-wrap items-center justify-center gap-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-6 py-4 shadow-lg sm:gap-10 sm:px-10 sm:py-5">
            {[
              { icon: "shield", label: "Govt. of Maharashtra / MSInS" },
              { icon: "chart", label: "AGMARKNET verified data" },
              { icon: "globe", label: "English · Hindi · Marathi" },
              { icon: "coins", label: "100% free, no hidden fees" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <Icon name={item.icon} size={16} className="text-[var(--green-600)]" />
                <span className="text-xs font-semibold text-[var(--ink-soft)]">{item.label}</span>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {/* ── 3. FEATURES PREVIEW ──────────────────────────────────────── */}
      <section className="mx-auto mt-20 w-full max-w-screen-xl">
        <Reveal>
          <div className="mb-12 text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--green-600)]">
              {t("featuresEyebrow")}
            </span>
            <h2 className="mt-2 font-heading text-3xl font-extrabold text-[var(--ink)] sm:text-4xl">
              {t("benefitsHeading")}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-[var(--ink-soft)]">
              {t("benefitsSub")}
            </p>
          </div>
        </Reveal>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: "chart", title: t("b1Title"), body: t("b1Body"), iconBg: "bg-[var(--green-100)]", iconColor: "text-[var(--green-700)]" },
            { icon: "handshake", title: t("b2Title"), body: t("b2Body"), iconBg: "bg-blue-50", iconColor: "text-blue-600" },
            { icon: "spark", title: t("b3Title"), body: t("b3Body"), iconBg: "bg-[var(--amber-100)]", iconColor: "text-[var(--amber-700)]" },
            { icon: "coins", title: t("b4Title"), body: t("b4Body"), iconBg: "bg-[var(--green-50)]", iconColor: "text-[var(--green-700)]" },
          ].map((f, i) => (
            <Reveal key={f.title} delay={i * 0.06} className="h-full">
              <FeaturePreviewCard {...f} />
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.25}>
          <div className="mt-8 flex justify-center">
            <Link href="/features" className="al-btn-outline px-6 py-3 text-sm">
              {t("featuresSeeAll")}
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ── 4. HOW IT WORKS ──────────────────────────────────────────── */}
      <section className="mx-auto mt-20 w-full max-w-screen-xl">
        <Reveal>
          <div className="mb-12 text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--green-600)]">
              {t("howEyebrow")}
            </span>
            <h2 className="mt-2 font-heading text-3xl font-extrabold text-[var(--ink)] sm:text-4xl">
              {t("howHeading")}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-[var(--ink-soft)]">
              {t("howSub")}
            </p>
          </div>
        </Reveal>

        <div className="grid gap-12 sm:grid-cols-3">
          {[
            { icon: "chart", title: t("s1Title"), body: t("s1Body") },
            { icon: "leaf", title: t("s2Title"), body: t("s2Body") },
            { icon: "truck", title: t("s3Title"), body: t("s3Body") },
          ].map((s, i) => (
            <Reveal key={s.title} delay={i * 0.1} className="h-full">
              <StepCard n={i + 1} icon={s.icon} title={s.title} body={s.body} />
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.3}>
          <div className="mt-6 flex items-start justify-center gap-2 text-xs text-[var(--ink-soft)]">
            <Icon name="shield" size={14} className="mt-0.5 shrink-0 text-[var(--amber-500)]" />
            {t("howNote")}
          </div>
        </Reveal>

        <Reveal delay={0.35}>
          <div className="mt-8 flex justify-center">
            <Link href="/how-it-works" className="al-btn-outline px-6 py-3 text-sm">
              {t("howDetailedWalkthrough")}
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ── 5. ECOSYSTEM LINKS ───────────────────────────────────────── */}
      <section className="mx-auto mt-20 w-full max-w-screen-xl">
        <Reveal>
          <div className="mb-10 text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--green-600)]">
              {t("exploreEyebrow")}
            </span>
            <h2 className="mt-2 font-heading text-3xl font-extrabold text-[var(--ink)] sm:text-4xl">
              {t("exploreHeading")}
            </h2>
          </div>
        </Reveal>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Reveal delay={0.05} className="h-full">
            <EcoCard href="/features" icon="spark" title={t("ecoFeaturesTitle")} body={t("ecoFeaturesBody")} />
          </Reveal>
          <Reveal delay={0.1} className="h-full">
            <EcoCard href="/how-it-works" icon="connection" title={t("ecoHowTitle")} body={t("ecoHowBody")} />
          </Reveal>
          <Reveal delay={0.15} className="h-full">
            <EcoCard href="/market-insights" icon="chart" title={t("ecoInsightsTitle")} body={t("ecoInsightsBody")} />
          </Reveal>
          <Reveal delay={0.2} className="h-full">
            <EcoCard href="/about" icon="leaf" title={t("ecoAboutTitle")} body={t("ecoAboutBody")} />
          </Reveal>
        </div>
      </section>

      {/* ── 6. CLOSING CTA ───────────────────────────────────────────── */}
      <Reveal>
        <section className="mx-auto mt-20 w-full max-w-screen-xl">
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--green-700)] to-[var(--green-900)] text-white">
            <div className="relative px-8 py-16 text-center sm:px-16 sm:py-20">
              <div
                className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full blur-[80px]"
                style={{ background: "rgba(244, 164, 0, 0.08)" }}
              />
              <div
                className="pointer-events-none absolute -bottom-16 right-1/4 h-64 w-64 rounded-full blur-[80px]"
                style={{ background: "rgba(74, 157, 107, 0.1)" }}
              />

              <div className="relative z-10">
                <span className="text-xs font-bold uppercase tracking-widest text-[var(--amber-400)]">
                  {t("tagline")}
                </span>
                <h2 className="mt-4 font-heading text-3xl font-extrabold sm:text-4xl lg:text-5xl">
                  {t("ctaHeading")}
                </h2>
                <p
                  className="mx-auto mt-4 max-w-xl text-base leading-relaxed"
                  style={{ color: "rgba(255,255,255,0.7)" }}
                >
                  {t("ctaSub")}
                </p>
                <div className="mt-9 flex flex-wrap justify-center gap-4">
                  <Link
                    href="/login"
                    className="al-btn-primary px-8 py-3.5 text-base shadow-lg shadow-amber-900/30"
                  >
                    <Icon name="leaf" size={17} />
                    {t("ctaGetStarted")}
                  </Link>
                  <Link href="/explore" className="al-btn-ghost px-8 py-3.5 text-base">
                    {t("ctaBrowse")}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      {/* Bottom spacing */}
      <div className="h-16" />
    </div>
  );
}

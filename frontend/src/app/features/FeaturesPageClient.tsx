"use client";

/**
 * /features — Deep-dive into every AgriLink capability.
 *
 * Layout: Hero banner → Bento grid of feature cards → Deep-dive alternating
 * sections → Closing CTA.  Uses CSS-only animations (no JS animation libs).
 */

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { fetchPublicOverview, type PublicOverview } from "@/lib/api";
import { useLocation } from "@/lib/useLocation";
import { Icon } from "@/components/ui";

/* ── Intersection-based fade-in ─────────────────────────────────────────── */

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
      { threshold: 0.15 },
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
  )
}

/* ── Bento feature card ─────────────────────────────────────────────────── */

function BentoCard({
  icon,
  title,
  description,
  gradient,
  iconBg,
  iconColor,
  span = "1",
  children,
}: {
  icon: string;
  title: string;
  description: string;
  gradient?: string;
  iconBg: string;
  iconColor: string;
  span?: "1" | "2";
  children?: React.ReactNode;
}) {
  const colSpan = span === "2" ? "sm:col-span-2" : "";

  return (
    <div
      className={`group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-[var(--line)] shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${colSpan}`}
      style={{ background: gradient || "var(--surface)" }}
    >
      <div className="p-7 sm:p-8">
        <div
          className={`mb-5 inline-flex items-center justify-center rounded-2xl p-3.5 ${iconBg} ${iconColor} shadow-sm transition-transform duration-300 group-hover:scale-110`}
        >
          <Icon name={icon} size={26} />
        </div>
        <h3 className="font-heading text-xl font-bold leading-snug text-[var(--ink)] sm:text-2xl">
          {title}
        </h3>
        <p className="mt-2.5 max-w-md text-[15px] leading-relaxed text-[var(--ink-soft)]">
          {description}
        </p>
      </div>
      {children}
    </div>
  );
}

/* ── Deep-dive row (alternating left/right) ─────────────────────────────── */

function DeepDive({
  icon,
  label,
  title,
  body,
  bullets,
  reverse = false,
  accentColor = "var(--green-600)",
  delay = 0,
}: {
  icon: string;
  label: string;
  title: string;
  body: string;
  bullets: string[];
  reverse?: boolean;
  accentColor?: string;
  delay?: number;
}) {
  return (
    <Reveal delay={delay}>
      <div
        className={`flex flex-col gap-10 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-8 shadow-sm sm:p-12 lg:flex-row lg:items-center lg:gap-16 ${
          reverse ? "lg:flex-row-reverse" : ""
        }`}
      >
        {/* Visual side */}
        <div className="flex flex-1 items-center justify-center">
          <div
            className="flex h-40 w-40 items-center justify-center rounded-[2rem] shadow-lg sm:h-52 sm:w-52"
            style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)` }}
          >
            <Icon name={icon} size={64} className="text-white drop-shadow-lg" />
          </div>
        </div>

        {/* Copy side */}
        <div className="flex-1">
          <span
            className="inline-block rounded-full px-3.5 py-1 text-xs font-bold uppercase tracking-widest"
            style={{ background: `${accentColor}18`, color: accentColor }}
          >
            {label}
          </span>
          <h3 className="mt-4 font-heading text-2xl font-extrabold leading-snug text-[var(--ink)] sm:text-3xl">
            {title}
          </h3>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-soft)]">{body}</p>
          <ul className="mt-5 flex flex-col gap-2.5">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-sm text-[var(--ink)]">
                <span
                  className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                  style={{ background: `${accentColor}18`, color: accentColor }}
                >
                  <Icon name="leaf" size={11} />
                </span>
                {b}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Reveal>
  );
}

/* ── Main page ──────────────────────────────────────────────────────────── */

export default function FeaturesPageClient() {
  const t = useTranslations("featuresPage");
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
      <section className="relative -mx-4 -mt-4 overflow-hidden rounded-b-[2.5rem] sm:-mx-6 sm:-mt-6 lg:-mx-8 lg:-mt-8"
        style={{
          background: "linear-gradient(145deg, #0b2917 0%, #1a4a2e 45%, #2E7D32 100%)",
          minHeight: 420,
        }}
      >
        {/* Ambient orbs */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[var(--amber-500)]/10 blur-[100px]" />
        <div className="pointer-events-none absolute -bottom-16 left-1/4 h-64 w-64 rounded-full bg-[var(--green-400)]/15 blur-[80px]" />
        <div className="al-grid-overlay pointer-events-none absolute inset-0" />

        <div className="relative z-10 mx-auto flex max-w-screen-xl flex-col items-center px-6 py-20 text-center sm:py-28 lg:py-32">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/8 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white/70 backdrop-blur-sm">
            <Icon name="spark" size={13} className="text-[var(--amber-400)]" />
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
            <Link href="/login" className="al-btn-primary px-7 py-3.5 text-base">
              <Icon name="leaf" size={17} />
              {t("ctaStartFree")}
            </Link>
            <Link href="/explore" className="al-btn-ghost px-7 py-3.5 text-base">
              <Icon name="chart" size={17} />
              {t("ctaSeeLivePrices")}
            </Link>
          </div>
        </div>
      </section>

      {/* ── BENTO GRID ── */}
      <section className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mb-10 text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--green-600)]">
              {t("bentoEyebrow")}
            </span>
            <h2 className="mt-2 font-heading text-3xl font-extrabold text-[var(--ink)] sm:text-4xl">
              {t("bentoHeading")}
            </h2>
          </div>
        </Reveal>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Reveal delay={0.05} className="h-full sm:col-span-2">
            <BentoCard
              icon="chart"
              title={t("card1Title")}
              description={t("card1Desc")}
              iconBg="bg-[var(--green-100)]"
              iconColor="text-[var(--green-700)]"
              span="2"
            >
              {/* Mock price chart */}
              <div className="mx-8 mb-0 rounded-t-2xl border-x border-t border-[var(--line)] bg-[var(--paper)] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-widest text-[var(--ink-soft)]">{t("mockCropMarket")}</span>
                    <div className="font-heading text-3xl font-extrabold text-[var(--green-700)]">
                      ₹2,450 <span className="text-sm font-medium text-[var(--ink-soft)]">{t("mockPerQtl")}</span>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 rounded-full bg-[var(--green-50)] px-3 py-1 text-sm font-bold text-[var(--green-600)]">
                    <Icon name="arrowUp" size={14} /> +4.2%
                  </span>
                </div>
                {/* Fake chart bars */}
                <div className="mt-4 flex items-end gap-1.5">
                  {[40, 55, 48, 62, 58, 72, 68, 80, 75, 88, 82, 95].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t-md bg-[var(--green-400)]/60 transition-all duration-500" style={{ height: `${h}px` }} />
                  ))}
                </div>
              </div>
            </BentoCard>
          </Reveal>

          <Reveal delay={0.1} className="h-full">
            <BentoCard
              icon="spark"
              title={t("card2Title")}
              description={t("card2Desc")}
              gradient="linear-gradient(145deg, #1a4a2e, #0e3421)"
              iconBg="bg-white/10"
              iconColor="text-[var(--amber-400)]"
            >
              <div className="mx-7 mb-7 rounded-xl border border-white/15 bg-white/8 p-5 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--green-500)] text-white shadow-lg shadow-green-900/40">
                    <Icon name="leaf" size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">{t("mockAiSignal")}</p>
                    <p className="font-heading text-lg font-bold text-white">{t("mockSellNow")}</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  {[t("mockTagPrice"), t("mockTagWeather"), t("mockTagMsp")].map((tag) => (
                    <span key={tag} className="rounded-full border border-white/15 bg-white/8 px-2.5 py-0.5 text-[10px] font-semibold text-white/60">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </BentoCard>
          </Reveal>

          <Reveal delay={0.15} className="h-full">
            <BentoCard
              icon="pin"
              title={t("card3Title")}
              description={t("card3Desc")}
              iconBg="bg-[var(--amber-100)]"
              iconColor="text-[var(--amber-700)]"
            />
          </Reveal>

          <Reveal delay={0.2} className="h-full">
            <BentoCard
              icon="handshake"
              title={t("card4Title")}
              description={t("card4Desc")}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
            />
          </Reveal>

          <Reveal delay={0.25} className="h-full">
            <BentoCard
              icon="shield"
              title={t("card5Title")}
              description={t("card5Desc")}
              iconBg="bg-[var(--green-50)]"
              iconColor="text-[var(--green-700)]"
            />
          </Reveal>
        </div>
      </section>

      {/* ── DEEP DIVES ── */}
      <section className="mx-auto flex w-full max-w-screen-xl flex-col gap-10 px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--green-600)]">
              {t("deepDiveEyebrow")}
            </span>
            <h2 className="mt-2 font-heading text-3xl font-extrabold text-[var(--ink)] sm:text-4xl">
              {t("deepDiveHeading")}
            </h2>
          </div>
        </Reveal>

        <DeepDive
          icon="chart"
          label={t("dd1Label")}
          title={t("dd1Title")}
          body={t("dd1Body")}
          bullets={[
            t("dd1Bullet1"),
            t("dd1Bullet2"),
            t("dd1Bullet3"),
            t("dd1Bullet4"),
          ]}
          accentColor="var(--green-600)"
          delay={0.05}
        />

        <DeepDive
          icon="spark"
          label={t("dd2Label")}
          title={t("dd2Title")}
          body={t("dd2Body")}
          bullets={[
            t("dd2Bullet1"),
            t("dd2Bullet2"),
            t("dd2Bullet3"),
            t("dd2Bullet4"),
          ]}
          reverse
          accentColor="var(--amber-500)"
          delay={0.1}
        />

        <DeepDive
          icon="truck"
          label={t("dd3Label")}
          title={t("dd3Title")}
          body={t("dd3Body")}
          bullets={[
            t("dd3Bullet1"),
            t("dd3Bullet2"),
            t("dd3Bullet3"),
            t("dd3Bullet4"),
          ]}
          accentColor="var(--green-700)"
          delay={0.15}
        />

        <DeepDive
          icon="users"
          label={t("dd4Label")}
          title={t("dd4Title")}
          body={t("dd4Body")}
          bullets={[
            t("dd4Bullet1"),
            t("dd4Bullet2"),
            t("dd4Bullet3"),
            t("dd4Bullet4"),
          ]}
          reverse
          accentColor="#7c3aed"
          delay={0.2}
        />
      </section>

      {/* ── NUMBERS STRIP ── */}
      <Reveal>
        <section className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-6 rounded-3xl bg-gradient-to-br from-[var(--green-700)] to-[var(--green-900)] p-8 text-center text-white sm:grid-cols-4 sm:p-12">
            {[
              { value: marketsLabel, label: t("statMarkets") },
              { value: cropsLabel, label: t("statCrops") },
              { value: "3", label: t("statLanguages") },
              { value: "100%", label: t("statFree") },
            ].map((s) => (
              <div key={s.label} className="flex flex-col gap-1">
                <span className="font-heading text-3xl font-extrabold sm:text-4xl">{s.value}</span>
                <span className="text-xs font-medium text-white/60">{s.label}</span>
              </div>
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
            <Link href="/explore" className="al-btn-outline px-8 py-3.5 text-base">
              {t("closingCtaExplore")}
            </Link>
          </div>
        </section>
      </Reveal>
    </div>
  );
}

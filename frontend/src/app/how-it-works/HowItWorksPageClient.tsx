"use client";

/**
 * /how-it-works — Role-based tabbed walkthrough of the AgriLink platform.
 *
 * Layout: Hero → Role tabs (Farmer / Buyer / FPO) → Step timeline →
 * Trust signals → Closing CTA.
 */

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
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

/* ── Step data ──────────────────────────────────────────────────────────── */

type Step = { icon: string; title: string; body: string };
type Translate = ReturnType<typeof useTranslations>;

function getFarmerSteps(t: Translate): Step[] {
  return [
    { icon: "chart", title: t("farmer1Title"), body: t("farmer1Body") },
    { icon: "spark", title: t("farmer2Title"), body: t("farmer2Body") },
    { icon: "leaf", title: t("farmer3Title"), body: t("farmer3Body") },
    { icon: "handshake", title: t("farmer4Title"), body: t("farmer4Body") },
    { icon: "truck", title: t("farmer5Title"), body: t("farmer5Body") },
  ];
}

function getBuyerSteps(t: Translate): Step[] {
  return [
    { icon: "users", title: t("buyer1Title"), body: t("buyer1Body") },
    { icon: "chart", title: t("buyer2Title"), body: t("buyer2Body") },
    { icon: "handshake", title: t("buyer3Title"), body: t("buyer3Body") },
    { icon: "coins", title: t("buyer4Title"), body: t("buyer4Body") },
    { icon: "shield", title: t("buyer5Title"), body: t("buyer5Body") },
  ];
}

function getFpoSteps(t: Translate): Step[] {
  return [
    { icon: "users", title: t("fpo1Title"), body: t("fpo1Body") },
    { icon: "chart", title: t("fpo2Title"), body: t("fpo2Body") },
    { icon: "spark", title: t("fpo3Title"), body: t("fpo3Body") },
    { icon: "handshake", title: t("fpo4Title"), body: t("fpo4Body") },
    { icon: "coins", title: t("fpo5Title"), body: t("fpo5Body") },
  ];
}

function getTabs(t: Translate) {
  return [
    { key: "farmer", label: t("tabFarmer"), icon: "leaf", steps: getFarmerSteps(t) },
    { key: "buyer", label: t("tabBuyer"), icon: "users", steps: getBuyerSteps(t) },
    { key: "fpo", label: t("tabFpo"), icon: "connection", steps: getFpoSteps(t) },
  ] as const;
}

/* ── Timeline step card ─────────────────────────────────────────────────── */

function TimelineStep({
  step,
  index,
  total,
}: {
  step: Step;
  index: number;
  total: number;
}) {
  const isLast = index === total - 1;

  return (
    <Reveal delay={index * 0.08}>
      <div className="relative flex gap-6">
        {/* Vertical line + circle */}
        <div className="flex flex-col items-center">
          <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--green-600)] to-[var(--green-700)] text-white shadow-lg shadow-green-900/20">
            <span className="font-heading text-lg font-extrabold">{index + 1}</span>
          </div>
          {!isLast && (
            <div className="w-0.5 flex-1 bg-gradient-to-b from-[var(--green-400)]/40 to-[var(--green-400)]/10" />
          )}
        </div>

        {/* Content */}
        <div className={`pb-12 ${isLast ? "pb-0" : ""}`}>
          <div className="flex items-center gap-2.5">
            <Icon name={step.icon} size={18} className="text-[var(--amber-500)]" />
            <h3 className="font-heading text-lg font-bold text-[var(--ink)]">{step.title}</h3>
          </div>
          <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-[var(--ink-soft)]">
            {step.body}
          </p>
        </div>
      </div>
    </Reveal>
  );
}

/* ── Main page ──────────────────────────────────────────────────────────── */

export default function HowItWorksPageClient() {
  const t = useTranslations("howItWorksPage");
  const TABS = getTabs(t);
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["key"]>("farmer");
  const currentTab = TABS.find((tab) => tab.key === activeTab)!;

  return (
    <div className="flex flex-col gap-20 pb-20">

      {/* ── HERO ── */}
      <section
        className="relative -mx-4 -mt-4 overflow-hidden rounded-b-[2.5rem] sm:-mx-6 sm:-mt-6 lg:-mx-8 lg:-mt-8"
        style={{
          background: "linear-gradient(145deg, #0b2917 0%, #1a4a2e 45%, #2E7D32 100%)",
          minHeight: 380,
        }}
      >
        <div className="pointer-events-none absolute -left-20 -top-20 h-80 w-80 rounded-full bg-[var(--amber-500)]/8 blur-[100px]" />
        <div className="pointer-events-none absolute -bottom-20 right-1/4 h-64 w-64 rounded-full bg-[var(--green-300)]/12 blur-[80px]" />
        <div className="al-grid-overlay pointer-events-none absolute inset-0" />

        <div className="relative z-10 mx-auto flex max-w-screen-xl flex-col items-center px-6 py-20 text-center sm:py-24 lg:py-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/8 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white/70 backdrop-blur-sm">
            <Icon name="connection" size={13} className="text-[var(--amber-400)]" />
            {t("heroBadge")}
          </span>

          <h1 className="mt-7 font-heading text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
            {t("heroTitle1")}{" "}
            <span className="bg-gradient-to-r from-[var(--amber-400)] to-[var(--amber-500)] bg-clip-text text-transparent">
              {t("heroTitleBrand")}
            </span>{" "}
            {t("heroTitle2")}
          </h1>

          <p className="mt-5 max-w-2xl text-[1.05rem] leading-relaxed text-white/65">
            {t("heroSub")}
          </p>
        </div>
      </section>

      {/* ── ROLE TABS ── */}
      <section className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mb-12 flex justify-center">
            <div className="inline-flex rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-sm">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-all duration-200 ${
                    activeTab === tab.key
                      ? "bg-[var(--green-700)] text-white shadow-md shadow-green-900/20"
                      : "text-[var(--ink-soft)] hover:bg-[var(--paper)] hover:text-[var(--ink)]"
                  }`}
                >
                  <Icon name={tab.icon} size={16} />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        {/* ── TIMELINE ── */}
        <div className="mx-auto max-w-2xl" key={activeTab}>
          {currentTab.steps.map((step, i) => (
            <TimelineStep key={`${activeTab}-${i}`} step={step} index={i} total={currentTab.steps.length} />
          ))}
        </div>
      </section>

      {/* ── TRUST SIGNALS ── */}
      <Reveal>
        <section className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-8 sm:p-12">
            <div className="mb-8 text-center">
              <span className="text-xs font-bold uppercase tracking-widest text-[var(--green-600)]">
                {t("trustEyebrow")}
              </span>
              <h2 className="mt-2 font-heading text-2xl font-extrabold text-[var(--ink)] sm:text-3xl">
                {t("trustHeading")}
              </h2>
            </div>

            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: "shield", title: t("trust1Title"), body: t("trust1Body") },
                { icon: "chart", title: t("trust2Title"), body: t("trust2Body") },
                { icon: "coins", title: t("trust3Title"), body: t("trust3Body") },
                { icon: "connection", title: t("trust4Title"), body: t("trust4Body") },
              ].map((item) => (
                <div key={item.title} className="flex flex-col gap-3 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--green-50)] text-[var(--green-700)]">
                    <Icon name={item.icon} size={24} />
                  </div>
                  <h3 className="font-heading text-base font-bold text-[var(--ink)]">{item.title}</h3>
                  <p className="text-sm text-[var(--ink-soft)]">{item.body}</p>
                </div>
              ))}
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
              {t("closingCtaCreate")}
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

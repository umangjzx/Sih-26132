"use client";

/**
 * Public landing page (shown at "/" to logged-out visitors).
 * Introduces the platform, its benefits, and how it works, and routes visitors
 * to the few things they can use without an account (live prices) or to sign up.
 * The full module navigation only appears after login.
 */

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { fetchPublicOverview, type PublicOverview } from "@/lib/api";
import { useLocation } from "@/lib/useLocation";
import { Icon } from "./ui";

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-heading text-2xl font-extrabold text-[var(--green-800)]">{value}</span>
      <span className="text-xs font-medium text-[var(--ink-soft)]">{label}</span>
    </div>
  );
}

export function Landing() {
  const t = useTranslations("landing");
  const { location } = useLocation();
  const [overview, setOverview] = useState<PublicOverview | null>(null);

  useEffect(() => {
    fetchPublicOverview(location?.state).then(setOverview).catch(() => setOverview(null));
  }, [location?.state]);

  const benefits = [
    { icon: "chart", title: t("b1Title"), body: t("b1Body") },
    { icon: "handshake", title: t("b2Title"), body: t("b2Body") },
    { icon: "spark", title: t("b3Title"), body: t("b3Body") },
    { icon: "coins", title: t("b4Title"), body: t("b4Body") },
  ];

  const steps = [
    { icon: "chart", title: t("s1Title"), body: t("s1Body") },
    { icon: "leaf", title: t("s2Title"), body: t("s2Body") },
    { icon: "truck", title: t("s3Title"), body: t("s3Body") },
  ];

  const act = overview?.activity;

  return (
    <div className="flex flex-col gap-12 pb-4">
      {/* ─── Hero ─── */}
      <section
        className="relative -mx-4 -mt-4 overflow-hidden rounded-b-3xl px-6 py-14 text-white sm:-mx-6 sm:-mt-6 sm:px-10 lg:-mx-8 lg:-mt-8 lg:px-16 lg:py-20"
        style={{ background: "linear-gradient(135deg,#0e3b20 0%,#1E5B3A 55%,#2E7D32 100%)" }}
      >
        <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-10 left-1/4 h-44 w-44 rounded-full bg-[var(--amber-500)]/10 blur-2xl" />
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-white/80">
            <Icon name="leaf" size={13} /> {t("badge")}
          </span>
          <h1 className="mt-4 font-heading text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            {t("heroLine1")} <span className="text-[var(--amber-500)]">{t("heroLine2")}</span>
          </h1>
          <p className="mt-4 max-w-xl text-base text-white/75 sm:text-lg">{t("heroSubtitle")}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--amber-500)] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-amber-900/30 transition hover:brightness-110"
            >
              <Icon name="leaf" size={16} /> {t("ctaGetStarted")}
            </Link>
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-bold backdrop-blur-sm transition hover:bg-white/20"
            >
              <Icon name="chart" size={16} /> {t("ctaSeePrices")}
            </Link>
          </div>
          <p className="mt-4 text-xs text-white/55">{t("heroFoot")}</p>
        </div>
      </section>

      {/* ─── Live snapshot (public, no login) ─── */}
      {act && (
        <section className="-mt-4 rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--green-700)]">
              {t("liveTitle", { area: act.state ?? "All India" })}
            </p>
            <Link href="/explore" className="text-xs font-bold text-[var(--green-700)] hover:underline">
              {t("liveMore")} →
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat value={act.markets_reporting ?? 0} label={t("liveMarkets")} />
            <Stat value={act.crops_tracked ?? 0} label={t("liveCrops")} />
            <Stat value={act.open_lots ?? 0} label={t("liveLots")} />
            <Stat value={act.open_demands ?? 0} label={t("liveDemands")} />
          </div>
          {overview?.as_of && (
            <p className="mt-3 text-xs text-[var(--ink-soft)]">{t("liveAsOf")}: {overview.as_of}</p>
          )}
        </section>
      )}

      {/* ─── Benefits ─── */}
      <section>
        <h2 className="font-heading text-2xl font-extrabold text-[var(--ink)]">{t("benefitsHeading")}</h2>
        <p className="mt-1 max-w-2xl text-sm text-[var(--ink-soft)]">{t("benefitsSub")}</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {benefits.map((b) => (
            <div key={b.title} className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--green-100)] text-[var(--green-700)]">
                <Icon name={b.icon} size={22} />
              </span>
              <h3 className="mt-3 font-heading text-base font-bold text-[var(--ink)]">{b.title}</h3>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section id="how" className="scroll-mt-24 rounded-3xl bg-[var(--paper)] p-6 sm:p-8">
        <h2 className="font-heading text-2xl font-extrabold text-[var(--ink)]">{t("howHeading")}</h2>
        <p className="mt-1 max-w-2xl text-sm text-[var(--ink-soft)]">{t("howSub")}</p>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--green-700)] text-xs font-extrabold text-white">
                  {i + 1}
                </span>
                <Icon name={s.icon} size={18} className="text-[var(--green-700)]" />
              </div>
              <h3 className="mt-3 font-heading text-base font-bold text-[var(--ink)]">{s.title}</h3>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">{s.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-5 flex items-start gap-2 text-xs text-[var(--ink-soft)]">
          <Icon name="shield" size={14} className="mt-0.5 shrink-0 text-[var(--green-700)]" />
          {t("howNote")}
        </p>
      </section>

      {/* ─── Closing CTA ─── */}
      <section className="rounded-3xl border border-[var(--green-600)]/25 bg-[var(--green-100)] p-8 text-center">
        <h2 className="font-heading text-2xl font-extrabold text-[var(--green-900)]">{t("ctaHeading")}</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-[var(--green-800)]">{t("ctaSub")}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--green-700)] px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[var(--green-900)]"
          >
            <Icon name="leaf" size={16} /> {t("ctaGetStarted")}
          </Link>
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--green-700)] px-6 py-3 text-sm font-bold text-[var(--green-800)] transition hover:bg-white"
          >
            {t("ctaBrowse")}
          </Link>
        </div>
      </section>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { useAppLocale } from "@/i18n/LocaleProvider";
import { fetchBrief, type BriefAction, type DecisionBrief as Brief } from "@/lib/api";
import type { CropMarketState } from "@/lib/useCropMarket";
import { useLocation } from "@/lib/useLocation";
import { Card, Icon, SectionHeader, Skeleton } from "./ui";

const URGENCY_STYLE: Record<
  BriefAction["urgency"],
  { dot: string; chip: string; ring: string }
> = {
  now: {
    dot: "bg-[var(--red-500)]",
    chip: "bg-[var(--red-100)] text-[var(--red-700)]",
    ring: "border-[var(--red-500)]/25",
  },
  soon: {
    dot: "bg-[var(--amber-500)]",
    chip: "bg-[var(--amber-100)] text-[var(--amber-700)]",
    ring: "border-[var(--amber-500)]/25",
  },
  watch: {
    dot: "bg-[var(--green-600)]",
    chip: "bg-[var(--green-100)] text-[var(--green-700)]",
    ring: "border-[var(--green-600)]/20",
  },
};

const KIND_ICON: Record<BriefAction["kind"], string> = {
  sell: "coins",
  wait: "clock",
  hold: "clock",
  msp: "shield",
  best_market: "truck",
  holiday: "calendar",
  weather: "cloudRain",
  calendar: "calendar",
  buyers: "users",
  storage: "warehouse",
};

export function DecisionBrief({ cm }: { cm: CropMarketState }) {
  const t = useTranslations("brief");
  const ts = useTranslations("signal");
  const { locale } = useAppLocale();
  const { location } = useLocation();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!cm.crop || !cm.market) return;
    setLoading(true);
    setError(false);
    try {
      const b = await fetchBrief({
        crop: cm.crop,
        market: cm.market,
        district: cm.district || undefined,
        lat: location?.lat ?? undefined,
        lon: location?.lon ?? undefined,
        lang: locale,
      });
      setBrief(b);
    } catch {
      setError(true);
      setBrief(null);
    } finally {
      setLoading(false);
    }
  }, [cm.crop, cm.market, cm.district, location?.lat, location?.lon, locale]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <Card>
        <SectionHeader icon="spark" title={t("title")} />
        <Skeleton className="h-16 w-full" />
        <div className="mt-3 flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      </Card>
    );
  }

  if (error || !brief) {
    return (
      <Card>
        <SectionHeader icon="spark" title={t("title")} />
        <p className="text-sm text-[var(--ink-soft)]">{t("loadError")}</p>
      </Card>
    );
  }

  const confLevel = t(
    `confidence_${brief.headline.confidence}` as
      | "confidence_high"
      | "confidence_moderate"
      | "confidence_low",
  );
  const recLabel = ts(brief.headline.action).toUpperCase();

  return (
    <Card>
      <SectionHeader icon="spark" title={t("title")} />

      {/* headline + short summary */}
      <div className="rounded-xl bg-[var(--green-100)]/60 p-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-heading text-2xl font-extrabold text-[var(--green-900)]">
            {recLabel}
          </span>
          <span className="text-xs font-semibold text-[var(--ink-soft)]">
            {t("confidence", { level: confLevel })} · {t("priceLine", { price: brief.price.latest_per_qtl.toFixed(0) })}
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
          <span className="font-bold text-[var(--green-700)]">{t("inShort")}: </span>
          {brief.summary}
        </p>
      </div>

      {/* ranked actions */}
      <ol className="mt-3 flex flex-col gap-2">
        {brief.actions.length === 0 && (
          <li className="text-sm text-[var(--ink-soft)]">{t("noActions")}</li>
        )}
        {brief.actions.map((a) => {
          const u = URGENCY_STYLE[a.urgency];
          return (
            <li
              key={a.rank}
              className={`flex gap-3 rounded-2xl border bg-white p-3.5 shadow-sm ${u.ring}`}
            >
              <div className="flex flex-col items-center gap-1.5 pt-0.5">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-white ${u.dot}`}
                >
                  {a.rank}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Icon name={KIND_ICON[a.kind] ?? "spark"} size={15} className="text-[var(--ink-soft)]" />
                  <span className="font-semibold text-[var(--ink)]">{a.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${u.chip}`}>
                    {t(
                      `urgency_${a.urgency}` as "urgency_now" | "urgency_soon" | "urgency_watch",
                    )}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--ink-soft)]">{a.detail}</p>
                {a.kind === "buyers" && (
                  <Link
                    href={`/browse?crop=${encodeURIComponent(brief.crop)}`}
                    className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-[var(--green-700)] hover:underline"
                  >
                    {t("viewBuyers")} &rarr;
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-3 flex items-start gap-1.5 border-t border-[var(--line)]/60 pt-2 text-xs text-[var(--ink-soft)]">
        <Icon name="shield" size={13} className="mt-0.5 shrink-0" />
        {t("asOf", { date: brief.as_of, market: brief.reference_market })}. {t("basis")}
      </p>
    </Card>
  );
}

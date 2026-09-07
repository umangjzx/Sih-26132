"use client";

/**
 * Market Intelligence hub — merges the former /prices and /explore pages
 * into one destination with two tabs, reached from either URL (both stay
 * live so every existing link/bookmark/marketing CTA keeps working):
 *
 *   /prices  -> defaults to "trends"   (one crop/market: chart, signal, best market)
 *   /explore -> defaults to "overview" (statewide: movers, district gaps, realisation)
 *
 * The active tab is mirrored in ?tab= so either view stays bookmarkable and
 * sharable on its own, which /explore's own docs promise ("Sharable").
 */

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { OverviewTab } from "@/app/explore/OverviewTab";
import { TrendsTab } from "@/app/prices/TrendsTab";
import { Icon } from "@/components/ui";

type Tab = "trends" | "overview";

export function MarketIntelligenceHub({ defaultTab }: { defaultTab: Tab }) {
  const t = useTranslations("home");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab: Tab = params.get("tab") === "trends" || params.get("tab") === "overview"
    ? (params.get("tab") as Tab)
    : defaultTab;

  function setTab(next: Tab) {
    const sp = new URLSearchParams(params.toString());
    sp.set("tab", next);
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        role="tablist"
        aria-label={t("marketIntelTabsLabel")}
        className="inline-flex w-fit gap-1 rounded-xl border border-[var(--line)] bg-white p-1 shadow-sm"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "trends"}
          onClick={() => setTab("trends")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition ${
            tab === "trends"
              ? "bg-[var(--green-700)] text-white shadow-sm"
              : "text-[var(--ink-soft)] hover:bg-[var(--paper)]"
          }`}
        >
          <Icon name="chart" size={15} />
          {t("tabTrends")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "overview"}
          onClick={() => setTab("overview")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition ${
            tab === "overview"
              ? "bg-[var(--green-700)] text-white shadow-sm"
              : "text-[var(--ink-soft)] hover:bg-[var(--paper)]"
          }`}
        >
          <Icon name="globe" size={15} />
          {t("tabOverview")}
        </button>
      </div>

      {tab === "trends" ? <TrendsTab /> : <OverviewTab />}
    </div>
  );
}

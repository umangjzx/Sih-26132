"use client";

/** "Charts & Trends" tab of the Market Intelligence hub — formerly the whole
 * /prices page. One crop/market at a time: full trend chart, sell/wait
 * signal, weather, MSP, and the diesel-costed best market. */

import { useTranslations } from "next-intl";

import { CropMarketPicker } from "@/components/CropMarketPicker";
import { PageHeader } from "@/components/PageHeader";
import { PriceDetail } from "@/components/PriceDetail";
import { StateDataNotice } from "@/components/StateDataNotice";
import { Icon } from "@/components/ui";
import { useCropMarket } from "@/lib/useCropMarket";

export function TrendsTab() {
  const t = useTranslations("home");
  const cm = useCropMarket();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon="chart"
        title={t("pricesTitle")}
        subtitle={t("pricesDesc")}
      />

      {/* Filter bar */}
      <div className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--ink-soft)] mb-3">
          <Icon name="pin" size={14} />
          {t("selectCropMarket")}
        </div>
        <CropMarketPicker cm={cm} />
      </div>

      {cm.error ? (
        <div className="rounded-2xl border border-[var(--red-500)]/30 bg-[var(--red-100)] px-5 py-4 text-sm text-[var(--red-700)]">
          {t("loadError")}
        </div>
      ) : cm.noDataForState ? (
        <StateDataNotice state={cm.scopeState} />
      ) : (
        <PriceDetail cm={cm} />
      )}
    </div>
  );
}

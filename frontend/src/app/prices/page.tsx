"use client";

import { useTranslations } from "next-intl";
import { Suspense } from "react";

import { CropMarketPicker } from "@/components/CropMarketPicker";
import { PageHeader } from "@/components/PageHeader";
import { PriceDetail } from "@/components/PriceDetail";
import { Icon, Skeleton } from "@/components/ui";
import { useCropMarket } from "@/lib/useCropMarket";

function PricesInner() {
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
          Select Crop &amp; Market
        </div>
        <CropMarketPicker cm={cm} />
      </div>

      {cm.error ? (
        <div className="rounded-2xl border border-[var(--red-500)]/30 bg-[var(--red-100)] px-5 py-4 text-sm text-[var(--red-700)]">
          {t("loadError")}
        </div>
      ) : (
        <PriceDetail cm={cm} />
      )}
    </div>
  );
}

export default function PricesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <PricesInner />
    </Suspense>
  );
}

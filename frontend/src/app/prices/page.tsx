"use client";

import { useTranslations } from "next-intl";
import { Suspense } from "react";

import { CropMarketPicker } from "@/components/CropMarketPicker";
import { PriceDetail } from "@/components/PriceDetail";
import { useCropMarket } from "@/lib/useCropMarket";

function PricesInner() {
  const t = useTranslations("home");
  const cm = useCropMarket();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">{t("pricesTitle")}</h1>
        <p className="mt-1 text-stone-600">{t("pricesDesc")}</p>
      </div>
      <CropMarketPicker cm={cm} />
      {cm.error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{t("loadError")}</p>
      ) : (
        <PriceDetail cm={cm} />
      )}
    </div>
  );
}

export default function PricesPage() {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-stone-200" />}>
      <PricesInner />
    </Suspense>
  );
}

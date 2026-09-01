"use client";

import { useTranslations } from "next-intl";
import { Suspense } from "react";

import { AdvisorDetail } from "@/components/AdvisorDetail";
import { CropMarketPicker } from "@/components/CropMarketPicker";
import { Icon, Skeleton } from "@/components/ui";
import { useCropMarket } from "@/lib/useCropMarket";

function AdvisorInner() {
  const t = useTranslations("home");
  const cm = useCropMarket();

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="rounded-2xl border border-[var(--green-600)]/20 bg-gradient-to-r from-[var(--green-50)] to-white p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--green-700)] text-white">
            <Icon name="spark" size={24} />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-[var(--green-900)]">
              {t("advisorTitle")}
            </h1>
            <p className="mt-0.5 text-sm text-[var(--ink-soft)]">{t("advisorDesc")}</p>
          </div>
        </div>
        <div className="mt-4 border-t border-[var(--line)] pt-4">
          <CropMarketPicker cm={cm} />
        </div>
      </div>

      {cm.error ? (
        <p className="rounded-2xl bg-[var(--red-100)] px-5 py-4 text-sm text-[var(--red-700)]">
          {t("loadError")}
        </p>
      ) : (
        <AdvisorDetail cm={cm} />
      )}
    </div>
  );
}

export default function AdvisorPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col gap-4">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    }>
      <AdvisorInner />
    </Suspense>
  );
}

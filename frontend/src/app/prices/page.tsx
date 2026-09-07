"use client";

import { Suspense } from "react";

import { MarketIntelligenceHub } from "@/components/MarketIntelligenceHub";
import { Skeleton } from "@/components/ui";

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
      <MarketIntelligenceHub defaultTab="trends" />
    </Suspense>
  );
}

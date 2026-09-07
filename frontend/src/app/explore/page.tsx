"use client";

/** Public statewide price-transparency dashboard (v1.1). No login. Sharable.
 * Now the "State Overview" tab of the Market Intelligence hub — see
 * MarketIntelligenceHub for why /prices and /explore both stay live. */

import { Suspense } from "react";

import { MarketIntelligenceHub } from "@/components/MarketIntelligenceHub";
import { Skeleton } from "@/components/ui";

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-52" />
        </div>
      }
    >
      <MarketIntelligenceHub defaultTab="overview" />
    </Suspense>
  );
}

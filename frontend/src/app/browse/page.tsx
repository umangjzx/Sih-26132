"use client";

/**
 * Discovery board — a buyer browses nearby open lots, a farmer browses nearby
 * open demands. Now the "Discover" tab of the Marketplace hub — see
 * MarketplaceHub for why /browse and /matches both stay live.
 */

import { Suspense } from "react";

import { MarketplaceHub } from "@/components/MarketplaceHub";

export default function BrowsePage() {
  return (
    <Suspense fallback={<div className="al-skeleton h-40" />}>
      <MarketplaceHub defaultTab="discover" />
    </Suspense>
  );
}

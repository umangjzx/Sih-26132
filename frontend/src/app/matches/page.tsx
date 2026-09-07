"use client";

/** Every scored match for the caller. Now the "My Matches" tab of the
 * Marketplace hub — see MarketplaceHub for why /browse and /matches both
 * stay live. */

import { Suspense } from "react";

import { MarketplaceHub } from "@/components/MarketplaceHub";

export default function MatchesPage() {
  return (
    <Suspense fallback={<div className="al-skeleton h-40" />}>
      <MarketplaceHub defaultTab="myMatches" />
    </Suspense>
  );
}

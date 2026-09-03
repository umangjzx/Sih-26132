import type { Metadata } from "next";

import MarketInsightsPageClient from "./MarketInsightsPageClient";

export const metadata: Metadata = {
  title: "Market insights — AgriLink",
  description:
    "AgriLink's data intelligence layer: live mandi prices, trends, weather and MSP context for Maharashtra and beyond.",
};

export default function MarketInsightsPage() {
  return <MarketInsightsPageClient />;
}

import type { Metadata } from "next";

import MarketInsightsPageClient from "./MarketInsightsPageClient";

const title = "Market insights — HarvestIQ";
const description =
  "HarvestIQ's data intelligence layer: live mandi prices, trends, weather and MSP context for Maharashtra and beyond.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: "website" },
  twitter: { card: "summary", title, description },
};

export default function MarketInsightsPage() {
  return <MarketInsightsPageClient />;
}

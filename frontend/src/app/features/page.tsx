import type { Metadata } from "next";

import FeaturesPageClient from "./FeaturesPageClient";

export const metadata: Metadata = {
  title: "Features — HarvestIQ",
  description:
    "Live mandi prices, an explainable sell/wait signal, verified buyers, and market intelligence — everything HarvestIQ gives farmers and buyers.",
};

export default function FeaturesPage() {
  return <FeaturesPageClient />;
}

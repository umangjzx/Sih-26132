import type { Metadata } from "next";

import FeaturesPageClient from "./FeaturesPageClient";

const title = "Features — HarvestIQ";
const description =
  "Live mandi prices, an explainable sell/wait signal, verified buyers, and market intelligence — everything HarvestIQ gives farmers and buyers.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: "website" },
  twitter: { card: "summary", title, description },
};

export default function FeaturesPage() {
  return <FeaturesPageClient />;
}

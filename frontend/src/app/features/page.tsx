import type { Metadata } from "next";

import FeaturesPageClient from "./FeaturesPageClient";

export const metadata: Metadata = {
  title: "Features — AgriLink",
  description:
    "Live mandi prices, an explainable sell/wait signal, verified buyers, and market intelligence — everything AgriLink gives farmers and buyers.",
};

export default function FeaturesPage() {
  return <FeaturesPageClient />;
}

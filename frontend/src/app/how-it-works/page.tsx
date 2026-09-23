import type { Metadata } from "next";

import HowItWorksPageClient from "./HowItWorksPageClient";

export const metadata: Metadata = {
  title: "How it works — HarvestIQ",
  description:
    "Three steps from checking a crop's price to getting paid — how HarvestIQ connects farmers and buyers.",
};

export default function HowItWorksPage() {
  return <HowItWorksPageClient />;
}

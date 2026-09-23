import type { Metadata } from "next";

import HowItWorksPageClient from "./HowItWorksPageClient";

const title = "How it works — HarvestIQ";
const description =
  "Three steps from checking a crop's price to getting paid — how HarvestIQ connects farmers and buyers.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: "website" },
  twitter: { card: "summary", title, description },
};

export default function HowItWorksPage() {
  return <HowItWorksPageClient />;
}

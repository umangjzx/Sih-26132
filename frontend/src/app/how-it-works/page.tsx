import type { Metadata } from "next";

import HowItWorksPageClient from "./HowItWorksPageClient";

export const metadata: Metadata = {
  title: "How it works — AgriLink",
  description:
    "Three steps from checking a crop's price to getting paid — how AgriLink connects farmers and buyers.",
};

export default function HowItWorksPage() {
  return <HowItWorksPageClient />;
}

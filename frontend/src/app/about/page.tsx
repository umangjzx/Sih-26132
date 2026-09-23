import type { Metadata } from "next";

import AboutPageClient from "./AboutPageClient";

const title = "About — HarvestIQ";
const description =
  "HarvestIQ's story, mission, and the team building a transparent agricultural marketplace for Maharashtra farmers and buyers.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: "website" },
  twitter: { card: "summary", title, description },
};

export default function AboutPage() {
  return <AboutPageClient />;
}

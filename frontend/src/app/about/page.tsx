import type { Metadata } from "next";

import AboutPageClient from "./AboutPageClient";

export const metadata: Metadata = {
  title: "About — AgriLink",
  description:
    "AgriLink's story, mission, and the team building a transparent agricultural marketplace for Maharashtra farmers and buyers.",
};

export default function AboutPage() {
  return <AboutPageClient />;
}

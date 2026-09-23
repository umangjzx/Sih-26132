import type { Metadata } from "next";

import JudgesPageClient from "./JudgesPageClient";

const title = "Judges & Evaluation — HarvestIQ";
const description =
  "Project evidence, validation, and technical documentation hub for SIH 2026 judges — architecture, data flow, database design, security, testing, and honest limitations, all traced to the real codebase.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: "website" },
  twitter: { card: "summary", title, description },
};

export default function JudgesPage() {
  return <JudgesPageClient />;
}

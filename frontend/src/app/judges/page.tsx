import type { Metadata } from "next";

import JudgesPageClient from "./JudgesPageClient";

export const metadata: Metadata = {
  title: "Judges & Evaluation — AgriLink",
  description:
    "Project evidence, validation, and technical documentation hub for SIH 2026 judges — architecture, data flow, database design, security, testing, and honest limitations, all traced to the real codebase.",
};

export default function JudgesPage() {
  return <JudgesPageClient />;
}

import type { Metadata } from "next";

import LoginPageClient from "./LoginPageClient";

const title = "Sign in — HarvestIQ";
const description =
  "Sign in or create a free HarvestIQ account to see live mandi prices, an explainable sell/wait signal, and connect with verified buyers.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: "website" },
  twitter: { card: "summary", title, description },
};

export default function LoginPage() {
  return <LoginPageClient />;
}

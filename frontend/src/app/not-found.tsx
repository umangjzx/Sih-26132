import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/Logo";
import { Icon } from "@/components/ui";

export const metadata: Metadata = {
  title: "Page not found — HarvestIQ",
  description: "The page you're looking for doesn't exist or may have moved.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <div
      className="relative flex min-h-[70vh] flex-col items-center justify-center overflow-hidden rounded-[2.5rem] px-6 py-16 text-center"
      style={{
        background: "linear-gradient(155deg, #071a0f 0%, #0e3421 40%, #1a4a2e 70%, #2E7D32 100%)",
      }}
    >
      {/* Decorative grid overlay, matching the marketing hero sections */}
      <div className="al-grid-overlay pointer-events-none absolute inset-0" />
      <div
        className="al-decorative pointer-events-none absolute right-0 top-0 h-[400px] w-[400px] rounded-full blur-[120px]"
        style={{ background: "rgba(129, 199, 132, 0.08)" }}
      />
      <div
        className="al-decorative pointer-events-none absolute -bottom-24 left-1/4 h-72 w-72 rounded-full blur-[100px]"
        style={{ background: "rgba(244, 164, 0, 0.08)" }}
      />

      <div className="relative z-10 flex flex-col items-center">
        <Link href="/" className="mb-10 inline-flex items-center gap-2" aria-label="HarvestIQ home">
          <Logo size={40} variant="sidebar" />
        </Link>

        <span className="font-heading text-7xl font-extrabold leading-none tracking-tight text-white sm:text-8xl">
          4
          <span className="bg-gradient-to-r from-[var(--amber-400)] to-[var(--amber-500)] bg-clip-text text-transparent">
            0
          </span>
          4
        </span>

        <h1 className="mt-6 font-heading text-2xl font-extrabold leading-tight text-white sm:text-3xl">
          Page not found
        </h1>
        <p className="mt-3 max-w-md text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
          The page you&apos;re looking for doesn&apos;t exist, may have moved, or the link might be broken.
        </p>

        <div className="mt-9 flex flex-wrap justify-center gap-3.5">
          <Link href="/" className="al-btn-primary px-8 py-3.5 text-base shadow-lg shadow-amber-900/30">
            <Icon name="leaf" size={17} />
            Back to home
          </Link>
          <Link href="/features" className="al-btn-ghost px-8 py-3.5 text-base">
            Explore features
          </Link>
        </div>
      </div>
    </div>
  );
}

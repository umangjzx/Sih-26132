import type { Metadata } from "next";
import Link from "next/link";
import { Space_Grotesk, DM_Sans, Noto_Sans_Devanagari } from "next/font/google";

import { AuthProvider } from "@/components/AuthProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { NavLinks } from "@/components/NavLinks";
import { NotificationBell } from "@/components/NotificationBell";
import { Icon } from "@/components/ui";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const dmSans = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const notoSansDevanagari = Noto_Sans_Devanagari({
  variable: "--font-devanagari",
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "AgriLink — mandi prices & market linkage for Maharashtra",
  description:
    "Live mandi prices, an explainable sell-now-or-wait call, weather & MSP context, and verified buyers for Maharashtra farmers and FPOs.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${dmSans.variable} ${notoSansDevanagari.variable} h-full`}
    >
      <body className="flex min-h-full flex-col text-[var(--ink)] antialiased">
        <LocaleProvider>
          <AuthProvider>
            <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--paper)]/85 backdrop-blur-md">
              <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
                <Link href="/" className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--green-600)] text-white">
                    <Icon name="leaf" size={20} />
                  </span>
                  <span className="font-heading text-xl font-bold tracking-tight text-[var(--green-700)]">
                    AgriLink
                  </span>
                </Link>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <NavLinks />
                  <NotificationBell />
                  <LanguageSwitcher />
                </div>
              </div>
            </header>

            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>

            <footer className="mt-8 border-t border-[var(--line)] bg-[var(--paper)]/70">
              <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-xs text-[var(--ink-soft)]">
                <span className="font-semibold text-[var(--green-700)]">
                  AgriLink · Smart India Hackathon 2026 · PS 26132 (Govt. of Maharashtra / MSInS)
                </span>
                <span>
                  Price data: data.gov.in AGMARKNET · Weather: Open-Meteo · Rainfall: NASA POWER ·
                  Roads: OSRM · Holidays: Nager.Date — all open / free sources.
                </span>
              </div>
            </footer>
          </AuthProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}

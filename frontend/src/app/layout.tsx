import type { Metadata } from "next";
import { Space_Grotesk, DM_Sans, Noto_Sans_Devanagari } from "next/font/google";

import { AuthProvider } from "@/components/AuthProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { NavLinks } from "@/components/NavLinks";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
  title: "AgriLink",
  description: "Mandi price discovery and market linkage for Maharashtra farmers",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${dmSans.variable} ${notoSansDevanagari.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-[var(--color-bg)] text-[var(--color-text)] antialiased">
        <LocaleProvider>
          <AuthProvider>
            <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)] backdrop-blur-md sticky top-0 z-50">
              <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
                <span className="text-xl font-bold tracking-tight text-[var(--color-brand)] font-heading">
                  AgriLink
                </span>
                <div className="flex items-center gap-4">
                  <NavLinks />
                  <LanguageSwitcher />
                </div>
              </div>
            </header>
            <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
          </AuthProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}

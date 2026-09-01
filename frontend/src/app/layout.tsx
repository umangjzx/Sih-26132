import type { Metadata } from "next";
import { Noto_Sans, Noto_Sans_Devanagari } from "next/font/google";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import "./globals.css";

const notoSans = Noto_Sans({
  variable: "--font-latin",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
    <html lang="en" className={`${notoSans.variable} ${notoSansDevanagari.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-[var(--color-bg)] text-[var(--color-text)] antialiased">
        <LocaleProvider>
          <header className="border-b-2 border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
              <span className="text-xl font-bold tracking-tight text-[var(--color-brand)]">
                AgriLink
              </span>
              <LanguageSwitcher />
            </div>
          </header>
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
        </LocaleProvider>
      </body>
    </html>
  );
}

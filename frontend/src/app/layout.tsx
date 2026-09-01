import type { Metadata } from "next";
import { Space_Grotesk, DM_Sans, Noto_Sans_Devanagari } from "next/font/google";

import { AuthProvider } from "@/components/AuthProvider";
import { ClientAppShell } from "@/components/ClientAppShell";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { LocationProvider } from "@/lib/useLocation";
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
            <LocationProvider>
              <ClientAppShell>
                {children}
              </ClientAppShell>
            </LocationProvider>
          </AuthProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}

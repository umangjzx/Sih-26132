import type { Metadata } from "next";
import { Poppins, Noto_Sans_Devanagari } from "next/font/google";

import { AuthProvider } from "@/components/AuthProvider";
import { ClientAppShell } from "@/components/ClientAppShell";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { LocationProvider } from "@/lib/useLocation";
import "./globals.css";

// Poppins — single family for both headings and body, matching the AgriLink
// design reference exactly. Weights 400/500/600/700 cover all type sizes.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const notoSansDevanagari = Noto_Sans_Devanagari({
  variable: "--font-devanagari",
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AgriLink — mandi prices & market linkage for Maharashtra",
  description:
    "Live mandi prices, an explainable sell-now-or-wait call, weather & MSP context, and verified buyers for Maharashtra farmers and FPOs.",
  icons: {
    icon: "/logo.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${notoSansDevanagari.variable} h-full`}
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

import type { Metadata } from "next";
import { Poppins, Noto_Sans_Devanagari } from "next/font/google";

import { AuthProvider } from "@/components/AuthProvider";
import { ClientAppShell } from "@/components/ClientAppShell";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { THEME_INIT_SCRIPT, ThemeProvider } from "@/lib/ThemeProvider";
import { LocationProvider } from "@/lib/useLocation";
import "./globals.css";

// Poppins — single family for both headings and body, matching the HarvestIQ
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

// No production domain is hard-coded anywhere in this repo (see robots.ts /
// sitemap.ts) — only set metadataBase once NEXT_PUBLIC_SITE_URL is
// configured, rather than inventing a canonical domain.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

const title = "HarvestIQ — mandi prices & market linkage for Maharashtra";
const description =
  "Live mandi prices, an explainable sell-now-or-wait call, weather & MSP context, and verified buyers for Maharashtra farmers and FPOs.";

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title,
  description,
  icons: {
    icon: "/logo.png",
  },
  openGraph: {
    title,
    description,
    siteName: "HarvestIQ",
    locale: "en_IN",
    type: "website",
    images: ["/logo.png"],
  },
  twitter: {
    card: "summary",
    title,
    description,
    images: ["/logo.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${notoSansDevanagari.variable} h-full`}
    >
      <head>
        {/* Sets [data-theme] before first paint so there's no flash of the
            wrong theme — see ThemeProvider.tsx for why this can't just be a
            React effect. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col text-[var(--ink)] antialiased">
        <ThemeProvider>
          <LocaleProvider>
            <AuthProvider>
              <LocationProvider>
                <ClientAppShell>
                  {children}
                </ClientAppShell>
              </LocationProvider>
            </AuthProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

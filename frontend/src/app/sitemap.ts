import type { MetadataRoute } from "next";

// See robots.ts — no production domain is hard-coded anywhere in this repo,
// so this reads NEXT_PUBLIC_SITE_URL (set it once a domain is chosen) and
// falls back to localhost for local dev builds.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Only the public, logged-out marketing pages belong in the sitemap —
// everything else sits behind auth (see robots.ts's disallow list).
const PUBLIC_ROUTES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/",                changeFrequency: "daily",   priority: 1.0 },
  { path: "/features",        changeFrequency: "monthly", priority: 0.8 },
  { path: "/how-it-works",    changeFrequency: "monthly", priority: 0.8 },
  { path: "/market-insights", changeFrequency: "weekly",  priority: 0.7 },
  { path: "/about",           changeFrequency: "monthly", priority: 0.6 },
  { path: "/login",           changeFrequency: "yearly",  priority: 0.5 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PUBLIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}

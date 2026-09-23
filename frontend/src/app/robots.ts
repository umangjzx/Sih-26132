import type { MetadataRoute } from "next";

// No production domain is hard-coded anywhere in this repo (Caddy/DEPLOYMENT.md
// point at whatever domain the operator attaches to the VM) — set
// NEXT_PUBLIC_SITE_URL once one is chosen so the sitemap reference below
// resolves to an absolute URL. Falls back to localhost for local dev.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Everything below is an authenticated dashboard route (farmer/buyer/admin
// app shell) — there's nothing for a crawler to usefully index there, and
// disallowing it keeps crawl budget on the public marketing pages.
const AUTHENTICATED_APP_PATHS = [
  "/admin",
  "/advisor",
  "/alerts",
  "/browse",
  "/buyer",
  "/deals",
  "/directory",
  "/explore",
  "/farmer",
  "/financing",
  "/forward",
  "/history",
  "/matches",
  "/notifications",
  "/pools",
  "/prices",
  "/profile",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: AUTHENTICATED_APP_PATHS,
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

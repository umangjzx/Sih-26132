"use client";

/**
 * ClientAppShell
 *
 * Public (logged-out):
 *   PublicHeader · max-w-screen-xl content · SiteFooter
 *   No sidebar, clean top-nav experience.
 *
 * Authenticated:
 *   Sidebar (collapsible) · TopHeader · main content · SiteFooter
 *   Sidebar width: expanded = 18rem (lg:pl-72), collapsed = 4.75rem (lg:pl-[4.75rem])
 *   Smooth CSS transition on padding-left (no JS layout thrash).
 */

import { Suspense, useCallback, useEffect, useState } from "react";

import { useAuth } from "./AuthProvider";
import { AskAgriLink } from "./AskAgriLink";
import { BottomNav } from "./BottomNav";
import { PublicHeader } from "./PublicHeader";
import { Sidebar } from "./Sidebar";
import { TopHeader } from "./TopHeader";

const COLLAPSE_KEY = "agrilink.sidebarCollapsed";

function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[var(--line)] bg-[var(--paper)]">
      <div className="mx-auto max-w-screen-xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-1 text-xs text-[var(--ink-soft)]">
          <span className="font-semibold text-[var(--green-700)]">
            AgriLink · Smart India Hackathon 2026 · PS 26132 (Govt. of Maharashtra / MSInS)
          </span>
          <span>
            Price data: data.gov.in AGMARKNET · Weather: Open-Meteo · Rainfall: NASA POWER ·
            Roads: OSRM · Holidays: Nager.Date — all open / free sources.
          </span>
        </div>
      </div>
    </footer>
  );
}

export function ClientAppShell({ children }: { children: React.ReactNode }) {
  const { ready, isAuthenticated } = useAuth();
  const [drawerOpen,  setDrawerOpen]  = useState(false);
  const [collapsed,   setCollapsed]   = useState(false);

  // Read persisted collapse state on mount (avoids SSR mismatch)
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch { /* storage unavailable */ }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try { window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0"); }
      catch { /* ignore */ }
      return next;
    });
  }, []);

  // Blank screen while auth state resolves — prevents flash of wrong shell
  if (!ready) {
    return <div className="min-h-screen bg-[var(--paper)]" aria-hidden="true" />;
  }

  /* ── Public (logged-out) ── */
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col overflow-x-hidden bg-[var(--paper)]">
        <PublicHeader />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {/* max-w-screen-xl centres content on ultra-wide displays */}
          <div className="mx-auto w-full min-w-0 max-w-screen-xl al-fade-up">
            {children}
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  /* ── Authenticated app shell ── */
  // The left padding tracks the sidebar width via CSS transition,
  // matching the sidebar's own transition-[transform,width] duration-300.
  const mainPaddingLeft = collapsed ? "lg:pl-[4.75rem]" : "lg:pl-72";

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-[var(--paper)]">
      <Sidebar
        isOpen={drawerOpen}
        collapsed={collapsed}
        onClose={() => setDrawerOpen(false)}
        onToggleCollapsed={toggleCollapsed}
      />

      <div
        className={`
          flex min-w-0 flex-1 flex-col
          transition-[padding-left] duration-300 ease-in-out
          ${mainPaddingLeft}
        `}
      >
        <TopHeader onOpenSidebar={() => setDrawerOpen(true)} />

        <main className="flex-1 px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-8 lg:pt-6">
          <div className="mx-auto w-full min-w-0 max-w-screen-xl">
            {children}
          </div>
        </main>

        <SiteFooter />
      </div>

      {/* Floating LLM assistant — lazy-loaded */}
      <Suspense fallback={null}>
        <AskAgriLink />
      </Suspense>

      {/* Mobile bottom tab bar */}
      <BottomNav onOpenMore={() => setDrawerOpen(true)} />
    </div>
  );
}

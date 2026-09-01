"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopHeader } from "./TopHeader";

export function ClientAppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[var(--paper)]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col lg:pl-72 transition-all duration-300">
        <TopHeader onOpenSidebar={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-7xl">
            {children}
          </div>
        </main>
        <footer className="mt-auto border-t border-[var(--line)] bg-[var(--paper)]">
          <div className="mx-auto max-w-7xl px-4 py-6 text-xs text-[var(--ink-soft)] sm:px-6 lg:px-8">
            <div className="flex flex-col gap-1">
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
      </div>
    </div>
  );
}

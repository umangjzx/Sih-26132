"use client";

/**
 * Marketplace hub — merges the former /browse and /matches pages into one
 * destination with two tabs, reached from either URL (both stay live so
 * every existing link/bookmark/bottom-nav tab keeps working):
 *
 *   /browse  -> defaults to "discover"   (nearby open lots/demands, express interest)
 *   /matches -> defaults to "myMatches"  (every scored match, link into the offer thread)
 *
 * The active tab is mirrored in ?tab= so either view stays bookmarkable.
 * Farmer/buyer only — admins are redirected to /admin, same as both pages
 * did independently before the merge.
 */

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { useAuth } from "@/components/AuthProvider";
import { DiscoverTab } from "@/app/browse/DiscoverTab";
import { MyMatchesTab } from "@/app/matches/MyMatchesTab";
import { PageHeader } from "@/components/PageHeader";
import { Icon } from "@/components/ui";

type Tab = "discover" | "myMatches";

export function MarketplaceHub({ defaultTab }: { defaultTab: Tab }) {
  const { user, isAuthenticated, ready } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tb = useTranslations("browse");
  const tm = useTranslations("matching");
  const tdash = useTranslations("dash");
  const isBuyer = user?.role === "buyer";

  const tab: Tab = params.get("tab") === "discover" || params.get("tab") === "myMatches"
    ? (params.get("tab") as Tab)
    : defaultTab;

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) router.replace("/login");
    else if (user?.role === "admin") router.replace("/admin");
  }, [ready, isAuthenticated, user, router]);

  function setTab(next: Tab) {
    const sp = new URLSearchParams(params.toString());
    sp.set("tab", next);
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  }

  if (!ready || !isAuthenticated || !user || user.role === "admin") return null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={tab === "discover" ? (isBuyer ? "leaf" : "handshake") : "connection"}
        title={tab === "discover" ? (isBuyer ? tb("titleBuyer") : tb("titleFarmer")) : tm("title")}
        subtitle={tab === "discover" ? (isBuyer ? tb("subBuyer") : tb("subFarmer")) : tdash("matchesSubtitle")}
      />

      <div
        role="tablist"
        aria-label={tb("marketplaceTabsLabel")}
        className="inline-flex w-fit gap-1 rounded-xl border border-[var(--line)] bg-white p-1 shadow-sm"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "discover"}
          onClick={() => setTab("discover")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition ${
            tab === "discover"
              ? "bg-[var(--green-700)] text-white shadow-sm"
              : "text-[var(--ink-soft)] hover:bg-[var(--paper)]"
          }`}
        >
          <Icon name="globe" size={15} />
          {tb("tabDiscover")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "myMatches"}
          onClick={() => setTab("myMatches")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition ${
            tab === "myMatches"
              ? "bg-[var(--green-700)] text-white shadow-sm"
              : "text-[var(--ink-soft)] hover:bg-[var(--paper)]"
          }`}
        >
          <Icon name="connection" size={15} />
          {tb("tabMyMatches")}
        </button>
      </div>

      {tab === "discover" ? <DiscoverTab /> : <MyMatchesTab />}
    </div>
  );
}

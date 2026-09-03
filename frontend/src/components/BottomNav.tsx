"use client";

/**
 * Mobile bottom tab bar — the four most-used destinations one tap away, plus a
 * "More" button that opens the full sidebar drawer. Phones only (lg:hidden);
 * desktop keeps the fixed sidebar.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { useAuth } from "./AuthProvider";
import { Icon } from "./ui";

type Tab = { href: string; label: string; icon: string };

export function BottomNav({ onOpenMore }: { onOpenMore: () => void }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const { user, isAuthenticated } = useAuth();

  const tabs: Tab[] = [{ href: "/", label: t("home"), icon: "house" }];

  if (isAuthenticated && user?.role === "farmer") {
    tabs.push({ href: "/prices", label: t("prices"), icon: "chart" });
    tabs.push({ href: "/farmer", label: t("myLots"), icon: "leaf" });
    tabs.push({ href: "/matches", label: t("matches"), icon: "connection" });
  } else if (isAuthenticated && user?.role === "buyer") {
    tabs.push({ href: "/prices", label: t("prices"), icon: "chart" });
    tabs.push({ href: "/buyer", label: t("myDemands"), icon: "handshake" });
    tabs.push({ href: "/matches", label: t("matches"), icon: "connection" });
  } else if (isAuthenticated && user?.role === "admin") {
    tabs.push({ href: "/prices", label: t("prices"), icon: "chart" });
    tabs.push({ href: "/admin", label: t("admin"), icon: "shield" });
    tabs.push({ href: "/explore", label: t("explore"), icon: "globe" });
  } else {
    tabs.push({ href: "/prices", label: t("prices"), icon: "chart" });
    tabs.push({ href: "/advisor", label: t("advisor"), icon: "spark" });
    tabs.push({ href: "/explore", label: t("explore"), icon: "globe" });
  }

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-[var(--line)] bg-[var(--surface)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      aria-label={t("openMenu")}
    >
      {tabs.map((tab) => {
        const active = isActive(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition-colors ${
              active ? "text-[var(--green-700)]" : "text-[var(--ink-soft)]"
            }`}
          >
            <Icon name={tab.icon} size={22} className={active ? "opacity-100" : "opacity-70"} />
            <span className="max-w-full truncate px-0.5">{tab.label}</span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onOpenMore}
        className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold text-[var(--ink-soft)]"
      >
        <Icon name="menu" size={22} className="opacity-70" />
        <span>{t("more")}</span>
      </button>
    </nav>
  );
}

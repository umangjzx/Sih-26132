"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Icon } from "./ui";
import { LocationChip } from "./LocationChip";
import { NotificationBell } from "./NotificationBell";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useAuth } from "./AuthProvider";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function TopHeader({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const t = useTranslations("nav");
  const { user, isAuthenticated, logout } = useAuth();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center gap-2 border-b border-[var(--line)] bg-[var(--surface)]/90 px-3 backdrop-blur-md sm:gap-3 sm:px-6">
      <button
        onClick={onOpenSidebar}
        className="shrink-0 rounded-lg p-2 text-[var(--ink-soft)] hover:bg-[var(--paper)] lg:hidden"
        aria-label={t("openMenu")}
      >
        <Icon name="menu" size={22} />
      </button>

      <div className="min-w-0 flex-1 lg:pl-4">
        <LocationChip />
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
        {isAuthenticated && <NotificationBell />}
        <LanguageSwitcher />
        {isAuthenticated && user ? (
          <>
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--green-700)] text-xs font-bold text-white"
              title={user.name}
              aria-hidden="true"
            >
              {initials(user.name)}
            </span>
            <span className="hidden text-sm font-semibold text-[var(--ink)] lg:block">
              {user.name}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="hidden rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-soft)] transition-colors hover:bg-[var(--paper)] sm:inline-flex"
            >
              {t("logout")}
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="rounded-lg bg-[var(--green-700)] px-3 py-1.5 text-sm font-bold text-white transition-colors hover:bg-[var(--green-900)] sm:px-4"
          >
            {t("login")}
          </Link>
        )}
      </div>
    </header>
  );
}

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
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-[var(--line)] bg-[var(--surface)]/90 px-4 backdrop-blur-md sm:px-6">
      <div className="flex items-center gap-4 lg:hidden">
        <button
          onClick={onOpenSidebar}
          className="rounded-lg p-2 text-[var(--ink-soft)] hover:bg-[var(--paper)]"
          aria-label={t("openMenu")}
        >
          <Icon name="menu" size={24} />
        </button>
      </div>

      {/* Spacer for desktop to keep center aligned */}
      <div className="hidden w-8 lg:block" />

      <div className="flex flex-1 justify-center lg:justify-start lg:pl-8">
        <LocationChip />
      </div>

      <div className="flex items-center gap-3">
        {isAuthenticated && <NotificationBell />}
        <LanguageSwitcher />
        {isAuthenticated && user ? (
          <div className="flex items-center gap-2">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--green-700)] text-xs font-bold text-white"
              aria-hidden="true"
            >
              {initials(user.name)}
            </span>
            <span className="hidden text-sm font-semibold text-[var(--ink)] sm:block">
              {user.name}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-soft)] transition-colors hover:bg-[var(--paper)]"
            >
              {t("logout")}
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="rounded-lg bg-[var(--green-700)] px-4 py-1.5 text-sm font-bold text-white transition-colors hover:bg-[var(--green-900)]"
          >
            {t("login")}
          </Link>
        )}
      </div>
    </header>
  );
}

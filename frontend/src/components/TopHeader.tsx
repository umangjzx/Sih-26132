"use client";

/**
 * Authenticated top header bar.
 * Sits above the main content area (to the right of the sidebar).
 * Contains: hamburger (mobile) · LocationChip · NotificationBell ·
 *           LanguageSwitcher · avatar + name · logout.
 * All colours and shadows from CSS tokens.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { useAuth } from "./AuthProvider";
import { Icon } from "./ui";
import { LocationChip } from "./LocationChip";
import { NotificationBell } from "./NotificationBell";
import { LanguageSwitcher } from "./LanguageSwitcher";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
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
    <header
      className="
        sticky top-0 z-40 flex h-[4.25rem] w-full items-center gap-2
        border-b border-[var(--line)]
        bg-[var(--surface)]/92 backdrop-blur-md
        shadow-[var(--shadow-xs)]
        px-3 sm:gap-3 sm:px-5
      "
    >
      {/* Hamburger — mobile only */}
      <button
        type="button"
        onClick={onOpenSidebar}
        aria-label={t("openMenu")}
        className="al-btn-icon shrink-0 lg:hidden"
      >
        <Icon name="menu" size={22} />
      </button>

      {/* Location chip — fills the flex gap */}
      <div className="min-w-0 flex-1 lg:pl-2">
        <LocationChip />
      </div>

      {/* Right cluster */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        {/* Notification bell */}
        {isAuthenticated && (
          <div className="hidden sm:block">
            <NotificationBell />
          </div>
        )}

        {/* Language switcher */}
        <div className="hidden sm:block">
          <LanguageSwitcher />
        </div>

        {/* Auth section */}
        {isAuthenticated && user ? (
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Avatar — links to profile */}
            <Link
              href="/profile"
              title={user.name}
              className="
                flex h-8 w-8 shrink-0 items-center justify-center rounded-full
                bg-[var(--green-700)] text-[11px] font-bold text-white
                ring-2 ring-transparent transition-all
                hover:ring-[var(--green-400)] focus-visible:ring-[var(--green-400)]
              "
            >
              {initials(user.name)}
            </Link>

            {/* Name — desktop only */}
            <Link
              href="/profile"
              className="hidden text-sm font-semibold text-[var(--ink)] hover:text-[var(--green-700)] lg:block"
            >
              {user.name}
            </Link>

            {/* Logout — desktop */}
            <button
              type="button"
              onClick={handleLogout}
              className="
                hidden items-center gap-1.5 rounded-lg border border-[var(--line)]
                bg-transparent px-3 py-1.5 text-xs font-semibold
                text-[var(--ink-soft)] transition-colors
                hover:bg-[var(--paper)] hover:text-[var(--ink)]
                sm:inline-flex
              "
            >
              {t("logout")}
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="al-btn-secondary px-4 py-2 text-sm"
          >
            {t("login")}
          </Link>
        )}
      </div>
    </header>
  );
}

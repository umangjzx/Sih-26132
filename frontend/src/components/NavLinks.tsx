"use client";

/**
 * NavLinks — renders auth-aware navigation links in the header.
 *
 * Must be a separate "use client" component because it calls useAuth()
 * and useTranslations(), neither of which can be called in a server layout.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/AuthProvider";

export function NavLinks() {
  const { user, isAuthenticated, logout } = useAuth();
  const t = useTranslations("nav");
  const router = useRouter();

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  const exploreLink = (
    <Link
      href="/explore"
      className="text-sm font-medium text-[var(--color-brand)] hover:underline"
    >
      {t("explore")}
    </Link>
  );

  if (!isAuthenticated || !user) {
    return (
      <nav className="flex items-center gap-3">
        {exploreLink}
        <Link
          href="/login"
          className="rounded-xl bg-[var(--color-brand)] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:-translate-y-0.5 hover:shadow-md hover:bg-[var(--color-brand-dark)] transition-all duration-200"
        >
          {t("login")}
        </Link>
      </nav>
    );
  }

  return (
    <nav className="flex items-center gap-3">
      {exploreLink}
      {user.role === "farmer" && (
        <Link
          href="/farmer"
          className="text-sm font-medium text-[var(--color-brand)] hover:underline"
        >
          {t("myLots")}
        </Link>
      )}
      {user.role === "buyer" && (
        <Link
          href="/buyer"
          className="text-sm font-medium text-[var(--color-brand)] hover:underline"
        >
          {t("myDemands")}
        </Link>
      )}
      {(user.role === "farmer" || user.role === "buyer") && (
        <>
          <Link
            href="/history"
            className="text-sm font-medium text-[var(--color-brand)] hover:underline"
          >
            {t("history")}
          </Link>
          <Link
            href="/alerts"
            className="text-sm font-medium text-[var(--color-brand)] hover:underline"
          >
            {t("alerts")}
          </Link>
        </>
      )}
      {user.role === "admin" && (
        <Link
          href="/admin"
          className="text-sm font-medium text-[var(--color-brand)] hover:underline"
        >
          {t("admin")}
        </Link>
      )}
      <span className="text-sm text-[var(--color-text)] opacity-60">
        {user.name}
      </span>
      <button
        onClick={handleLogout}
        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] backdrop-blur-md px-4 py-2 text-sm font-semibold text-[var(--color-text)] shadow-sm hover:bg-white/90 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
      >
        {t("logout")}
      </button>
    </nav>
  );
}

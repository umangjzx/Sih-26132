"use client";

/**
 * NavLinks — auth-aware header navigation.
 *
 * "use client" because it calls useAuth() and useTranslations().
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { useAuth } from "@/components/AuthProvider";

function NLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-sm font-medium text-[var(--color-brand)] hover:underline"
    >
      {children}
    </Link>
  );
}

export function NavLinks() {
  const { user, isAuthenticated, logout } = useAuth();
  const t = useTranslations("nav");
  const router = useRouter();

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  const primary = (
    <>
      <NLink href="/prices">{t("prices")}</NLink>
      <NLink href="/advisor">{t("advisor")}</NLink>
      <NLink href="/explore">{t("explore")}</NLink>
      <NLink href="/directory">{t("directory")}</NLink>
    </>
  );

  if (!isAuthenticated || !user) {
    return (
      <nav className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {primary}
        <Link
          href="/login"
          className="rounded-xl bg-[var(--color-brand)] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--color-brand-dark)] hover:shadow-md"
        >
          {t("login")}
        </Link>
      </nav>
    );
  }

  return (
    <nav className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {primary}
      {user.role === "farmer" && <NLink href="/farmer">{t("myLots")}</NLink>}
      {user.role === "buyer" && <NLink href="/buyer">{t("myDemands")}</NLink>}
      {(user.role === "farmer" || user.role === "buyer") && (
        <>
          <NLink href="/history">{t("history")}</NLink>
          <NLink href="/alerts">{t("alerts")}</NLink>
        </>
      )}
      {user.role === "admin" && <NLink href="/admin">{t("admin")}</NLink>}
      <span className="text-sm text-[var(--color-text)] opacity-60">{user.name}</span>
      <button
        onClick={handleLogout}
        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] shadow-sm backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-md"
      >
        {t("logout")}
      </button>
    </nav>
  );
}

"use client";

/**
 * NavLinks — auth-aware header navigation with an active-route underline.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { useAuth } from "@/components/AuthProvider";

function NLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      className={`relative py-1 text-sm font-semibold transition-colors ${
        active ? "text-[var(--green-800)]" : "text-[var(--green-600)] hover:text-[var(--green-800)]"
      }`}
      style={active ? { color: "var(--green-700)" } : undefined}
    >
      {children}
      {active && (
        <span className="absolute -bottom-0.5 left-0 h-0.5 w-full rounded-full bg-[var(--green-600)]" />
      )}
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
      <nav className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {primary}
        <Link
          href="/login"
          className="rounded-xl bg-[var(--green-600)] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--green-700)] hover:shadow-md"
        >
          {t("login")}
        </Link>
      </nav>
    );
  }

  return (
    <nav className="flex flex-wrap items-center gap-x-4 gap-y-1">
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
      <span className="text-sm font-medium text-[var(--ink-soft)]">{user.name}</span>
      <button
        onClick={handleLogout}
        className="rounded-xl border border-[var(--line)] bg-white/70 px-4 py-2 text-sm font-semibold text-[var(--ink)] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
      >
        {t("logout")}
      </button>
    </nav>
  );
}

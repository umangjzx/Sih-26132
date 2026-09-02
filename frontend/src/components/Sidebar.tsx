"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { useAuth } from "./AuthProvider";
import { Logo } from "./Logo";
import { Icon } from "./ui";

type NavLink = { href: string; label: string; icon: string };

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const { user, isAuthenticated } = useAuth();

  const publicLinks: NavLink[] = [
    { href: "/", label: t("home"), icon: "house" },
    { href: "/prices", label: t("prices"), icon: "chart" },
    { href: "/advisor", label: t("advisor"), icon: "spark" },
    { href: "/directory", label: t("directory"), icon: "warehouse" },
    { href: "/explore", label: t("explore"), icon: "globe" },
  ];

  const tradeLinks: NavLink[] = [];
  if (user?.role === "farmer") tradeLinks.push({ href: "/farmer", label: t("myLots"), icon: "leaf" });
  if (user?.role === "buyer") tradeLinks.push({ href: "/buyer", label: t("myDemands"), icon: "handshake" });
  if (user?.role === "farmer" || user?.role === "buyer") {
    tradeLinks.push({ href: "/matches", label: t("matches"), icon: "connection" });
    tradeLinks.push({ href: "/history", label: t("history"), icon: "clock" });
    tradeLinks.push({ href: "/alerts", label: t("alerts"), icon: "bell" });
  }

  const renderLink = (link: NavLink) => {
    const active =
      pathname === link.href ||
      (link.href !== "/" && pathname.startsWith(link.href));
    return (
      <Link
        key={link.href}
        href={link.href}
        onClick={onClose}
        aria-current={active ? "page" : undefined}
        className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
          active
            ? "bg-[var(--green-600)] text-white shadow-md shadow-black/10"
            : "text-[var(--green-50)] hover:bg-white/10 hover:text-white"
        }`}
      >
        <Icon name={link.icon} size={20} className={active ? "opacity-100" : "opacity-80"} />
        {link.label}
      </Link>
    );
  };

  const sidebarClasses = `fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[#122c1d] text-white shadow-2xl transition-transform duration-300 lg:translate-x-0 ${
    isOpen ? "translate-x-0" : "-translate-x-full"
  }`;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={sidebarClasses}>
        <div className="flex h-16 shrink-0 items-center px-6">
          <Link href="/" onClick={onClose}>
            <Logo size={40} variant="sidebar" />
          </Link>
        </div>

        <nav className="custom-scrollbar flex flex-1 flex-col gap-8 overflow-y-auto p-4">
          <div className="flex flex-col gap-1.5">{publicLinks.map(renderLink)}</div>

          {tradeLinks.length > 0 && (
            <div>
              <div className="mb-3 px-4 text-xs font-bold uppercase tracking-widest text-[var(--green-200)]/70">
                {t("tradeSection")}
              </div>
              <div className="flex flex-col gap-1.5">{tradeLinks.map(renderLink)}</div>
            </div>
          )}
        </nav>

        {user?.role === "admin" && (
          <div className="border-t border-white/10 p-4">
            <Link
              href="/admin"
              onClick={onClose}
              aria-current={pathname.startsWith("/admin") ? "page" : undefined}
              className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--green-50)] hover:bg-white/10 hover:text-white"
            >
              <Icon name="shield" size={20} className="opacity-80" />
              {t("administration")}
            </Link>
          </div>
        )}

        {!isAuthenticated && (
          <div className="border-t border-white/10 p-4">
            <Link
              href="/login"
              onClick={onClose}
              className="flex items-center justify-center gap-2 rounded-xl bg-[var(--green-600)] px-4 py-2.5 text-sm font-bold text-white hover:bg-[var(--green-500)]"
            >
              {t("login")}
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}

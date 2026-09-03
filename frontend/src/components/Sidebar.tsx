"use client";

/**
 * AgriLink authenticated sidebar.
 *
 * Three states:
 *   expanded  — 18rem wide, icons + labels                    (desktop)
 *   collapsed — 4.75rem wide, icons only + tooltips           (desktop)
 *   drawer    — full sidebar slides in from the left          (mobile)
 *
 * Colours come exclusively from --sidebar-* CSS tokens.
 * Collapse animation uses CSS transition on `width`; no JS layout thrash.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { useAuth } from "./AuthProvider";
import { Logo } from "./Logo";
import { Icon } from "./ui";

type NavItem = { href: string; labelKey: string; icon: string };

/* ── Helpers ────────────────────────────────────────────────────────────── */

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

/* ── SidebarLink ─────────────────────────────────────────────────────────── */

function SidebarLink({
  item,
  collapsed,
  onClose,
}: {
  item: NavItem;
  collapsed: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const t        = useTranslations("nav");
  const active   =
    pathname === item.href ||
    (item.href !== "/" && pathname.startsWith(item.href));

  return (
    <Link
      href={item.href}
      onClick={onClose}
      aria-current={active ? "page" : undefined}
      title={collapsed ? t(item.labelKey as "home") : undefined}
      className={`
        group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium
        transition-colors duration-150 outline-none
        focus-visible:ring-2 focus-visible:ring-[var(--green-400)]
        ${collapsed ? "lg:justify-center lg:px-0" : ""}
        ${active
          ? "bg-[var(--sidebar-active)] text-white shadow-sm"
          : "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover-bg)] hover:text-white"
        }
      `}
    >
      <Icon
        name={item.icon}
        size={20}
        className={`shrink-0 ${active ? "opacity-100" : "opacity-75 group-hover:opacity-100"}`}
      />
      <span
        className={`
          truncate transition-all duration-300 overflow-hidden whitespace-nowrap
          ${collapsed ? "lg:w-0 lg:opacity-0" : "w-auto opacity-100"}
        `}
      >
        {t(item.labelKey as "home")}
      </span>
    </Link>
  );
}

/* ── Section label ─────────────────────────────────────────────────────── */

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  return (
    <div
      className={`
        px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.12em]
        text-[var(--sidebar-muted)] transition-all duration-300 overflow-hidden whitespace-nowrap
        ${collapsed ? "lg:opacity-0 lg:max-h-0 lg:py-0" : "opacity-100 max-h-12"}
      `}
    >
      {label}
    </div>
  );
}

/* ── Sidebar ─────────────────────────────────────────────────────────────── */

export function Sidebar({
  isOpen,
  collapsed,
  onClose,
  onToggleCollapsed,
}: {
  isOpen: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapsed: () => void;
}) {
  const t      = useTranslations("nav");
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();

  /* ── Nav groups ── */
  const discoveryLinks: NavItem[] = [
    { href: "/",         labelKey: "home",          icon: "house"     },
    { href: "/prices",   labelKey: "prices",        icon: "chart"     },
    { href: "/advisor",  labelKey: "advisor",       icon: "spark"     },
    { href: "/explore",  labelKey: "explore",       icon: "globe"     },
    { href: "/directory",labelKey: "directory",     icon: "warehouse" },
  ];

  const tradeLinks: NavItem[] = [];
  if (user?.role === "farmer") {
    tradeLinks.push({ href: "/farmer",  labelKey: "myLots",    icon: "leaf"       });
    tradeLinks.push({ href: "/browse",  labelKey: "browse",    icon: "globe"      });
    tradeLinks.push({ href: "/pools",   labelKey: "pools",     icon: "coins"      });
    tradeLinks.push({ href: "/forward", labelKey: "forward",   icon: "calendar"   });
  }
  if (user?.role === "buyer") {
    tradeLinks.push({ href: "/buyer",   labelKey: "myDemands", icon: "handshake"  });
    tradeLinks.push({ href: "/browse",  labelKey: "browse",    icon: "globe"      });
    tradeLinks.push({ href: "/forward", labelKey: "forward",   icon: "calendar"   });
  }
  if (user?.role === "farmer" || user?.role === "buyer") {
    tradeLinks.push({ href: "/matches", labelKey: "matches",   icon: "connection" });
    tradeLinks.push({ href: "/history", labelKey: "history",   icon: "clock"      });
    tradeLinks.push({ href: "/alerts",  labelKey: "alerts",    icon: "bell"       });
  }
  if (isAuthenticated) {
    tradeLinks.push({ href: "/profile", labelKey: "profile",   icon: "users"      });
  }

  const adminLinks: NavItem[] = [
    { href: "/admin",       labelKey: "administration", icon: "shield" },
    { href: "/admin/users", labelKey: "users",          icon: "users"  },
  ];

  const handleLogout = () => {
    onClose();
    logout();
    router.replace("/login");
  };

  /* ── Class builders ── */
  const sidebarWidth = collapsed ? "lg:w-[4.75rem]" : "lg:w-72";

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        role="navigation"
        aria-label="App navigation"
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col
          bg-[var(--sidebar-bg)] text-white
          shadow-[var(--shadow-xl)]
          transition-[transform,width] duration-300 ease-in-out
          /* mobile: full-width drawer */
          w-72
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          /* desktop: always visible, animate width */
          lg:translate-x-0
          ${sidebarWidth}
        `}
      >

        {/* ── Logo row ── */}
        <div
          className={`
            flex h-[4.25rem] shrink-0 items-center border-b border-[var(--sidebar-border)] px-4
            ${collapsed ? "lg:justify-center lg:px-0" : "gap-2"}
          `}
        >
          {/* Full logo (visible when expanded or on mobile drawer) */}
          <Link
            href="/"
            onClick={onClose}
            className={`outline-none focus-visible:ring-2 focus-visible:ring-[var(--green-400)] rounded-lg ${collapsed ? "lg:hidden" : ""}`}
          >
            <Logo size={36} variant="sidebar" />
          </Link>
          {/* Icon-only logo (collapsed desktop) */}
          <Link
            href="/"
            onClick={onClose}
            className={`outline-none focus-visible:ring-2 focus-visible:ring-[var(--green-400)] rounded-lg ${collapsed ? "hidden lg:block" : "hidden"}`}
          >
            <Logo size={28} variant="icon" />
          </Link>

          {/* Collapse / expand toggle — desktop only */}
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? t("expand") : t("collapse")}
            title={collapsed ? t("expand") : t("collapse")}
            className="
              ml-auto hidden rounded-lg p-1.5 text-[var(--sidebar-muted)]
              transition-colors hover:bg-[var(--sidebar-hover-bg)] hover:text-white lg:flex
            "
          >
            <Icon
              name="chevronLeft"
              size={17}
              className={`transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        {/* ── Nav scroll area ── */}
        <nav
          aria-label="Primary navigation"
          className="custom-scrollbar flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-3"
        >
          {/* Discovery */}
          <div className="flex flex-col gap-0.5">
            {discoveryLinks.map((item) => (
              <SidebarLink key={item.href} item={item} collapsed={collapsed} onClose={onClose} />
            ))}
          </div>

          {/* Trade & Logistics */}
          {tradeLinks.length > 0 && (
            <div className="mt-3 flex flex-col gap-0.5">
              <SectionLabel label={t("tradeSection")} collapsed={collapsed} />
              {tradeLinks.map((item) => (
                <SidebarLink key={item.href} item={item} collapsed={collapsed} onClose={onClose} />
              ))}
            </div>
          )}

          {/* Administration */}
          {user?.role === "admin" && (
            <div className="mt-3 flex flex-col gap-0.5">
              <SectionLabel label={t("administration")} collapsed={collapsed} />
              {adminLinks.map((item) => (
                <SidebarLink key={item.href} item={item} collapsed={collapsed} onClose={onClose} />
              ))}
            </div>
          )}
        </nav>

        {/* ── User footer ── */}
        {isAuthenticated && user && (
          <div className="shrink-0 border-t border-[var(--sidebar-border)] px-2 py-3">
            {/* Avatar + name */}
            <div
              className={`
                mb-2 flex items-center gap-2.5 rounded-xl px-3 py-2
                text-[var(--sidebar-text)]
                ${collapsed ? "lg:justify-center lg:px-0" : ""}
              `}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-[11px] font-bold"
                aria-hidden="true"
              >
                {initials(user.name)}
              </span>
              <div
                className={`
                  min-w-0 overflow-hidden transition-all duration-300
                  ${collapsed ? "lg:w-0 lg:opacity-0" : "w-auto opacity-100"}
                `}
              >
                <p className="truncate text-sm font-semibold leading-tight">{user.name}</p>
                <p className="truncate text-[10px] text-[var(--sidebar-muted)] capitalize">{user.role}</p>
              </div>
            </div>
            {/* Logout */}
            <button
              type="button"
              onClick={handleLogout}
              title={collapsed ? t("logout") : undefined}
              className={`
                flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium
                text-[var(--sidebar-text)] transition-colors
                hover:bg-[var(--sidebar-hover-bg)] hover:text-white
                ${collapsed ? "lg:justify-center lg:px-0" : ""}
              `}
            >
              <Icon name="close" size={18} className="shrink-0 opacity-75" />
              <span
                className={`
                  truncate transition-all duration-300 overflow-hidden whitespace-nowrap
                  ${collapsed ? "lg:w-0 lg:opacity-0" : "w-auto opacity-100"}
                `}
              >
                {t("logout")}
              </span>
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

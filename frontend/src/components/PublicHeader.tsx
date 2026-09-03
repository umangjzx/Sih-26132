"use client";

/**
 * Public top navigation bar — logged-out visitors only.
 *
 * All nav items are now real page routes (no hash links).
 * The header uses a glassmorphic style that adapts:
 *   - Home page: starts transparent over the dark hero, becomes
 *     a frosted-glass bar once the user scrolls past the hero.
 *   - Other pages: always a solid frosted-glass bar.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";
import { Icon } from "./ui";

type NavItem = {
  href: string;
  labelKey: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/",                labelKey: "home"           },
  { href: "/features",        labelKey: "features"       },
  { href: "/how-it-works",    labelKey: "howItWorks"     },
  { href: "/market-insights", labelKey: "marketInsights" },
  { href: "/about",           labelKey: "about"          },
];

/* ── Nav link (desktop) ──────────────────────────────────────────────── */

function DesktopNavLink({
  item,
  light,
}: {
  item: NavItem;
  light: boolean;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const active =
    pathname === item.href ||
    (item.href !== "/" && pathname.startsWith(item.href));
  const label = t(item.labelKey as "home");

  return (
    <Link
      href={item.href}
      className="relative px-1 py-0.5 text-sm font-semibold transition-colors duration-150"
      style={{
        color: light
          ? active ? "var(--amber-400)" : "rgba(255,255,255,0.75)"
          : active ? "var(--green-700)" : "var(--ink-soft)",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.color = light ? "#fff" : "var(--ink)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.color = light
            ? "rgba(255,255,255,0.75)"
            : "var(--ink-soft)";
        }
      }}
    >
      {label}
      <span
        className="absolute -bottom-0.5 left-0 h-[2px] w-full rounded-full origin-left transition-transform duration-200"
        style={{
          background: light ? "var(--amber-400)" : "var(--green-600)",
          transform: active ? "scaleX(1)" : "scaleX(0)",
        }}
      />
    </Link>
  );
}

/* ── Nav link (mobile) ───────────────────────────────────────────────── */

function MobileNavLink({
  item,
  onClose,
}: {
  item: NavItem;
  onClose: () => void;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const active =
    pathname === item.href ||
    (item.href !== "/" && pathname.startsWith(item.href));
  const label = t(item.labelKey as "home");

  return (
    <Link
      href={item.href}
      onClick={onClose}
      className={`
        flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold
        transition-colors
        ${active
          ? "bg-[var(--green-50)] text-[var(--green-700)]"
          : "text-[var(--ink)] hover:bg-[var(--paper)]"
        }
      `}
    >
      {label}
    </Link>
  );
}

/* ── PublicHeader ─────────────────────────────────────────────────────── */

export function PublicHeader() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  const isHome = pathname === "/";

  /* Close drawer on route change */
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  /* Track scroll position — after ~10px, switch to solid header */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Focus trap in mobile drawer */
  useEffect(() => {
    if (!open) return;
    const el = drawerRef.current;
    if (!el) return;
    const focusables = el.querySelectorAll<HTMLElement>(
      'a[href], button, select, input, [tabindex]:not([tabindex="-1"])',
    );
    focusables[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  /*
   * Header appearance logic:
   *
   * Home + not scrolled → transparent, light text (over dark hero)
   * Home + scrolled     → frosted glass, dark text
   * Other pages         → always frosted glass, dark text
   *
   * "light" = white text for links on the transparent home header
   */
  const showLight = isHome && !scrolled;

  const headerStyle: React.CSSProperties = showLight
    ? { background: "transparent" }
    : scrolled
      ? {
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          boxShadow: "0 1px 16px rgba(15,37,24,0.10)",
        }
      : {
          background: "rgba(255,255,255,0.82)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--line)",
        };

  return (
    <>
      <header
        className="fixed inset-x-0 top-0 z-50 w-full transition-all duration-300"
        style={headerStyle}
        role="banner"
      >
        <div className="mx-auto flex h-[4.25rem] max-w-screen-xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link
            href="/"
            aria-label="AgriLink home"
            className="shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--green-400)]"
          >
            <Logo size={36} variant={showLight ? "sidebar" : "full"} />
          </Link>

          {/* Desktop nav */}
          <nav aria-label="Main" className="ml-6 hidden items-center gap-6 lg:flex">
            {NAV_ITEMS.map((item) => (
              <DesktopNavLink key={item.labelKey} item={item} light={showLight} />
            ))}
          </nav>

          {/* Right cluster */}
          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden sm:block">
              <LanguageSwitcher />
            </div>
            <Link
              href="/login"
              className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors sm:inline-flex"
              style={{
                color: showLight ? "rgba(255,255,255,0.85)" : "var(--green-700)",
              }}
              onMouseEnter={(e) => {
                if (showLight) {
                  (e.currentTarget as HTMLElement).style.color = "#fff";
                } else {
                  (e.currentTarget as HTMLElement).style.background = "var(--green-50)";
                }
              }}
              onMouseLeave={(e) => {
                if (showLight) {
                  (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.85)";
                } else {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }
              }}
            >
              {t("login")}
            </Link>
            <Link
              href="/login"
              className="al-btn-secondary hidden px-4 py-2 text-sm sm:inline-flex"
            >
              <Icon name="leaf" size={15} />
              {t("getStarted")}
            </Link>
            <button
              type="button"
              aria-label={t("openMenu")}
              aria-expanded={open}
              aria-controls="public-mobile-nav"
              onClick={() => setOpen((v) => !v)}
              className="al-btn-icon lg:hidden"
              style={{
                color: showLight ? "#fff" : undefined,
              }}
            >
              <Icon name={open ? "close" : "menu"} size={22} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile backdrop */}
      <div
        aria-hidden="true"
        onClick={close}
        className={`
          fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 lg:hidden
          ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}
        `}
      />

      {/* Mobile drawer */}
      <div
        id="public-mobile-nav"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        inert={!open}
        className={`
          fixed inset-y-0 right-0 z-50 flex w-72 flex-col bg-[var(--surface)]
          shadow-[var(--shadow-xl)] transition-transform duration-300 lg:hidden
          ${open ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {/* Drawer header */}
        <div className="flex h-[4.25rem] items-center justify-between border-b border-[var(--line)] px-5">
          <Logo size={32} variant="full" />
          <button type="button" aria-label="Close menu" onClick={close} className="al-btn-icon">
            <Icon name="close" size={20} />
          </button>
        </div>

        {/* Drawer links */}
        <nav aria-label="Mobile navigation" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map((item) => (
            <MobileNavLink key={item.labelKey} item={item} onClose={close} />
          ))}
          <div className="my-2 h-px bg-[var(--line)]" />
          <Link
            href="/login"
            onClick={close}
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--paper)]"
          >
            <Icon name="leaf" size={18} className="text-[var(--green-700)]" />
            {t("login")}
          </Link>
        </nav>

        {/* Drawer footer */}
        <div className="border-t border-[var(--line)] px-4 py-4">
          <LanguageSwitcher />
          <Link
            href="/login"
            onClick={close}
            className="al-btn-primary mt-3 w-full justify-center"
          >
            <Icon name="leaf" size={15} />
            {t("getStarted")}
          </Link>
        </div>
      </div>
    </>
  );
}

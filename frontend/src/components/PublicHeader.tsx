"use client";

/**
 * Public top navigation bar — logged-out visitors only.
 *
 * Hash links (/#features, /#how, /#about) use a JS smooth-scroll handler
 * instead of Next.js <Link> to avoid the App Router remount-then-lose-hash
 * problem. External routes (/explore) use <Link> normally.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";
import { Icon } from "./ui";

type NavItem = {
  href: string;
  labelKey: string;
  /** section id to smooth-scroll to (hash links only) */
  sectionId?: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/",        labelKey: "home"          },
  { href: "#",        labelKey: "features",      sectionId: "features" },
  { href: "#",        labelKey: "howItWorks",    sectionId: "how"      },
  { href: "/explore", labelKey: "marketInsights"                        },
  { href: "#",        labelKey: "about",         sectionId: "about"    },
];

/* ── smooth scroll helper ────────────────────────────────────────────── */
const HEADER_H = 68; // px — matches h-[4.25rem]

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY - HEADER_H - 16;
  window.scrollTo({ top: y, behavior: "smooth" });
}

/* ── NavItem renderer ────────────────────────────────────────────────── */

function NavItemBtn({
  item,
  activeSection,
  onClose,
  mobile = false,
}: {
  item: NavItem;
  activeSection: string;
  onClose: () => void;
  mobile?: boolean;
}) {
  const t        = useTranslations("nav");
  const pathname = usePathname();
  const router   = useRouter();

  const isHash = Boolean(item.sectionId);
  const active = isHash
    ? activeSection === item.sectionId
    : pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

  function handleClick(e: React.MouseEvent) {
    if (!item.sectionId) return; // let Link handle real routes
    e.preventDefault();
    onClose();

    // If we're not on the home page, navigate there first then scroll
    if (pathname !== "/") {
      router.push("/");
      // Give the page a tick to render before scrolling
      setTimeout(() => scrollToSection(item.sectionId!), 120);
    } else {
      scrollToSection(item.sectionId);
    }
  }

  const label = t(item.labelKey as "home");

  if (mobile) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`
          flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold
          transition-colors
          ${active
            ? "bg-[var(--green-50)] text-[var(--green-700)]"
            : "text-[var(--ink)] hover:bg-[var(--paper)]"
          }
        `}
      >
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`
        relative px-1 py-0.5 text-sm font-semibold transition-colors duration-150
        ${active
          ? "text-[var(--green-700)]"
          : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
        }
      `}
    >
      {label}
      <span
        className={`
          absolute -bottom-0.5 left-0 h-[2px] w-full rounded-full bg-[var(--green-600)]
          origin-left transition-transform duration-200
          ${active ? "scale-x-100" : "scale-x-0"}
        `}
      />
    </button>
  );
}

/* ── a real <Link> for non-hash routes ──────────────────────────────── */

function NavRouteLink({
  item,
  mobile = false,
  onClose,
}: {
  item: NavItem;
  mobile?: boolean;
  onClose: () => void;
}) {
  const t        = useTranslations("nav");
  const pathname = usePathname();
  const active   =
    pathname === item.href ||
    (item.href !== "/" && pathname.startsWith(item.href));
  const label = t(item.labelKey as "home");

  if (mobile) {
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

  return (
    <Link
      href={item.href}
      className={`
        relative px-1 py-0.5 text-sm font-semibold transition-colors duration-150
        ${active
          ? "text-[var(--green-700)]"
          : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
        }
      `}
    >
      {label}
      <span
        className={`
          absolute -bottom-0.5 left-0 h-[2px] w-full rounded-full bg-[var(--green-600)]
          origin-left transition-transform duration-200
          ${active ? "scale-x-100" : "scale-x-0"}
        `}
      />
    </Link>
  );
}

/* ── Active-section tracker (IntersectionObserver) ───────────────────── */

function useActiveSection(ids: string[]) {
  const [active, setActive] = useState("");

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActive(id); },
        { rootMargin: `-${HEADER_H + 24}px 0px -60% 0px`, threshold: 0 },
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, [ids]);

  return active;
}

/* ── PublicHeader ─────────────────────────────────────────────────────── */

export function PublicHeader() {
  const t        = useTranslations("nav");
  const pathname = usePathname();
  const [open,     setOpen]     = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const drawerRef               = useRef<HTMLDivElement>(null);

  const sectionIds    = NAV_ITEMS.filter((i) => i.sectionId).map((i) => i.sectionId!);
  const activeSection = useActiveSection(sectionIds);

  /* Close drawer on route change */
  useEffect(() => { setOpen(false); }, [pathname]);

  /* Deepen the glass blur after scrolling 10 px */
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
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  const headerBase = [
    "sticky top-0 z-50 w-full transition-all duration-300",
    scrolled
      ? "bg-[var(--surface)]/96 backdrop-blur-lg shadow-[0_1px_16px_rgba(15,37,24,0.10)]"
      : "bg-[var(--surface)]/82 backdrop-blur-md border-b border-[var(--line)]",
  ].join(" ");

  function renderNavItem(item: NavItem, mobile = false) {
    if (item.sectionId) {
      return (
        <NavItemBtn
          key={item.labelKey}
          item={item}
          activeSection={activeSection}
          onClose={close}
          mobile={mobile}
        />
      );
    }
    return (
      <NavRouteLink
        key={item.labelKey}
        item={item}
        onClose={close}
        mobile={mobile}
      />
    );
  }

  return (
    <>
      <header className={headerBase} role="banner">
        <div className="mx-auto flex h-[4.25rem] max-w-screen-xl items-center gap-4 px-4 sm:px-6 lg:px-8">

          {/* Logo */}
          <Link
            href="/"
            aria-label="AgriLink home"
            className="shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--green-400)]"
          >
            <Logo size={36} variant="full" />
          </Link>

          {/* Desktop nav */}
          <nav aria-label="Main" className="ml-6 hidden items-center gap-6 lg:flex">
            {NAV_ITEMS.map((item) => renderNavItem(item))}
          </nav>

          {/* Right cluster */}
          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden sm:block">
              <LanguageSwitcher />
            </div>
            <Link
              href="/login"
              className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-[var(--green-700)] transition-colors hover:bg-[var(--green-50)] sm:inline-flex"
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
          {NAV_ITEMS.map((item) => renderNavItem(item, true))}
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

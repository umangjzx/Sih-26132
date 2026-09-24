"use client";

/**
 * GlobalSearch — command-palette-style overlay for jumping to any page.
 *
 * Opens on Ctrl+K / Cmd+K (toggles) and on "/" (only when focus isn't
 * already inside a text input/textarea/select/contenteditable, so typing
 * "/" in a normal field never hijacks the keystroke). Mounted once in
 * ClientAppShell; its own open/close state is owned by the parent (same
 * lifted-state pattern as the sidebar drawer) so the trigger button in
 * TopHeader and the keyboard shortcuts both drive the same overlay.
 *
 * Search is entirely client-side over a static registry of the app's own
 * routes — no network request, so there is no loading state to design for.
 */

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "./AuthProvider";
import { Icon } from "./ui";

type Role = "farmer" | "buyer" | "admin";

type SearchItem = {
  href: string;
  /** Namespace to resolve labelKey against — "nav" reuses existing nav.*
   * strings; "search" is for the handful of labels nav.* doesn't have. */
  ns: "nav" | "search";
  labelKey: string;
  icon: string;
  keywords: string[];
  /** Only shown when the signed-in user has one of these roles. */
  roles?: Role[];
  /** Only shown when signed in at all (any role). */
  authOnly?: boolean;
};

const REGISTRY: SearchItem[] = [
  { href: "/", ns: "nav", labelKey: "home", icon: "house", keywords: ["home", "dashboard", "start"] },
  { href: "/prices", ns: "nav", labelKey: "marketIntel", icon: "chart", keywords: ["prices", "mandi", "market", "trends", "agmarknet", "rates"] },
  { href: "/advisor", ns: "nav", labelKey: "advisor", icon: "spark", keywords: ["advisor", "advice", "sell", "buy", "timing", "recommendation"], roles: ["farmer", "buyer"] },
  { href: "/directory", ns: "nav", labelKey: "directory", icon: "warehouse", keywords: ["directory", "warehouse", "cold storage", "fpo", "mandi"] },
  { href: "/farmer", ns: "nav", labelKey: "myLots", icon: "leaf", keywords: ["my lots", "sell", "produce", "harvest", "listing"], roles: ["farmer"] },
  { href: "/buyer", ns: "nav", labelKey: "myDemands", icon: "handshake", keywords: ["my demands", "buy", "procurement", "requirement"], roles: ["buyer"] },
  { href: "/browse", ns: "nav", labelKey: "marketplace", icon: "globe", keywords: ["marketplace", "browse", "matches", "listings"], roles: ["farmer", "buyer"] },
  { href: "/forward", ns: "nav", labelKey: "forward", icon: "calendar", keywords: ["forward", "contract", "pre-harvest"], roles: ["farmer", "buyer"] },
  { href: "/history", ns: "nav", labelKey: "history", icon: "clock", keywords: ["deals", "history", "past", "transactions"], authOnly: true },
  { href: "/financing", ns: "nav", labelKey: "financing", icon: "warehouse", keywords: ["financing", "loan", "warehouse receipt", "credit"], roles: ["farmer"] },
  { href: "/alerts", ns: "nav", labelKey: "alerts", icon: "bell", keywords: ["alerts", "notifications", "sms", "digest"], authOnly: true },
  { href: "/profile", ns: "nav", labelKey: "profile", icon: "users", keywords: ["profile", "account", "settings"], authOnly: true },
  { href: "/about", ns: "nav", labelKey: "about", icon: "leaf", keywords: ["about", "team", "sih", "mission"] },
  { href: "/features", ns: "nav", labelKey: "features", icon: "spark", keywords: ["features", "capabilities"] },
  { href: "/how-it-works", ns: "nav", labelKey: "howItWorks", icon: "connection", keywords: ["how it works", "guide", "steps"] },
  { href: "/market-insights", ns: "nav", labelKey: "marketInsights", icon: "analytics", keywords: ["market insights", "analytics", "trends"] },
  { href: "/judges", ns: "search", labelKey: "judgesPage", icon: "shield", keywords: ["judges", "hackathon", "evaluation", "sih", "ps 26132"] },
];

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function GlobalSearch({
  open,
  onOpen,
  onClose,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("nav");
  const tSearch = useTranslations("search");
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  // Tracks the previous `open`/result-set "shape" so we can reset local
  // state as a render-time adjustment (React's recommended alternative to
  // a setState-inside-useEffect for derived state) instead of an effect.
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevResultsKey, setPrevResultsKey] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const label = useCallback(
    (item: SearchItem) =>
      item.ns === "search"
        ? tSearch(item.labelKey as "judgesPage")
        : t(item.labelKey as "home"),
    [t, tSearch],
  );

  const visibleItems = useMemo(
    () =>
      REGISTRY.filter((item) => {
        if (item.authOnly && !isAuthenticated) return false;
        if (item.roles && (!user || !item.roles.includes(user.role as Role))) return false;
        return true;
      }),
    [isAuthenticated, user],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return visibleItems;
    const words = q.split(/\s+/).filter(Boolean);
    return visibleItems.filter((item) => {
      const haystack = [label(item), item.href, ...item.keywords].join(" ").toLowerCase();
      return words.every((w) => haystack.includes(w));
    });
  }, [query, visibleItems, label]);

  // Reset the highlighted result whenever the result set changes shape —
  // a render-time state adjustment (React's documented alternative to a
  // setState-inside-useEffect) rather than a real effect.
  const resultsKey = `${query}|${results.length}`;
  if (resultsKey !== prevResultsKey) {
    setPrevResultsKey(resultsKey);
    setActiveIndex(0);
  }

  // Global shortcuts: Ctrl/Cmd+K toggles; "/" opens (unless already typing).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) onClose();
        else onOpen();
        return;
      }
      if (!open && e.key === "/" && !isTypingTarget(e.target)) {
        e.preventDefault();
        onOpen();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpen, onClose]);

  // Clear the query as soon as `open` flips — a render-time state
  // adjustment rather than a setState-inside-useEffect.
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) setQuery("");
  }

  // Open/close lifecycle: focus input + lock scroll while open; restore
  // focus to whatever triggered the overlay when it closes. This is a
  // genuine effect (DOM focus + document.body side effects, no setState).
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement;
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      const { overflow } = document.body.style;
      document.body.style.overflow = "hidden";
      return () => {
        window.clearTimeout(id);
        document.body.style.overflow = overflow;
      };
    }
    triggerRef.current?.focus?.();
    triggerRef.current = null;
    return undefined;
  }, [open]);

  const navigateTo = useCallback(
    (href: string) => {
      router.push(href);
      onClose();
    },
    [router, onClose],
  );

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[activeIndex];
      if (item) navigateTo(item.href);
    }
  }

  // Minimal focus trap: dialog only ever contains the input and (on
  // mobile) a close button, so keep Tab cycling within those.
  function onDialogKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Tab") return;
    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
      'input, button, [href], [tabindex]:not([tabindex="-1"])',
    );
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  // Keep the highlighted result scrolled into view as arrow keys move it.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={tSearch("title")}
        inert={!open}
        onKeyDown={onDialogKeyDown}
        className={`
          fixed left-1/2 top-[10vh] z-[61] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2
          overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl
          transition-all duration-200
          ${open ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"}
        `}
      >
        <div className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-3">
          <Icon name="search" size={18} className="shrink-0 text-[var(--ink-soft)]" />
          <label htmlFor="global-search-input" className="sr-only">
            {tSearch("placeholder")}
          </label>
          <input
            id="global-search-input"
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls="global-search-listbox"
            aria-activedescendant={results[activeIndex] ? `global-search-option-${activeIndex}` : undefined}
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder={tSearch("placeholder")}
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--ink)] placeholder:text-[var(--ink-mute)] focus:outline-none"
          />
          <kbd className="hidden shrink-0 rounded border border-[var(--line)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--ink-mute)] sm:inline-block">
            Esc
          </kbd>
          <button
            type="button"
            onClick={onClose}
            aria-label={tSearch("close")}
            className="al-btn-icon shrink-0 sm:hidden"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div
          ref={listRef}
          id="global-search-listbox"
          role="listbox"
          aria-label={tSearch("title")}
          className="max-h-[60vh] overflow-y-auto p-2"
        >
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-[var(--ink-soft)]">
              {tSearch("noResults", { query })}
            </p>
          ) : (
            results.map((item, i) => {
              const active = i === activeIndex;
              return (
                <div
                  key={item.href}
                  id={`global-search-option-${i}`}
                  role="option"
                  aria-selected={active}
                  data-index={i}
                  tabIndex={-1}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => navigateTo(item.href)}
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                    active ? "bg-[var(--green-700)] text-white" : "text-[var(--ink)] hover:bg-[var(--paper)]"
                  }`}
                >
                  <Icon
                    name={item.icon}
                    size={18}
                    className={`shrink-0 ${active ? "opacity-100" : "opacity-70"}`}
                  />
                  <span className="truncate font-medium">{label(item)}</span>
                  <span className={`ml-auto truncate text-xs ${active ? "text-white/70" : "text-[var(--ink-mute)]"}`}>
                    {item.href}
                  </span>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-[var(--line)] px-4 py-2 text-[11px] text-[var(--ink-mute)]">
          {tSearch("hint")}
        </div>
      </div>
    </>
  );
}

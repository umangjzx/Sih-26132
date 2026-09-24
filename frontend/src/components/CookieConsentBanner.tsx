"use client";

/**
 * Honest, minimal storage-consent notice.
 *
 * HarvestIQ does not use third-party tracking cookies (verified: no gtag,
 * analytics, fbq, or document.cookie usage anywhere in the codebase). It
 * does store a handful of first-party preferences in localStorage — the
 * auth session, theme choice, sidebar-collapse state, locale, and location
 * preference — so this banner says exactly that, nothing more.
 *
 * The dismissal choice itself is persisted in localStorage so the banner
 * only ever shows once per device (until storage is cleared).
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const DISMISS_KEY = "harvestiq-cookie-notice-dismissed";

export function CookieConsentBanner() {
  const t = useTranslations("cookieBanner");
  // Hidden by default (matches SSR) — only shown once we've confirmed on
  // the client that the user hasn't already dismissed it, so there's no
  // flash of the banner on repeat visits.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(DISMISS_KEY) !== "1") {
        setVisible(true);
      }
    } catch {
      // Storage unavailable (private mode) — show it anyway, just won't persist.
      setVisible(true);
    }
  }, []);

  function accept() {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* storage unavailable — banner will simply reappear next visit */
    }
  }

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label={t("title")}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--line)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-lg)] print:hidden sm:px-6"
    >
      <div className="mx-auto flex w-full max-w-screen-xl flex-col items-center gap-3 sm:flex-row sm:justify-between sm:gap-6">
        <p className="text-center text-xs leading-relaxed text-[var(--ink-soft)] sm:text-left sm:text-sm">
          {t("message")}
        </p>
        <button
          type="button"
          onClick={accept}
          className="al-btn-secondary w-full shrink-0 px-5 py-2 text-sm sm:w-auto"
        >
          {t("accept")}
        </button>
      </div>
    </div>
  );
}

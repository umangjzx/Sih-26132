"use client";

/**
 * Fixed back-to-top button. Appears once the user has scrolled past a
 * meaningful distance, smooth-scrolls to the top on click.
 *
 * Sits bottom-left — the opposite corner from AskHarvestIQ's floating chat
 * button (`fixed bottom-20 right-4 ... sm:right-6 lg:bottom-6`), so the two
 * never collide at any breakpoint.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Icon } from "./ui";

const SHOW_AFTER_PX = 400;

export function BackToTopButton() {
  const t = useTranslations("common");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let ticking = false;
    const update = () => {
      setVisible(window.scrollY > SHOW_AFTER_PX);
      ticking = false;
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function scrollToTop() {
    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label={t("backToTop")}
      title={t("backToTop")}
      className="fixed bottom-20 left-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)] shadow-[var(--shadow-md)] transition-colors hover:text-[var(--green-700)] print:hidden sm:left-6 lg:bottom-6"
    >
      <Icon name="arrowUp" size={18} />
    </button>
  );
}

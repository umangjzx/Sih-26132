"use client";

import { useTranslations } from "next-intl";

import { useTheme } from "@/lib/ThemeProvider";
import { Icon } from "./ui";

/**
 * Light/dark toggle. Reused in both PublicHeader and TopHeader/Sidebar —
 * pass a className to adapt sizing/color to whichever chrome it sits in.
 */
export function ThemeToggle({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const { theme, toggle } = useTheme();
  const t = useTranslations("common");
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? t("switchToLightMode") : t("switchToDarkMode")}
      title={isDark ? t("switchToLightMode") : t("switchToDarkMode")}
      className={`al-btn-icon ${className}`}
      style={style}
    >
      <Icon name={isDark ? "sun" : "moon"} size={19} />
    </button>
  );
}

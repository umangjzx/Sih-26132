"use client";

import { useTranslations } from "next-intl";

import { locales, localeLabels } from "@/i18n/config";
import { useAppLocale } from "@/i18n/LocaleProvider";

export function LanguageSwitcher() {
  const { locale, setLocale } = useAppLocale();
  const t = useTranslations("nav");

  return (
    <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
      <span className="sr-only">{t("language")}</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as typeof locale)}
        aria-label={t("language")}
        className="min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] backdrop-blur-md px-4 py-2 text-base font-semibold text-[var(--color-text)] shadow-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent focus:outline-none transition-all duration-200 cursor-pointer"
      >
        {locales.map((code) => (
          <option key={code} value={code}>
            {localeLabels[code]}
          </option>
        ))}
      </select>
    </label>
  );
}

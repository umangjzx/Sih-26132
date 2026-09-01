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
        className="min-h-11 rounded-lg border-2 border-stone-300 bg-white px-3 py-2 text-base font-semibold text-stone-800 shadow-sm focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-700/30"
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

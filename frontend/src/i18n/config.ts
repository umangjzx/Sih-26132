export const locales = ["en", "hi", "mr"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeLabels: Record<Locale, string> = {
  en: "English",
  hi: "हिंदी",
  mr: "मराठी",
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

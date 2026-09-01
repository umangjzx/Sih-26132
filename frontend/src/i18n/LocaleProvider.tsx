"use client";

import { NextIntlClientProvider } from "next-intl";
import { createContext, useContext, useEffect, useState } from "react";

import { AppShellSkeleton } from "@/components/AppShellSkeleton";
import { defaultLocale, isLocale, type Locale } from "./config";
import en from "./messages/en.json";
import hi from "./messages/hi.json";
import mr from "./messages/mr.json";

const messagesByLocale: Record<Locale, Record<string, unknown>> = { en, hi, mr };
const STORAGE_KEY = "agrilink.locale";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function useAppLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useAppLocale must be used within LocaleProvider");
  return ctx;
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const next: Locale = stored && isLocale(stored) ? stored : defaultLocale;
    setLocaleState(next);
    document.documentElement.lang = next;
    setReady(true);
  }, []);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      <NextIntlClientProvider locale={locale} messages={messagesByLocale[locale]} timeZone="Asia/Kolkata">
        {ready ? children : <AppShellSkeleton />}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}

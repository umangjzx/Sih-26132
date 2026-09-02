"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { useAppLocale } from "@/i18n/LocaleProvider";
import { askAssistant } from "@/lib/api";
import { Icon } from "./ui";

type Turn = { role: "user" | "ai"; text: string };

export function AskAgriLink() {
  const t = useTranslations("assistant");
  const { locale } = useAppLocale();
  const params = useSearchParams();
  const crop = params.get("crop") ?? undefined;
  const market = params.get("market") ?? undefined;

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const question = q.trim();
    if (!question || busy) return;
    setTurns((s) => [...s, { role: "user", text: question }]);
    setQ("");
    setBusy(true);
    try {
      const r = await askAssistant({ question, crop, market, lang: locale });
      if (!r.available) {
        setUnavailable(true);
        setTurns((s) => [...s, { role: "ai", text: t("unavailable") }]);
      } else {
        setTurns((s) => [...s, { role: "ai", text: r.answer ?? t("error") }]);
      }
    } catch {
      setTurns((s) => [...s, { role: "ai", text: t("error") }]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 1e6 }));
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("title")}
        className="fixed bottom-4 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--green-700)] text-white shadow-lg shadow-green-900/30 transition-transform hover:scale-105 sm:bottom-6 sm:right-6"
      >
        <Icon name={open ? "close" : "spark"} size={24} />
      </button>

      {open && (
        <div className="fixed bottom-20 right-4 z-40 flex h-[28rem] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl sm:bottom-24 sm:right-6">
          <div className="flex items-center gap-2 border-b border-[var(--line)] bg-[var(--green-700)] px-4 py-3 text-white">
            <Icon name="spark" size={16} />
            <span className="font-heading text-sm font-bold">{t("title")}</span>
            {crop && market && (
              <span className="ml-auto truncate text-[11px] text-white/70">
                {crop} · {market}
              </span>
            )}
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
            {turns.length === 0 && (
              <p className="px-1 text-xs text-[var(--ink-soft)]">{t("hint")}</p>
            )}
            {turns.map((turn, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  turn.role === "user"
                    ? "ml-auto bg-[var(--green-600)] text-white"
                    : "bg-[var(--paper)] text-[var(--ink)]"
                }`}
              >
                {turn.text}
              </div>
            ))}
            {busy && (
              <div className="w-16 rounded-2xl bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink-soft)]">
                …
              </div>
            )}
          </div>

          {!unavailable && (
            <form onSubmit={send} className="flex gap-2 border-t border-[var(--line)] p-3">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("placeholder")}
                className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--green-600)]"
              />
              <button
                type="submit"
                disabled={busy || !q.trim()}
                className="shrink-0 rounded-xl bg-[var(--green-700)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {t("send")}
              </button>
            </form>
          )}
        </div>
      )}
    </>
  );
}

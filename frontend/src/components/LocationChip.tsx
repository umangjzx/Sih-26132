"use client";

/**
 * Header location control (v1.2). Shows the active place, or "Set location".
 * The popover offers: browser geolocation, a free-text place search, and an
 * all-India state picker. Curated data (crop calendar, storage, FPOs) stays
 * Maharashtra-only and degrades gracefully elsewhere.
 */

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { listStates } from "@/lib/api";
import { useLocation } from "@/lib/useLocation";
import { Icon } from "./ui";

export function LocationChip() {
  const t = useTranslations("location");
  const { location, loading, error, detect, setPlace, setStateName, clear } =
    useLocation();
  const [open, setOpen] = useState(false);
  const [states, setStates] = useState<string[]>([]);
  const [placeText, setPlaceText] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && states.length === 0) {
      listStates()
        .then(setStates)
        .catch(() => setStates([]));
    }
  }, [open, states.length]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const errorKey: "errorDenied" | "errorUnsupported" | "errorResolve" | null =
    error === "denied"
      ? "errorDenied"
      : error === "unsupported"
        ? "errorUnsupported"
        : error === "resolve"
          ? "errorResolve"
          : null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-white/70 px-3 py-2 text-sm font-semibold text-[var(--ink)] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
      >
        <Icon name="pin" size={14} />
        <span className="max-w-[10rem] truncate">
          {location?.label ?? t("setLocation")}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t("title")}
          className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4 shadow-lg"
        >
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)]">
            {t("title")}
          </p>

          <button
            type="button"
            onClick={detect}
            disabled={loading}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--green-600)] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[var(--green-700)] disabled:opacity-60"
          >
            <Icon name="pin" size={14} />
            {loading ? t("detecting") : t("detect")}
          </button>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = placeText.trim();
              if (v) {
                setPlace(v);
                setPlaceText("");
                setOpen(false);
              }
            }}
            className="mt-3"
          >
            <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--ink-soft)]">
              {t("placeLabel")}
              <input
                value={placeText}
                onChange={(e) => setPlaceText(e.target.value)}
                placeholder={t("placePlaceholder")}
                className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--green-600)]"
              />
            </label>
          </form>

          <label className="mt-3 flex flex-col gap-1 text-xs font-semibold text-[var(--ink-soft)]">
            {t("stateLabel")}
            <select
              value={location?.state ?? ""}
              onChange={(e) => {
                if (e.target.value) {
                  setStateName(e.target.value);
                  setOpen(false);
                }
              }}
              className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--green-600)]"
            >
              <option value="">{t("statePlaceholder")}</option>
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          {errorKey && (
            <p className="mt-2 text-xs font-medium text-[var(--red-700)]">
              {t(errorKey)}
            </p>
          )}

          {location && location.state !== "Maharashtra" && (
            <p className="mt-2 text-xs text-[var(--ink-soft)]">{t("mhOnlyNote")}</p>
          )}

          {location && (
            <button
              type="button"
              onClick={() => {
                clear();
                setOpen(false);
              }}
              className="mt-3 text-xs font-semibold text-[var(--ink-soft)] underline hover:text-[var(--ink)]"
            >
              {t("clear")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

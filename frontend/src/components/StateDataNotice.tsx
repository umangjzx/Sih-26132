"use client";

import { useTranslations } from "next-intl";

import { useLocation } from "@/lib/useLocation";
import { Icon } from "./ui";

/**
 * Shown when the user has picked a state we have no live mandi prices for yet.
 * The upstream feed is slow/patchy outside Maharashtra, so we degrade honestly
 * rather than showing an empty picker.
 */
export function StateDataNotice({ state }: { state?: string }) {
  const t = useTranslations("location");
  const { setStateName, clear } = useLocation();
  if (!state) return null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--amber-500)]/30 bg-[var(--amber-100)]/60 px-5 py-4 text-sm text-[var(--amber-700)] sm:flex-row sm:items-center sm:justify-between">
      <span className="flex items-start gap-2">
        <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
        {t("noStateData", { state })}
      </span>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => setStateName("Maharashtra")}
          className="rounded-lg bg-[var(--green-700)] px-3 py-1.5 text-xs font-bold text-white hover:bg-[var(--green-900)]"
        >
          {t("useMaharashtra")}
        </button>
        <button
          type="button"
          onClick={clear}
          className="rounded-lg border border-[var(--amber-500)]/40 px-3 py-1.5 text-xs font-semibold hover:bg-white/40"
        >
          {t("clear")}
        </button>
      </div>
    </div>
  );
}

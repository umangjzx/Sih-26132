"use client";

import { useTranslations } from "next-intl";

import { Icon } from "@/components/ui";

function ago(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const days = Math.round((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

/**
 * A small "where this number comes from" line for price / signal cards.
 * `source` defaults to the mandi feed; `asOf` is the latest data date.
 */
export function DataProvenance({
  source,
  asOf,
  className = "",
}: {
  source?: string | null;
  asOf?: string | null;
  className?: string;
}) {
  const t = useTranslations("common");
  const rel = ago(asOf);
  return (
    <p className={`flex flex-wrap items-center gap-x-1.5 text-[11px] text-[var(--ink-soft)] ${className}`}>
      <Icon name="check" size={11} className="text-[var(--green-600)]" />
      {t("source")}: <span className="font-semibold">{source || "AGMARKNET (data.gov.in)"}</span>
      {asOf && (
        <>
          <span className="opacity-40">·</span>
          {t("asOf")} {new Date(asOf).toLocaleDateString()}
          {rel && <span className="opacity-60"> ({rel})</span>}
        </>
      )}
    </p>
  );
}

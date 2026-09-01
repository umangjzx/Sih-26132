"use client";

/**
 * Transaction history page (Phase 3, HISTORY-01).
 *
 * Three native <details> sections — My Lots, My Demands, My Deals — populated from
 * GET /api/history, which the backend already scopes to the current user's role.
 * Client component (Cordova constraint).
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/AuthProvider";
import { getMyHistory, type HistoryResponse } from "@/lib/api";

export default function HistoryPage() {
  const { token, isAuthenticated } = useAuth();
  const router = useRouter();
  const t = useTranslations("history");

  const [data, setData] = useState<HistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) router.replace("/login");
  }, [isAuthenticated, router]);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      setData(await getMyHistory(token));
    } catch {
      setError(t("loadError"));
    }
  }, [token, t]);

  useEffect(() => {
    load();
  }, [load]);

  if (!isAuthenticated) return null;
  if (error) {
    return (
      <p className="rounded-md border border-[var(--color-wait)] bg-[var(--color-wait)]/10 px-4 py-3 text-sm text-[var(--color-wait)]">
        {error}
      </p>
    );
  }
  if (!data) return <p className="text-sm opacity-60">…</p>;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">{t("title")}</h1>

      <details className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4" open>
        <summary className="cursor-pointer text-sm font-semibold">
          {t("lotsSection")} ({data.lots.length})
        </summary>
        {data.lots.length === 0 ? (
          <p className="mt-2 text-sm opacity-60">{t("noLots")}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {data.lots.map((lot) => (
              <li key={lot.id} className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm">
                <span className="font-semibold">{lot.crop}</span> · {lot.quantity_kg} kg · {lot.quality_grade} · ₹{lot.expected_price}
                <span className="ml-2 rounded-full bg-[var(--color-border)] px-2 py-0.5 text-xs">{lot.status}</span>
              </li>
            ))}
          </ul>
        )}
      </details>

      <details className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4" open>
        <summary className="cursor-pointer text-sm font-semibold">
          {t("demandsSection")} ({data.demands.length})
        </summary>
        {data.demands.length === 0 ? (
          <p className="mt-2 text-sm opacity-60">{t("noDemands")}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {data.demands.map((d) => (
              <li key={d.id} className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm">
                <span className="font-semibold">{d.crop}</span> · {d.quantity_kg} kg · ₹{d.price_band_min}–₹{d.price_band_max}
                <span className="ml-2 rounded-full bg-[var(--color-border)] px-2 py-0.5 text-xs">{d.status}</span>
              </li>
            ))}
          </ul>
        )}
      </details>

      <details className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4" open>
        <summary className="cursor-pointer text-sm font-semibold">
          {t("dealsSection")} ({data.deals.length})
        </summary>
        {data.deals.length === 0 ? (
          <p className="mt-2 text-sm opacity-60">{t("noDeals")}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {data.deals.map((deal) => (
              <li key={deal.id} className="flex items-center justify-between rounded-md border border-[var(--color-border)] px-3 py-2 text-sm">
                <span>
                  <span className="font-semibold">{deal.lot.crop}</span> · ₹{deal.agreed_price} · {deal.agreed_quantity} kg
                  <span className="ml-2 rounded-full bg-[var(--color-border)] px-2 py-0.5 text-xs">{deal.pipeline_status}</span>
                </span>
                <Link href={`/deals/${deal.id}`} className="shrink-0 font-medium text-[var(--color-brand)] hover:underline">
                  {t("viewDeal")}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}

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
import { PageHeader } from "@/components/PageHeader";
import { PriceRealizationCard } from "@/components/PriceRealizationCard";
import { Icon } from "@/components/ui";

/** Status filter pills, shown only when there's more than one status to
 * filter between — a single-value pill row is just noise. */
function StatusFilterPills({
  value,
  onChange,
  options,
  labels,
  allLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  labels?: Record<string, string>;
  allLabel: string;
}) {
  if (options.length < 2) return null;
  return (
    <div className="mb-3 flex flex-wrap gap-1.5">
      {["all", ...options].map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`rounded-full px-3 py-1 text-xs font-bold capitalize transition ${
            value === opt
              ? "bg-[var(--green-700)] text-white"
              : "bg-[var(--paper)] text-[var(--ink-soft)] hover:bg-[var(--line)]"
          }`}
        >
          {opt === "all" ? allLabel : (labels?.[opt] ?? opt.replace(/_/g, " "))}
        </button>
      ))}
    </div>
  );
}

export default function HistoryPage() {
  const { token, isAuthenticated, ready, user } = useAuth();
  const router = useRouter();
  const t = useTranslations("history");
  const tdeals = useTranslations("deals");
  const tc = useTranslations("common");

  const [data, setData] = useState<HistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lotFilter, setLotFilter] = useState("all");
  const [demandFilter, setDemandFilter] = useState("all");
  const [dealFilter, setDealFilter] = useState("all");

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) router.replace("/login");
    else if (user?.role === "admin") router.replace("/admin");
  }, [ready, isAuthenticated, user, router]);

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

  const lotStatuses = Array.from(new Set((data?.lots ?? []).map((l) => l.status)));
  const filteredLots = (data?.lots ?? []).filter((l) => lotFilter === "all" || l.status === lotFilter);

  const demandStatuses = Array.from(new Set((data?.demands ?? []).map((d) => d.status)));
  const filteredDemands = (data?.demands ?? []).filter((d) => demandFilter === "all" || d.status === demandFilter);

  const dealStatuses = Array.from(new Set((data?.deals ?? []).map((d) => d.pipeline_status)));
  const filteredDeals = (data?.deals ?? []).filter((d) => dealFilter === "all" || d.pipeline_status === dealFilter);
  const dealStageLabels: Record<string, string> = {
    matched: tdeals("pipeline_matched"),
    offer_accepted: tdeals("pipeline_offer_accepted"),
    logistics_arranged: tdeals("pipeline_logistics_arranged"),
    delivered: tdeals("pipeline_delivered"),
    paid: tdeals("pipeline_paid"),
    closed: tdeals("pipeline_closed"),
  };

  if (!ready || !isAuthenticated) return null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon="clock"
        title={t("title")}
        subtitle={t("subtitle")}
      />

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--red-600)]/30 bg-[var(--red-100)] px-5 py-4 text-sm font-bold text-[var(--red-700)]">
          <Icon name="close" size={18} />
          {error}
          <button
            type="button"
            onClick={() => load()}
            className="ml-auto rounded-lg border border-[var(--red-500)]/40 bg-white px-3 py-1 text-xs font-bold"
          >
            {tc("retry")}
          </button>
        </div>
      )}

      {token && user?.role === "farmer" && <PriceRealizationCard token={token} />}
      
      {!data && !error && (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 w-full animate-pulse rounded-2xl bg-white/50" />
          ))}
        </div>
      )}

      {data && (
        <div className="flex flex-col gap-4">
          {/* Lots — farmers only; a buyer can never have one, so showing this
              as a permanent "No lots yet" empty state reads as a missing
              feature rather than "not applicable to your role". */}
          {user?.role === "farmer" && (
          <details className="group rounded-2xl border border-[var(--line)] bg-white shadow-sm transition-all" open>
            <summary className="flex cursor-pointer list-none items-center justify-between p-5 font-heading text-base font-bold text-[var(--ink)]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--green-100)] text-[var(--green-700)]">
                  <Icon name="leaf" size={20} />
                </div>
                {t("lotsSection")}
                <span className="ml-2 rounded-full bg-[var(--green-100)] px-2.5 py-0.5 text-xs font-bold text-[var(--green-700)]">
                  {lotFilter === "all" ? data.lots.length : `${filteredLots.length}/${data.lots.length}`}
                </span>
              </div>
              <Icon name="chevronDown" size={20} className="text-[var(--ink-soft)] transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-[var(--line)] p-5">
              <StatusFilterPills value={lotFilter} onChange={setLotFilter} options={lotStatuses} allLabel={t("filterAll")} />
              {data.lots.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <Icon name="leaf" size={28} className="text-[var(--green-300)]" />
                  <p className="text-sm text-[var(--ink-soft)]">{t("noLots")}</p>
                </div>
              ) : filteredLots.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--ink-soft)]">{t("noneMatchFilter")}</p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {filteredLots.map((lot) => (
                    <li key={lot.id} className="flex flex-col gap-2 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[var(--ink)]">{lot.crop}</span>
                        <span className="rounded-full bg-[var(--line)] px-2.5 py-1 text-xs font-bold text-[var(--ink-soft)] capitalize">
                          {lot.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-medium text-[var(--ink-soft)]">
                        <span className="flex items-center gap-1"><Icon name="chart" size={14} className="text-[var(--green-600)]" /> {lot.quantity_kg} kg</span>
                        <span className="flex items-center gap-1"><Icon name="pin" size={14} className="text-[var(--amber-600)]" /> ₹{lot.expected_price}/qtl</span>
                        <span className="flex items-center gap-1"><Icon name="check" size={14} className="text-[var(--ink-soft)]" /> {t("grade", { grade: lot.quality_grade })}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>
          )}

          {/* Demands — buyers only; same reasoning as Lots above. */}
          {user?.role === "buyer" && (
          <details className="group rounded-2xl border border-[var(--line)] bg-white shadow-sm transition-all" open>
            <summary className="flex cursor-pointer list-none items-center justify-between p-5 font-heading text-base font-bold text-[var(--ink)]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--amber-100)] text-[var(--amber-700)]">
                  <Icon name="handshake" size={20} />
                </div>
                {t("demandsSection")}
                <span className="ml-2 rounded-full bg-[var(--amber-100)] px-2.5 py-0.5 text-xs font-bold text-[var(--amber-700)]">
                  {demandFilter === "all" ? data.demands.length : `${filteredDemands.length}/${data.demands.length}`}
                </span>
              </div>
              <Icon name="chevronDown" size={20} className="text-[var(--ink-soft)] transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-[var(--line)] p-5">
              <StatusFilterPills value={demandFilter} onChange={setDemandFilter} options={demandStatuses} allLabel={t("filterAll")} />
              {data.demands.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <Icon name="handshake" size={28} className="text-[var(--amber-300)]" />
                  <p className="text-sm text-[var(--ink-soft)]">{t("noDemands")}</p>
                </div>
              ) : filteredDemands.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--ink-soft)]">{t("noneMatchFilter")}</p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {filteredDemands.map((d) => (
                    <li key={d.id} className="flex flex-col gap-2 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[var(--ink)]">{d.crop}</span>
                        <span className="rounded-full bg-[var(--line)] px-2.5 py-1 text-xs font-bold text-[var(--ink-soft)] capitalize">
                          {d.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-medium text-[var(--ink-soft)]">
                        <span className="flex items-center gap-1"><Icon name="chart" size={14} className="text-[var(--green-600)]" /> {d.quantity_kg} kg</span>
                        <span className="flex items-center gap-1"><Icon name="pin" size={14} className="text-[var(--amber-600)]" /> ₹{d.price_band_min} - ₹{d.price_band_max}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>
          )}

          {/* Deals */}
          <details className="group rounded-2xl border border-[var(--line)] bg-white shadow-sm transition-all" open>
            <summary className="flex cursor-pointer list-none items-center justify-between p-5 font-heading text-base font-bold text-[var(--ink)]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--green-700)] text-white">
                  <Icon name="connection" size={20} />
                </div>
                {t("dealsSection")}
                <span className="ml-2 rounded-full bg-[var(--green-100)] px-2.5 py-0.5 text-xs font-bold text-[var(--green-700)]">
                  {dealFilter === "all" ? data.deals.length : `${filteredDeals.length}/${data.deals.length}`}
                </span>
              </div>
              <Icon name="chevronDown" size={20} className="text-[var(--ink-soft)] transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-[var(--line)] p-5">
              <StatusFilterPills value={dealFilter} onChange={setDealFilter} options={dealStatuses} labels={dealStageLabels} allLabel={t("filterAll")} />
              {data.deals.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <Icon name="connection" size={28} className="text-[var(--green-300)]" />
                  <p className="text-sm text-[var(--ink-soft)]">{t("noDeals")}</p>
                </div>
              ) : filteredDeals.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--ink-soft)]">{t("noneMatchFilter")}</p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {filteredDeals.map((deal) => (
                    <li key={deal.id} className="flex flex-col gap-3 rounded-xl border border-[var(--green-600)] bg-[var(--green-50)] p-4">
                      <div className="flex items-center justify-between border-b border-[var(--green-200)] pb-2">
                        <span className="font-bold text-[var(--green-900)]">{deal.lot.crop}</span>
                        <span className="rounded-full bg-[var(--green-200)] px-2.5 py-1 text-xs font-bold text-[var(--green-800)] capitalize">
                          {dealStageLabels[deal.pipeline_status] ?? deal.pipeline_status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span className="flex flex-col text-[var(--green-800)]">
                          <span className="text-[10px] uppercase tracking-wider opacity-70">{tdeals("agreedPrice")}</span>
                          ₹{deal.agreed_price}/qtl
                        </span>
                        <span className="flex flex-col text-right text-[var(--green-800)]">
                          <span className="text-[10px] uppercase tracking-wider opacity-70">{tdeals("agreedQty")}</span>
                          {deal.agreed_quantity} kg
                        </span>
                      </div>
                      <Link 
                        href={`/deals/${deal.id}`} 
                        className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-[var(--green-700)] py-2 text-xs font-bold text-white transition hover:bg-[var(--green-800)]"
                      >
                        {t("viewDeal")} <Icon name="chevronDown" size={14} className="-rotate-90" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

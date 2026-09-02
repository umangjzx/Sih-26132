"use client";

/**
 * Deal detail page (Phase 3).
 *
 * DEAL-02:    6-stage pipeline stepper + "advance to next stage" button (either party).
 * DISPUTE-01: list existing disputes + raise-dispute form (blocked while one is open).
 *
 * Client component (Cordova constraint). Reads the [id] segment via useParams().
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/AuthProvider";
import { PageHeader } from "@/components/PageHeader";
import { Icon } from "@/components/ui";
import {
  advanceDeal,
  getDealById,
  getDealDisputes,
  getDealLogistics,
  raiseDisputeOnDeal,
  saveDealLogistics,
  type DealDetailResponse,
  type DealLogistics,
  type DisputeResponse,
} from "@/lib/api";
import { DealLogisticsCard } from "@/components/DealLogisticsCard";
import { DealTransactionPanel } from "@/components/DealTransactionPanel";

const STAGES = [
  "matched",
  "offer_accepted",
  "logistics_arranged",
  "delivered",
  "paid",
  "closed",
] as const;

export default function DealDetailPage() {
  const { token, isAuthenticated, ready, user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const dealId = String(params.id);
  const t = useTranslations("deals");
  const tp = useTranslations("disputes");

  const stageLabel: Record<(typeof STAGES)[number], string> = {
    matched: t("pipeline_matched"),
    offer_accepted: t("pipeline_offer_accepted"),
    logistics_arranged: t("pipeline_logistics_arranged"),
    delivered: t("pipeline_delivered"),
    paid: t("pipeline_paid"),
    closed: t("pipeline_closed"),
  };
  const logisticsLabel: Record<string, string> = {
    self_pickup: t("logistics_self_pickup"),
    platform_arranged: t("logistics_platform_arranged"),
  };
  const paymentLabel: Record<string, string> = {
    pending: t("payment_pending"),
    paid: t("payment_paid"),
  };
  const disputeStatusLabel: Record<string, string> = {
    open: tp("status_open"),
    closed: tp("status_closed"),
  };

  const [deal, setDeal] = useState<DealDetailResponse | null>(null);
  const [disputes, setDisputes] = useState<DisputeResponse[]>([]);
  const [reason, setReason] = useState("");
  const [payMethod, setPayMethod] = useState("UPI");
  const [payRef, setPayRef] = useState("");
  const [advancing, setAdvancing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !isAuthenticated) router.replace("/login");
  }, [ready, isAuthenticated, router]);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const [d, ds] = await Promise.all([
        getDealById(dealId, token),
        getDealDisputes(dealId, token),
      ]);
      setDeal(d);
      setDisputes(ds);
    } catch {
      setError(t("loadError"));
    }
  }, [dealId, token, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdvance() {
    if (!token || !deal || deal.pipeline_status === "closed") return;
    // irreversible steps get a confirm — you can't un-confirm delivery/payment
    if (nextStage === "delivered" || nextStage === "paid" || nextStage === "closed") {
      const label = stageLabel[nextStage as (typeof STAGES)[number]];
      if (!window.confirm(t("confirmAdvance", { stage: label }))) return;
    }
    setAdvancing(true);
    setError(null);
    try {
      const body =
        nextStage === "paid"
          ? { payment_method: payMethod, payment_reference: payRef.trim() }
          : {};
      const updated = await advanceDeal(dealId, token, body);
      setDeal(updated);
      setToast(
        t("advanceSuccess", { stage: stageLabel[updated.pipeline_status as (typeof STAGES)[number]] }),
      );
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(msg.includes("403") ? t("advanceForbidden") : msg.includes("422") ? t("advanceNeedRef") : t("loadError"));
    } finally {
      setAdvancing(false);
    }
  }

  async function handleRaise(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !reason.trim()) return;
    setSubmitting(true);
    try {
      await raiseDisputeOnDeal(dealId, { reason: reason.trim() }, token);
      setReason("");
      setToast(tp("success"));
      setTimeout(() => setToast(null), 3000);
      await load();
    } catch {
      setToast(tp("duplicateError"));
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready || !isAuthenticated) return null;
  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-2xl border border-[var(--red-600)]/30 bg-[var(--red-100)] px-5 py-4 text-sm font-bold text-[var(--red-700)]">
          {error}
        </p>
        <Link href="/history" className="text-sm font-semibold text-[var(--green-700)] hover:underline">
          {t("backToHistory")}
        </Link>
      </div>
    );
  }
  
  if (!deal) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-24 w-full animate-pulse rounded-2xl bg-white/50" />
        <div className="h-64 w-full animate-pulse rounded-2xl bg-white/50" />
      </div>
    );
  }

  const currentIdx = STAGES.indexOf(deal.pipeline_status as (typeof STAGES)[number]);
  const nextStage = currentIdx >= 0 && currentIdx < STAGES.length - 1 ? STAGES[currentIdx + 1] : null;
  // who advances INTO the next stage: seller confirms "delivered", buyer records "paid"
  const nextActor: "farmer" | "buyer" | "any" =
    nextStage === "delivered" ? "farmer" : nextStage === "paid" ? "buyer" : "any";
  const viewerCanAdvance =
    user?.role === "admin" || nextActor === "any" || user?.role === nextActor;
  const needsRef = nextStage === "paid" && user?.role !== "admin";
  const hasOpenDispute = disputes.some((d) => d.status === "open");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon="handshake"
        title={t("dealTitle")}
        subtitle={t("dealSubtitle", { crop: deal.lot.crop })}
      />
      
      {toast && (
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--green-600)]/30 bg-[var(--green-100)] px-5 py-4 text-sm font-bold text-[var(--green-700)]">
          <Icon name="check" size={18} />
          {toast}
        </div>
      )}

      {/* Header Info */}
      <section className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3 border-b border-[var(--line)] pb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--green-700)] text-white">
            <Icon name="leaf" size={24} />
          </div>
          <div>
            <h1 className="font-heading text-lg font-extrabold text-[var(--ink)]">{deal.lot.crop}</h1>
            <p className="text-xs text-[var(--ink-soft)]">Deal ID: #{deal.id}</p>
          </div>
        </div>
        
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-4">
          <div className="flex flex-col gap-1">
            <dt className="text-[10px] font-bold uppercase tracking-widest text-[var(--ink-soft)]">{t("agreedPrice")}</dt>
            <dd className="font-bold text-[var(--ink)]">₹{deal.agreed_price}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-[10px] font-bold uppercase tracking-widest text-[var(--ink-soft)]">{t("agreedQty")}</dt>
            <dd className="font-bold text-[var(--ink)]">{deal.agreed_quantity} kg</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-[10px] font-bold uppercase tracking-widest text-[var(--ink-soft)]">{t("logistics")}</dt>
            <dd className="font-bold text-[var(--ink)]">{logisticsLabel[deal.logistics_mode] ?? deal.logistics_mode}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-[10px] font-bold uppercase tracking-widest text-[var(--ink-soft)]">{t("paymentStatus")}</dt>
            <dd>
              <span
                className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${
                  deal.payment_status === "paid"
                    ? "bg-[var(--green-100)] text-[var(--green-700)]"
                    : "bg-[var(--amber-100)] text-[var(--amber-700)]"
                }`}
              >
                {paymentLabel[deal.payment_status] ?? deal.payment_status}
              </span>
            </dd>
          </div>
        </dl>
      </section>

      {/* Pipeline stepper */}
      <section className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
        <h2 className="mb-5 flex items-center gap-2 font-heading text-base font-bold text-[var(--ink)]">
          <Icon name="connection" size={18} className="text-[var(--green-600)]" /> {t("pipeline")}
        </h2>
        
        <ol className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-2" aria-label={t("pipeline")}>
          {STAGES.map((stage, i) => {
            const state = i < currentIdx ? "done" : i === currentIdx ? "current" : "future";
            
            return (
              <li
                key={stage}
                data-state={state}
                aria-current={state === "current" ? "step" : undefined}
                className="flex items-center gap-2 sm:flex-1 sm:flex-col sm:items-start"
              >
                <div 
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    state === "done"
                      ? "bg-[var(--green-600)] text-white"
                      : state === "current"
                        ? "border-2 border-[var(--green-600)] bg-[var(--green-50)] text-[var(--green-700)]"
                        : "bg-[var(--line)] text-[var(--ink-soft)]"
                  }`}
                >
                  {state === "done" ? <Icon name="check" size={14} /> : i + 1}
                </div>
                <span className={`text-xs font-bold ${
                  state === "done" ? "text-[var(--ink)]" : state === "current" ? "text-[var(--green-700)]" : "text-[var(--ink-soft)]"
                }`}>
                  {stageLabel[stage]}
                </span>
              </li>
            );
          })}
        </ol>
        
        <div className="mt-8 border-t border-[var(--line)] pt-5">
          {nextStage && (
            <p className="mb-3 text-xs font-medium text-[var(--ink-soft)]">
              {t("nextStep", { stage: stageLabel[nextStage] })}
              {nextActor !== "any" && ` · ${t(nextActor === "farmer" ? "actorSeller" : "actorBuyer")}`}
            </p>
          )}

          {needsRef && viewerCanAdvance && deal.pipeline_status !== "closed" && (
            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm"
              >
                <option>UPI</option>
                <option>Bank transfer (NEFT/RTGS)</option>
                <option>Cash</option>
                <option>Cheque</option>
              </select>
              <input
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                placeholder={t("payRefPh")}
                className="rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm"
              />
            </div>
          )}

          <button
            type="button"
            onClick={handleAdvance}
            disabled={
              advancing ||
              deal.pipeline_status === "closed" ||
              !viewerCanAdvance ||
              (needsRef && !payRef.trim())
            }
            className="flex items-center justify-center gap-2 rounded-xl bg-[var(--green-700)] px-6 py-3 text-sm font-bold text-white shadow-md shadow-green-900/20 transition hover:bg-[var(--green-900)] disabled:opacity-60"
          >
            {deal.pipeline_status === "closed"
              ? t("alreadyClosed")
              : !viewerCanAdvance
                ? t(nextActor === "farmer" ? "waitingSeller" : "waitingBuyer")
                : advancing
                  ? t("advancing")
                  : nextStage === "paid"
                    ? t("markPaid")
                    : nextStage === "delivered"
                      ? t("confirmDelivered")
                      : t("advancePipeline")}
            {deal.pipeline_status !== "closed" && viewerCanAdvance && !advancing && (
              <Icon name="chevronDown" size={16} className="-rotate-90" />
            )}
          </button>

          {deal.payment_reference && (
            <p className="mt-3 text-xs text-[var(--ink-soft)]">
              {t("paymentRecorded", { method: deal.payment_method ?? "—", ref: deal.payment_reference })}
            </p>
          )}
        </div>
      </section>

      {/* Logistics plan */}
      {token && (
        <DealLogisticsCard
          dealId={deal.id}
          token={token}
          closed={deal.pipeline_status === "closed"}
        />
      )}

      {/* Payments + activity log */}
      {token && (
        <DealTransactionPanel
          dealId={deal.id}
          token={token}
          canPay={user?.role === "buyer"}
          agreedValue={(deal.agreed_price * deal.agreed_quantity) / 100}
        />
      )}

      {/* Disputes */}
      <section className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-6 shadow-sm">
        <h2 className="mb-5 flex items-center gap-2 font-heading text-base font-bold text-[var(--ink)]">
          <Icon name="shield" size={18} className="text-[var(--red-600)]" /> {tp("title")}
        </h2>
        
        {disputes.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--line)] py-6 text-center">
            <Icon name="shield" size={24} className="text-[var(--green-300)]" />
            <p className="text-sm font-medium text-[var(--ink-soft)]">{tp("noDisputes")}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {disputes.map((d) => (
              <li
                key={d.id}
                className="flex flex-col gap-2 rounded-xl border border-[var(--red-200)] bg-[var(--red-50)] p-4 text-sm shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[var(--red-900)]">Dispute #{d.id}</span>
                  <span
                    className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${
                      d.status === "open"
                        ? "bg-[var(--red-200)] text-[var(--red-900)]"
                        : "bg-[var(--line)] text-[var(--ink-soft)]"
                    }`}
                  >
                    {disputeStatusLabel[d.status] ?? d.status}
                  </span>
                </div>
                <p className="text-[var(--red-800)]">{d.reason}</p>
              </li>
            ))}
          </ul>
        )}

        {hasOpenDispute ? (
          <div className="mt-6 flex items-center gap-2 rounded-xl bg-[var(--amber-100)] px-4 py-3 text-sm font-bold text-[var(--amber-800)]">
            <Icon name="close" size={16} />
            {tp("duplicateError")}
          </div>
        ) : (
          <form onSubmit={handleRaise} className="mt-6 flex flex-col gap-3 rounded-xl border border-[var(--line)] bg-white p-5">
            <label className="flex flex-col gap-2 text-sm font-bold text-[var(--ink)]">
              {tp("reasonLabel")}
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={tp("reasonPlaceholder")}
                required
                rows={3}
                className="w-full rounded-xl border border-[var(--line)] p-3 text-sm font-normal focus:border-[var(--red-500)] focus:outline-none transition-colors"
              />
            </label>
            <button
              type="submit"
              disabled={submitting || !reason.trim()}
              className="mt-2 self-start rounded-xl bg-[var(--red-600)] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--red-700)] disabled:opacity-50"
            >
              {submitting ? tp("submitting") : tp("submit")}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

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
import {
  advanceDeal,
  getDealById,
  getDealDisputes,
  raiseDisputeOnDeal,
  type DealDetailResponse,
  type DisputeResponse,
} from "@/lib/api";

const STAGES = [
  "matched",
  "offer_accepted",
  "logistics_arranged",
  "delivered",
  "paid",
  "closed",
] as const;

export default function DealDetailPage() {
  const { token, isAuthenticated } = useAuth();
  const router = useRouter();
  const params = useParams();
  const dealId = String(params.id);
  const t = useTranslations("deals");
  const tp = useTranslations("disputes");

  // next-intl's typed catalogue rejects template-literal keys, so map explicitly.
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
  const [advancing, setAdvancing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) router.replace("/login");
  }, [isAuthenticated, router]);

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
    setAdvancing(true);
    try {
      const updated = await advanceDeal(dealId, token);
      setDeal(updated);
      setToast(
        t("advanceSuccess", { stage: stageLabel[updated.pipeline_status as (typeof STAGES)[number]] }),
      );
      setTimeout(() => setToast(null), 3000);
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

  if (!isAuthenticated) return null;
  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-md border border-[var(--color-wait)] bg-[var(--color-wait)]/10 px-4 py-3 text-sm text-[var(--color-wait)]">
          {error}
        </p>
        <Link href="/history" className="text-sm font-medium text-[var(--color-brand)] hover:underline">
          {t("backToHistory")}
        </Link>
      </div>
    );
  }
  if (!deal) return <p className="text-sm opacity-60">…</p>;

  const currentIdx = STAGES.indexOf(deal.pipeline_status as (typeof STAGES)[number]);
  const hasOpenDispute = disputes.some((d) => d.status === "open");

  return (
    <div className="flex flex-col gap-8">
      {toast && (
        <div className="rounded-md border border-[var(--color-sell)] bg-[var(--color-sell)]/10 px-4 py-3 text-sm text-[var(--color-sell)]">
          {toast}
        </div>
      )}

      {/* Header */}
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h1 className="text-lg font-semibold">{deal.lot.crop}</h1>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="opacity-60">{t("agreedPrice")}</dt>
            <dd className="font-semibold">₹{deal.agreed_price}</dd>
          </div>
          <div>
            <dt className="opacity-60">{t("agreedQty")}</dt>
            <dd className="font-semibold">{deal.agreed_quantity} kg</dd>
          </div>
          <div>
            <dt className="opacity-60">{t("logistics")}</dt>
            <dd className="font-semibold">{logisticsLabel[deal.logistics_mode] ?? deal.logistics_mode}</dd>
          </div>
          <div>
            <dt className="opacity-60">{t("paymentStatus")}</dt>
            <dd>
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                  deal.payment_status === "paid"
                    ? "bg-[var(--color-sell)]/10 text-[var(--color-sell)]"
                    : "bg-[var(--color-hold)]/10 text-[var(--color-hold)]"
                }`}
              >
                {paymentLabel[deal.payment_status] ?? deal.payment_status}
              </span>
            </dd>
          </div>
        </dl>
      </section>

      {/* Pipeline stepper */}
      <section>
        <h2 className="mb-3 text-sm font-semibold opacity-80">{t("pipeline")}</h2>
        <ol className="flex flex-wrap gap-2" aria-label={t("pipeline")}>
          {STAGES.map((stage, i) => {
            const state =
              i < currentIdx ? "done" : i === currentIdx ? "current" : "future";
            return (
              <li
                key={stage}
                data-state={state}
                aria-current={state === "current" ? "step" : undefined}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  state === "done"
                    ? "bg-[var(--color-sell)] text-white"
                    : state === "current"
                      ? "border-2 border-[var(--color-brand)] font-bold text-[var(--color-brand)]"
                      : "bg-[var(--color-border)] text-[var(--color-text)]/50"
                }`}
              >
                {stageLabel[stage]}
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          onClick={handleAdvance}
          disabled={advancing || deal.pipeline_status === "closed"}
          className="mt-4 min-h-11 rounded-md bg-[var(--color-brand)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--color-brand-dark)] disabled:opacity-50 transition-colors"
        >
          {deal.pipeline_status === "closed"
            ? t("alreadyClosed")
            : advancing
              ? t("advancing")
              : t("advancePipeline")}
        </button>
      </section>

      {/* Disputes */}
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h2 className="mb-3 text-sm font-semibold opacity-80">{tp("title")}</h2>
        {disputes.length === 0 ? (
          <p className="text-sm opacity-60">{tp("noDisputes")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {disputes.map((d) => (
              <li
                key={d.id}
                className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
              >
                <span
                  className={`mr-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                    d.status === "open"
                      ? "bg-[var(--color-hold)]/15 text-[var(--color-hold)]"
                      : "bg-[var(--color-border)] text-[var(--color-text)]/60"
                  }`}
                >
                  {disputeStatusLabel[d.status] ?? d.status}
                </span>
                {d.reason}
              </li>
            ))}
          </ul>
        )}

        {hasOpenDispute ? (
          <p className="mt-4 text-sm text-[var(--color-hold)]">{tp("duplicateError")}</p>
        ) : (
          <form onSubmit={handleRaise} className="mt-4 flex flex-col gap-2">
            <label className="text-sm font-medium">
              {tp("reasonLabel")}
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={tp("reasonPlaceholder")}
                required
                rows={3}
                className="mt-1 w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={submitting || !reason.trim()}
              className="min-h-11 self-start rounded-md bg-[var(--color-wait)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {submitting ? tp("submitting") : tp("submit")}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

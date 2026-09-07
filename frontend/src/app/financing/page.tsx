"use client";

/**
 * Warehouse-receipt-backed financing requests (v1.17) — farmer view.
 * Pledge an open, unsold lot as collateral; an admin approves/rejects.
 * No real money moves — this only tracks the request and its outcome.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/AuthProvider";
import { PageHeader } from "@/components/PageHeader";
import { Icon } from "@/components/ui";
import {
  ApiError,
  createFinancingRequest,
  listMyFinancingRequests,
  listMyLots,
  withdrawFinancingRequest,
  type FinancingRequest,
  type LotResponse,
} from "@/lib/api";
import { formatInrExact } from "@/lib/format";

const _LOAN_TO_VALUE = 0.75;

function maxEligible(lot: LotResponse): number {
  return Math.round((lot.expected_price / 100) * lot.quantity_kg * _LOAN_TO_VALUE);
}

function StatusBadge({ status }: { status: FinancingRequest["status"] }) {
  const t = useTranslations("financing");
  const cls =
    status === "approved"
      ? "bg-[var(--green-100)] text-[var(--green-700)]"
      : status === "rejected"
        ? "bg-[var(--red-100)] text-[var(--red-700)]"
        : status === "withdrawn"
          ? "bg-[var(--line)] text-[var(--ink-soft)]"
          : "bg-[var(--amber-100)] text-[var(--amber-700)]";
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${cls}`}>
      {t(`status_${status}` as "status_pending")}
    </span>
  );
}

function RequestRow({ req, onWithdraw }: { req: FinancingRequest; onWithdraw: (id: number) => void }) {
  const t = useTranslations("financing");
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-heading text-base font-bold text-[var(--ink)]">
            {req.crop} · {formatInrExact(req.requested_amount_inr)}
          </div>
          <div className="mt-0.5 text-xs font-medium text-[var(--ink-soft)]">
            {req.warehouse_name || t("noWarehouse")}
            {req.receipt_ref ? ` · ${req.receipt_ref}` : ""}
          </div>
        </div>
        <StatusBadge status={req.status} />
      </div>
      {req.note && <p className="text-xs text-[var(--ink-soft)]">{req.note}</p>}
      {req.status === "rejected" && req.admin_note && (
        <p className="rounded-lg bg-[var(--red-100)] px-3 py-2 text-xs font-medium text-[var(--red-700)]">
          {t("adminNote")}: {req.admin_note}
        </p>
      )}
      {req.status === "approved" && req.admin_note && (
        <p className="rounded-lg bg-[var(--green-100)] px-3 py-2 text-xs font-medium text-[var(--green-700)]">
          {t("adminNote")}: {req.admin_note}
        </p>
      )}
      <div className="flex items-center justify-between text-xs font-medium text-[var(--ink-soft)]">
        <span>{t("eligibleUpTo", { amount: Math.round(req.max_eligible_inr).toLocaleString("en-IN") })}</span>
        {req.status === "pending" && (
          <button
            type="button"
            onClick={() => onWithdraw(req.id)}
            className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-bold text-[var(--ink-soft)] transition hover:bg-[var(--paper)]"
          >
            {t("withdraw")}
          </button>
        )}
      </div>
    </div>
  );
}

export default function FinancingPage() {
  const { isAuthenticated, ready, user, token } = useAuth();
  const router = useRouter();
  const t = useTranslations("financing");
  const tc = useTranslations("common");

  const [lots, setLots] = useState<LotResponse[]>([]);
  const [requests, setRequests] = useState<FinancingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [lotId, setLotId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [warehouseName, setWarehouseName] = useState("");
  const [receiptRef, setReceiptRef] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (ready && (!isAuthenticated || user?.role !== "farmer")) router.replace("/login");
  }, [ready, isAuthenticated, user, router]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoadErr(false);
    try {
      const [l, r] = await Promise.all([listMyLots(token), listMyFinancingRequests(token)]);
      setLots(l);
      setRequests(r);
    } catch {
      setLoadErr(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const pledgedLotIds = useMemo(
    () => new Set(requests.filter((r) => r.status === "pending" || r.status === "approved").map((r) => r.lot_id)),
    [requests],
  );
  const eligibleLots = useMemo(
    () => lots.filter((l) => l.status === "open" && !pledgedLotIds.has(l.id)),
    [lots, pledgedLotIds],
  );
  const selectedLot = eligibleLots.find((l) => String(l.id) === lotId) ?? null;
  const cap = selectedLot ? maxEligible(selectedLot) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !selectedLot) return;
    setSubmitting(true);
    try {
      await createFinancingRequest(
        {
          lot_id: selectedLot.id,
          requested_amount_inr: parseFloat(amount),
          warehouse_name: warehouseName.trim() || null,
          receipt_ref: receiptRef.trim() || null,
          note: note.trim() || null,
        },
        token,
      );
      setLotId("");
      setAmount("");
      setWarehouseName("");
      setReceiptRef("");
      setNote("");
      setShowForm(false);
      setToast(t("submitted"));
      setTimeout(() => setToast(null), 2500);
      load();
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : t("submitFailed"));
      setTimeout(() => setToast(null), 4500);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleWithdraw(id: number) {
    if (!token) return;
    try {
      await withdrawFinancingRequest(id, token);
      load();
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : t("submitFailed"));
      setTimeout(() => setToast(null), 4500);
    }
  }

  if (!ready || !isAuthenticated) return null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon="warehouse" title={t("title")} subtitle={t("subtitle")} />

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] px-5 py-4 text-xs font-medium text-[var(--ink-soft)]">
        <Icon name="shield" size={14} className="mr-1.5 inline-block align-text-bottom" />
        {t("disclaimer")}
      </div>

      <Link
        href="/directory"
        className="flex items-center gap-3 rounded-2xl border border-dashed border-[var(--line)] bg-white px-5 py-3.5 text-sm font-semibold text-[var(--green-700)] transition hover:border-[var(--green-600)] hover:bg-[var(--green-50)]"
      >
        <Icon name="warehouse" size={16} className="shrink-0" />
        {t("findWarehouse")}
        <Icon name="chevronLeft" size={14} className="ml-auto rotate-180" />
      </Link>

      {toast && (
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--green-600)]/30 bg-[var(--green-100)] px-5 py-4 text-sm font-bold text-[var(--green-700)]">
          <Icon name="check" size={18} />
          {toast}
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          disabled={!loading && eligibleLots.length === 0 && !showForm}
          className="flex items-center gap-2 rounded-xl bg-[var(--green-700)] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-green-900/20 transition hover:bg-[var(--green-900)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name={showForm ? "close" : "warehouse"} size={16} />
          {showForm ? t("cancel") : t("newRequest")}
        </button>
        {!loading && eligibleLots.length === 0 && !showForm && (
          <p className="mt-2 text-xs font-medium text-[var(--ink-soft)]">{t("noEligibleLots")}</p>
        )}
      </div>

      {showForm && (
        <section className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-heading text-base font-bold text-[var(--ink)]">{t("newRequest")}</h2>
          <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--ink)] sm:col-span-2">
              {t("lot")}
              <select
                required
                value={lotId}
                onChange={(e) => setLotId(e.target.value)}
                className="rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm font-normal focus:border-[var(--green-600)] focus:outline-none"
              >
                <option value="" disabled>{t("selectLot")}</option>
                {eligibleLots.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.crop} · {Math.round(l.quantity_kg)} kg · {t("grade")} {l.quality_grade}
                  </option>
                ))}
              </select>
              {cap != null && (
                <span className="text-xs font-normal text-[var(--ink-soft)]">
                  {t("eligibleUpTo", { amount: cap.toLocaleString("en-IN") })}
                </span>
              )}
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--ink)]">
              {t("amount")}
              <input
                required
                type="number"
                min="1"
                max={cap ?? undefined}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm font-normal focus:border-[var(--green-600)] focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--ink)]">
              {t("warehouseName")}
              <input
                value={warehouseName}
                onChange={(e) => setWarehouseName(e.target.value)}
                className="rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm font-normal focus:border-[var(--green-600)] focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--ink)]">
              {t("receiptRef")}
              <input
                value={receiptRef}
                onChange={(e) => setReceiptRef(e.target.value)}
                className="rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm font-normal focus:border-[var(--green-600)] focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--ink)]">
              {t("note")}
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm font-normal focus:border-[var(--green-600)] focus:outline-none"
              />
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={submitting || !selectedLot}
                className="flex items-center gap-2 rounded-xl bg-[var(--green-700)] px-6 py-3 font-bold text-white shadow-md shadow-green-900/20 transition hover:bg-[var(--green-900)] disabled:opacity-60"
              >
                <Icon name="warehouse" size={18} />
                {submitting ? t("submitting") : t("submit")}
              </button>
            </div>
          </form>
        </section>
      )}

      {loading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 w-full animate-pulse rounded-2xl bg-white/50" />)}
        </div>
      ) : loadErr ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--red-600)]/25 bg-[var(--red-100)] py-10 text-center">
          <Icon name="close" size={26} className="text-[var(--red-600)]" />
          <p className="text-sm font-semibold text-[var(--red-700)]">{tc("error")}</p>
          <button
            type="button"
            onClick={() => { setLoading(true); load(); }}
            className="rounded-lg border border-[var(--red-500)]/40 bg-white px-4 py-1.5 text-xs font-bold text-[var(--red-700)]"
          >
            {tc("retry")}
          </button>
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--paper)] py-12 text-center">
          <Icon name="warehouse" size={30} className="text-[var(--green-300)]" />
          <p className="text-sm font-medium text-[var(--ink-soft)]">{t("noRequests")}</p>
        </div>
      ) : (
        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-[var(--ink-soft)]">{t("myRequests")}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {requests.map((r) => <RequestRow key={r.id} req={r} onWithdraw={handleWithdraw} />)}
          </div>
        </section>
      )}
    </div>
  );
}

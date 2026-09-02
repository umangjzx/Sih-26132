"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Icon } from "@/components/ui";
import {
  getDealEvents,
  getDealPayments,
  openDealReceipt,
  recordPayment,
  type DealEvent,
  type DealPayment,
} from "@/lib/api";

const METHODS = ["UPI", "NEFT", "RTGS", "IMPS", "Cheque", "Cash", "Other"];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function DealTransactionPanel({
  dealId,
  token,
  canPay,
  agreedValue,
}: {
  dealId: number | string;
  token: string;
  canPay: boolean;
  agreedValue: number;
}) {
  const t = useTranslations("deals");
  const [payments, setPayments] = useState<DealPayment[]>([]);
  const [events, setEvents] = useState<DealEvent[]>([]);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("UPI");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, e] = await Promise.all([
        getDealPayments(dealId, token),
        getDealEvents(dealId, token),
      ]);
      setPayments(p);
      setEvents(e);
    } catch {
      /* non-fatal */
    }
  }, [dealId, token]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPaid = payments.reduce((s, p) => s + p.amount_inr, 0);
  const outstanding = Math.max(0, agreedValue - totalPaid);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    setBusy(true);
    setErr(null);
    try {
      await recordPayment(dealId, { amount_inr: amt, method, reference: reference.trim() || null }, token);
      setAmount("");
      setReference("");
      await load();
    } catch (e2) {
      const m = e2 instanceof Error ? e2.message : "";
      setErr(m.includes("403") ? t("buyerOnlyPay") : t("loadError"));
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "rounded-lg border border-[var(--line)] px-2.5 py-2 text-sm focus:border-[var(--green-600)] focus:outline-none";

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-heading text-base font-bold text-[var(--ink)]">
          <Icon name="coins" size={18} className="text-[var(--green-700)]" /> {t("payments")}
        </h2>
        <button
          type="button"
          onClick={() => openDealReceipt(dealId, token).catch(() => {})}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-bold text-[var(--ink-soft)] hover:bg-[var(--paper)]"
        >
          <Icon name="chart" size={13} /> {t("viewReceipt")}
        </button>
      </div>

      {/* totals */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        {[
          [t("totalPaid"), `₹${Math.round(totalPaid).toLocaleString()}`, "text-[var(--green-700)]"],
          [t("outstanding"), `₹${Math.round(outstanding).toLocaleString()}`, outstanding > 0 ? "text-[var(--amber-700)]" : "text-[var(--ink-soft)]"],
          [t("agreedPrice"), `₹${Math.round(agreedValue).toLocaleString()}`, "text-[var(--ink)]"],
        ].map(([label, value, cls]) => (
          <div key={label} className="rounded-xl bg-[var(--paper)] p-3 text-center">
            <div className={`font-heading text-lg font-bold ${cls}`}>{value}</div>
            <div className="text-[11px] font-medium text-[var(--ink-soft)]">{label}</div>
          </div>
        ))}
      </div>

      {outstanding === 0 && payments.length > 0 && (
        <p className="mb-3 flex items-center gap-1.5 text-sm font-bold text-[var(--green-700)]">
          <Icon name="check" size={15} /> {t("paidInFull")}
        </p>
      )}

      {/* payment list */}
      {payments.length === 0 ? (
        <p className="mb-4 text-sm text-[var(--ink-soft)]">{t("noPayments")}</p>
      ) : (
        <ul className="mb-4 flex flex-col gap-1.5">
          {payments.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--paper)] px-3 py-2 text-sm">
              <span className="font-bold text-[var(--ink)]">₹{Math.round(p.amount_inr).toLocaleString()}</span>
              <span className="text-xs text-[var(--ink-soft)]">
                {p.method}
                {p.reference ? ` · ${p.reference}` : ""} · {fmtDate(p.paid_at)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* record form (buyer only) */}
      {canPay && (
        <form onSubmit={submit} className="grid grid-cols-1 gap-2 border-t border-[var(--line)] pt-4 sm:grid-cols-4">
          <input
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={t("amount")}
            className={inputCls}
          />
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls}>
            {METHODS.map((m) => <option key={m}>{m}</option>)}
          </select>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder={t("reference")}
            className={inputCls}
          />
          <button
            type="submit"
            disabled={busy || !amount}
            className="rounded-lg bg-[var(--green-700)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--green-900)] disabled:opacity-60"
          >
            {t("record")}
          </button>
          {err && <p className="text-xs font-semibold text-[var(--color-wait)] sm:col-span-4">{err}</p>}
        </form>
      )}

      {/* audit timeline */}
      <div className="mt-6 border-t border-[var(--line)] pt-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
          <Icon name="clock" size={15} className="text-[var(--ink-soft)]" /> {t("timeline")}
        </h3>
        {events.length === 0 ? (
          <p className="text-xs text-[var(--ink-soft)]">{t("noEvents")}</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {events.map((ev) => {
              const key = `evt_${ev.action}` as "evt_payment_recorded";
              let label = t(key);
              if (label === key) label = ev.action.replace(/_/g, " ");
              return (
                <li key={ev.id} className="flex items-start gap-2 text-xs">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--green-500)]" />
                  <span className="text-[var(--ink)]">
                    <span className="font-semibold">{label}</span>
                    {typeof ev.detail?.amount_inr === "number" && (
                      <span className="text-[var(--ink-soft)]"> · ₹{Math.round(ev.detail.amount_inr as number).toLocaleString()}</span>
                    )}
                    {typeof ev.detail?.reference === "string" && ev.detail.reference && (
                      <span className="text-[var(--ink-soft)]"> · {ev.detail.reference as string}</span>
                    )}
                    <span className="ml-1 text-[var(--ink-soft)]">— {fmtDate(ev.created_at)}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}

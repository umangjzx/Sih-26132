"use client";

/** Admin — full financing-request history. Admin only.
 *
 * Promoted out of the dashboard's embedded pending-only panel, the same way
 * Disputes was — filterable by status, reusing the exact review action
 * (PATCH /api/financing/requests/{id}) the dashboard's panel already called.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/AuthProvider";
import { SkeletonTableRows } from "@/components/ui";
import {
  ApiError,
  listAllFinancingRequests,
  reviewFinancingRequest,
  type FinancingRequest,
} from "@/lib/api";
import { formatInrExact } from "@/lib/format";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-[var(--color-wait)]/15 text-[var(--color-wait)]",
  approved: "bg-[var(--color-sell)]/15 text-[var(--color-sell)]",
  rejected: "bg-[var(--color-border)] opacity-70",
  withdrawn: "bg-[var(--color-border)] opacity-70",
};

function FinancingHistoryRow({
  r,
  token,
  onResolved,
}: {
  r: FinancingRequest;
  token: string | null;
  onResolved: () => void;
}) {
  const t = useTranslations("admin");
  const tf = useTranslations("financing");
  const [open, setOpen] = useState(false);
  const [decision, setDecision] = useState<"approved" | "rejected" | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!token || !decision) return;
    setBusy(true);
    setErr(null);
    try {
      await reviewFinancingRequest(r.id, { status: decision, admin_note: note.trim() || undefined }, token);
      setOpen(false);
      onResolved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t("loadError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <tr className="border-b border-[var(--color-border)] last:border-0">
        <td className="px-3 py-2 align-top">
          <span className="font-semibold">{r.farmer_name}</span>
          <span className="opacity-55"> · {r.crop}</span>
        </td>
        <td className="px-3 py-2 align-top">{formatInrExact(r.requested_amount_inr)}</td>
        <td className="px-3 py-2 align-top opacity-60">{formatInrExact(r.max_eligible_inr)}</td>
        <td className="px-3 py-2 align-top opacity-60">{r.created_at.slice(0, 10)}</td>
        <td className="px-3 py-2 align-top">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLE[r.status] ?? STATUS_STYLE.withdrawn}`}>
            {tf(`status_${r.status}` as "status_pending")}
          </span>
          {r.admin_note && <div className="mt-1 text-xs opacity-70">{r.admin_note}</div>}
        </td>
        <td className="px-3 py-2 text-right align-top">
          <div className="flex items-center justify-end gap-2">
            {r.deal_id && (
              <Link
                href={`/deals/${r.deal_id}`}
                className="rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs font-semibold text-[var(--green-700)] hover:bg-[var(--color-border)]/30"
              >
                {tf("viewDeal")}
              </Link>
            )}
            {r.status === "pending" && (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs font-semibold hover:bg-[var(--color-border)]/30"
              >
                {open ? t("resolveCancel") : t("resolveAction")}
              </button>
            )}
          </div>
        </td>
      </tr>
      {open && (
        <tr className="border-b border-[var(--color-border)]">
          <td colSpan={6} className="px-3 py-3">
            <div className="flex flex-col gap-2 rounded-xl bg-[var(--color-border)]/15 p-3">
              {(r.warehouse_name || r.receipt_ref) && (
                <p className="text-xs opacity-70">
                  {r.warehouse_name}
                  {r.receipt_ref ? ` · ${r.receipt_ref}` : ""}
                </p>
              )}
              {r.note && <p className="text-xs opacity-70">{r.note}</p>}
              <label className="flex flex-col gap-1 text-xs font-semibold">
                {t("resolveOutcome")}
                <select
                  value={decision}
                  onChange={(e) => setDecision(e.target.value as "approved" | "rejected")}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm"
                >
                  <option value="" disabled>{t("resolveOutcomeChoose")}</option>
                  <option value="approved">{tf("status_approved")}</option>
                  <option value="rejected">{tf("status_rejected")}</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold">
                {t("resolveNote")}
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  maxLength={1000}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm font-normal"
                />
              </label>
              {err && <p className="text-xs font-semibold text-[var(--color-wait)]">{err}</p>}
              <button
                type="button"
                onClick={submit}
                disabled={busy || !decision}
                className="self-start rounded-lg bg-[var(--color-brand)] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
              >
                {t("resolveConfirm")}
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function AdminFinancingPage() {
  const { user, token, ready, isAuthenticated } = useAuth();
  const router = useRouter();
  const t = useTranslations("adminFinancing");

  const [rows, setRows] = useState<FinancingRequest[]>([]);
  const [statusF, setStatusF] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated || user?.role !== "admin") router.replace("/login");
  }, [ready, isAuthenticated, user, router]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      setRows(await listAllFinancingRequests(token, statusF || undefined));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [token, statusF, t]);

  useEffect(() => { load(); }, [load]);

  if (!ready || !isAuthenticated || user?.role !== "admin") return null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin" className="text-sm font-semibold text-[var(--color-brand)] hover:underline">← {t("back")}</Link>
        <h1 className="font-serif text-lg font-bold">{t("title")}</h1>
      </div>

      {err && (
        <div className="rounded-lg border border-[var(--color-wait)]/40 bg-[var(--color-wait)]/10 px-4 py-2.5 text-sm font-semibold text-[var(--color-wait)]">
          {err}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm">
          <option value="">{t("allStatus")}</option>
          <option value="pending">{t("status_pending")}</option>
          <option value="approved">{t("status_approved")}</option>
          <option value="rejected">{t("status_rejected")}</option>
          <option value="withdrawn">{t("status_withdrawn")}</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg)] text-xs uppercase opacity-60">
            <tr>
              <th className="px-3 py-2 font-semibold">{t("farmer")}</th>
              <th className="px-3 py-2 font-semibold">{t("requested")}</th>
              <th className="px-3 py-2 font-semibold">{t("eligible")}</th>
              <th className="px-3 py-2 font-semibold">{t("date")}</th>
              <th className="px-3 py-2 font-semibold">{t("status")}</th>
              <th className="px-3 py-2 font-semibold text-right">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonTableRows colSpan={6} />
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center opacity-50">{t("none")}</td></tr>
            ) : (
              rows.map((r) => <FinancingHistoryRow key={r.id} r={r} token={token} onResolved={load} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

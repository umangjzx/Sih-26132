"use client";

/** Admin — full dispute history. Admin only.
 *
 * The dashboard's dispute queue only ever showed 'open' disputes — this adds
 * the resolved/withdrawn history, filterable by status, and reuses the exact
 * same resolve action (PATCH /api/disputes/{id}/close) the dashboard's inline
 * queue already calls.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/AuthProvider";
import { Icon, SkeletonTableRows } from "@/components/ui";
import {
  ApiError,
  DISPUTE_OUTCOMES,
  closeDispute,
  listAdminDisputes,
  type AdminDispute,
  type DisputeOutcome,
} from "@/lib/api";

const STATUS_STYLE: Record<string, string> = {
  open: "bg-[var(--color-wait)]/15 text-[var(--color-wait)]",
  resolved: "bg-[var(--color-sell)]/15 text-[var(--color-sell)]",
  withdrawn: "bg-[var(--color-border)] opacity-70",
};

function DisputeHistoryRow({
  d,
  token,
  onResolved,
}: {
  d: AdminDispute;
  token: string | null;
  onResolved: () => void;
}) {
  const t = useTranslations("admin");
  const td = useTranslations("disputes");
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<DisputeOutcome | "">("");
  const [note, setNote] = useState("");
  const [applyPenalty, setApplyPenalty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canApplyPenalty = d.is_forward && (outcome === "favour_farmer" || outcome === "favour_buyer");

  async function submit() {
    if (!token || !outcome) return;
    setBusy(true);
    setErr(null);
    try {
      await closeDispute(d.id, token, {
        outcome,
        resolution: note.trim() || undefined,
        apply_forward_penalty: canApplyPenalty && applyPenalty,
      });
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
          <Link href={`/deals/${d.deal_id}`} className="font-semibold text-[var(--color-brand)] hover:underline">
            #{d.deal_id}
          </Link>
        </td>
        <td className="px-3 py-2 align-top">{d.reason.length > 48 ? `${d.reason.slice(0, 48)}…` : d.reason}</td>
        <td className="px-3 py-2 align-top">{d.raised_by_name}</td>
        <td className="px-3 py-2 align-top opacity-60">{d.created_at.slice(0, 10)}</td>
        <td className="px-3 py-2 align-top">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLE[d.status] ?? STATUS_STYLE.withdrawn}`}>
            {td(`status_${d.status}` as "status_open")}
          </span>
          {d.outcome && (
            <div className="mt-1 text-xs opacity-70">{td(`outcome_${d.outcome}` as "outcome_dismissed")}</div>
          )}
        </td>
        <td className="px-3 py-2 text-right align-top">
          {d.status === "open" ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs font-semibold hover:bg-[var(--color-border)]/30"
            >
              {open ? t("resolveCancel") : t("resolveAction")}
            </button>
          ) : (
            d.resolved_by_name && <span className="text-xs opacity-60">{td("resolvedByAdmin")}: {d.resolved_by_name}</span>
          )}
        </td>
      </tr>
      {open && (
        <tr className="border-b border-[var(--color-border)]">
          <td colSpan={6} className="px-3 py-3">
            <div className="flex flex-col gap-2 rounded-xl bg-[var(--color-border)]/15 p-3">
              {d.resolution && <p className="text-xs opacity-70">{d.resolution}</p>}
              <label className="flex flex-col gap-1 text-xs font-semibold">
                {t("resolveOutcome")}
                <select
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value as DisputeOutcome)}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm"
                >
                  <option value="" disabled>{t("resolveOutcomeChoose")}</option>
                  {DISPUTE_OUTCOMES.map((o) => (
                    <option key={o} value={o}>{td(`outcome_${o}` as "outcome_dismissed")}</option>
                  ))}
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
              {d.is_forward && (
                <label
                  className={`flex items-center gap-2 rounded-lg border border-dashed px-2 py-1.5 text-xs font-semibold ${
                    canApplyPenalty
                      ? "border-[var(--color-wait)] text-[var(--color-wait)]"
                      : "border-[var(--color-border)] opacity-60"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={applyPenalty}
                    disabled={!canApplyPenalty}
                    onChange={(e) => setApplyPenalty(e.target.checked)}
                  />
                  {t("resolveApplyPenalty", { amount: Math.round(d.forward_penalty_preview_inr ?? 0) })}
                </label>
              )}
              {err && <p className="text-xs font-semibold text-[var(--color-wait)]">{err}</p>}
              <button
                type="button"
                onClick={submit}
                disabled={busy || !outcome}
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

export default function AdminDisputesPage() {
  const { user, token, ready, isAuthenticated } = useAuth();
  const router = useRouter();
  const t = useTranslations("adminDisputes");

  const [rows, setRows] = useState<AdminDispute[]>([]);
  const [statusF, setStatusF] = useState("");
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
      setRows(await listAdminDisputes(token, statusF || undefined));
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
          <option value="open">{t("status_open")}</option>
          <option value="resolved">{t("status_resolved")}</option>
          <option value="withdrawn">{t("status_withdrawn")}</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg)] text-xs uppercase opacity-60">
            <tr>
              <th className="px-3 py-2 font-semibold">{t("deal")}</th>
              <th className="px-3 py-2 font-semibold">{t("reason")}</th>
              <th className="px-3 py-2 font-semibold">{t("raisedBy")}</th>
              <th className="px-3 py-2 font-semibold">{t("date")}</th>
              <th className="px-3 py-2 font-semibold">{t("status")}</th>
              <th className="px-3 py-2 font-semibold text-right">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonTableRows colSpan={6} />
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center opacity-50">
                <Icon name="check" size={16} className="mr-1.5 inline-block align-text-bottom opacity-50" />
                {t("none")}
              </td></tr>
            ) : (
              rows.map((d) => <DisputeHistoryRow key={d.id} d={d} token={token} onResolved={load} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

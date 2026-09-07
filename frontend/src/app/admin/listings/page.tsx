"use client";

/** Admin — listings & demands moderation. Admin only.
 *
 * Closes a real gap the dashboard never covered: previously an admin could
 * only see aggregate lot/demand counts, with no way to open a single one and
 * act on it. Force-closing mirrors the farmer/buyer's own withdraw action
 * (soft delete -> status "closed", drops pending matches) but is
 * admin-initiated and requires a reason for the audit ledger.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/AuthProvider";
import { Icon, SkeletonTableRows } from "@/components/ui";
import {
  ApiError,
  closeAdminDemand,
  closeAdminLot,
  listAdminDemands,
  listAdminLots,
  type AdminDemand,
  type AdminLot,
} from "@/lib/api";

const STATUS_STYLE: Record<string, string> = {
  open: "bg-[var(--color-sell)]/15 text-[var(--color-sell)]",
  matched: "bg-[var(--color-brand)]/15 text-[var(--color-brand-dark)]",
  closed: "bg-[var(--color-border)] opacity-70",
};

type Kind = "lots" | "demands";

export default function AdminListingsPage() {
  const { user, token, ready, isAuthenticated } = useAuth();
  const router = useRouter();
  const t = useTranslations("adminListings");

  const [kind, setKind] = useState<Kind>("lots");
  const [lots, setLots] = useState<AdminLot[]>([]);
  const [demands, setDemands] = useState<AdminDemand[]>([]);
  const [statusF, setStatusF] = useState("");
  const [crop, setCrop] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
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
    const opts = { status: statusF || undefined, crop: crop.trim() || undefined, q: q.trim() || undefined };
    try {
      if (kind === "lots") setLots(await listAdminLots(token, opts));
      else setDemands(await listAdminDemands(token, opts));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [token, kind, statusF, crop, q, t]);

  useEffect(() => {
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
  }, [load]);

  async function closeLot(row: AdminLot) {
    const reason = window.prompt(t("closeReasonPrompt", { crop: row.crop }));
    if (reason === null) return;
    if (reason.trim().length < 3) { setErr(t("reasonTooShort")); return; }
    setBusy(row.id);
    setErr(null);
    try {
      const updated = await closeAdminLot(row.id, reason.trim(), token!);
      setLots((rs) => rs.map((r) => (r.id === row.id ? updated : r)));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t("actionError"));
    } finally {
      setBusy(null);
    }
  }

  async function closeDemand(row: AdminDemand) {
    const reason = window.prompt(t("closeReasonPrompt", { crop: row.crop }));
    if (reason === null) return;
    if (reason.trim().length < 3) { setErr(t("reasonTooShort")); return; }
    setBusy(row.id);
    setErr(null);
    try {
      const updated = await closeAdminDemand(row.id, reason.trim(), token!);
      setDemands((rs) => rs.map((r) => (r.id === row.id ? updated : r)));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t("actionError"));
    } finally {
      setBusy(null);
    }
  }

  if (!ready || !isAuthenticated || user?.role !== "admin") return null;

  const rows = kind === "lots" ? lots : demands;

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

      <div className="inline-flex w-fit gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
        <button
          type="button"
          onClick={() => setKind("lots")}
          className={`rounded-lg px-4 py-1.5 text-sm font-bold transition ${kind === "lots" ? "bg-[var(--color-brand)] text-white" : "opacity-70 hover:opacity-100"}`}
        >
          {t("tabLots")}
        </button>
        <button
          type="button"
          onClick={() => setKind("demands")}
          className={`rounded-lg px-4 py-1.5 text-sm font-bold transition ${kind === "demands" ? "bg-[var(--color-brand)] text-white" : "opacity-70 hover:opacity-100"}`}
        >
          {t("tabDemands")}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={kind === "lots" ? t("searchFarmer") : t("searchBuyer")}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
        />
        <input
          value={crop}
          onChange={(e) => setCrop(e.target.value)}
          placeholder={t("cropFilter")}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
        />
        <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm">
          <option value="">{t("allStatus")}</option>
          <option value="open">{t("status_open")}</option>
          <option value="matched">{t("status_matched")}</option>
          <option value="closed">{t("status_closed")}</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)]">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg)] text-xs uppercase opacity-60">
            <tr>
              <th className="px-3 py-2 font-semibold">{kind === "lots" ? t("farmer") : t("buyer")}</th>
              <th className="px-3 py-2 font-semibold">{t("crop")}</th>
              <th className="px-3 py-2 font-semibold">{t("quantity")}</th>
              <th className="px-3 py-2 font-semibold">{kind === "lots" ? t("price") : t("priceBand")}</th>
              <th className="px-3 py-2 font-semibold">{kind === "lots" ? t("location") : t("delivery")}</th>
              <th className="px-3 py-2 font-semibold">{t("status")}</th>
              <th className="px-3 py-2 font-semibold text-right">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonTableRows colSpan={7} />
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center opacity-50">{t("none")}</td></tr>
            ) : kind === "lots" ? (
              lots.map((r) => (
                <tr key={r.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-3 py-2 font-semibold">{r.farmer_name}</td>
                  <td className="px-3 py-2">{r.crop}</td>
                  <td className="px-3 py-2">{Math.round(r.quantity_kg)} kg</td>
                  <td className="px-3 py-2">₹{Math.round(r.expected_price)}/qtl</td>
                  <td className="px-3 py-2">{r.location}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLE[r.status] ?? STATUS_STYLE.closed}`}>
                      {t(`status_${r.status}` as "status_open")}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.status === "open" && (
                      <button
                        disabled={busy === r.id}
                        onClick={() => closeLot(r)}
                        className="rounded-lg border border-[var(--color-wait)]/50 px-2.5 py-1 text-xs font-bold text-[var(--color-wait)] disabled:opacity-50"
                      >
                        {t("close")}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              demands.map((r) => (
                <tr key={r.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-3 py-2 font-semibold">{r.buyer_name}</td>
                  <td className="px-3 py-2">{r.crop}</td>
                  <td className="px-3 py-2">{Math.round(r.quantity_kg)} kg</td>
                  <td className="px-3 py-2">₹{Math.round(r.price_band_min)}–{Math.round(r.price_band_max)}/qtl</td>
                  <td className="px-3 py-2">{r.delivery_window}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLE[r.status] ?? STATUS_STYLE.closed}`}>
                      {t(`status_${r.status}` as "status_open")}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.status === "open" && (
                      <button
                        disabled={busy === r.id}
                        onClick={() => closeDemand(r)}
                        className="rounded-lg border border-[var(--color-wait)]/50 px-2.5 py-1 text-xs font-bold text-[var(--color-wait)] disabled:opacity-50"
                      >
                        {t("close")}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

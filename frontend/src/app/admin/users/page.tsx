"use client";

/** Admin — user directory + verification. Admin only. */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/AuthProvider";
import { Icon } from "@/components/ui";
import { ApiError, getAdminUsers, setUserActive, verifyUser, type AdminUser } from "@/lib/api";

const V_STYLE: Record<string, string> = {
  verified: "bg-[var(--green-100)] text-[var(--green-700)]",
  pending: "bg-[var(--amber-100)] text-[var(--amber-700)]",
  rejected: "bg-[var(--red-100)] text-[var(--red-700)]",
  unverified: "bg-[var(--line)] text-[var(--ink-soft)]",
};

export default function AdminUsersPage() {
  const { user, token, ready, isAuthenticated } = useAuth();
  const router = useRouter();
  const t = useTranslations("adminUsers");

  const [rows, setRows] = useState<AdminUser[]>([]);
  const [roleF, setRoleF] = useState("");
  const [verF, setVerF] = useState("");
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
    try {
      setRows(await getAdminUsers(token, { role: roleF || undefined, verification: verF || undefined, q: q.trim() || undefined }));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [token, roleF, verF, q, t]);

  useEffect(() => {
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
  }, [load]);

  const counts = useMemo(() => {
    const c = { pending: 0, verified: 0, total: rows.length };
    for (const r of rows) {
      if (r.verification_status === "pending") c.pending++;
      if (r.verification_status === "verified") c.verified++;
    }
    return c;
  }, [rows]);

  async function act(fn: () => Promise<AdminUser>, id: number) {
    setBusy(id);
    setErr(null);
    try {
      const updated = await fn();
      setRows((rs) => rs.map((r) => (r.id === id ? updated : r)));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t("actionError"));
    } finally {
      setBusy(null);
    }
  }

  if (!ready || !isAuthenticated || user?.role !== "admin") return null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin" className="text-sm font-semibold text-[var(--color-brand)] hover:underline">← {t("back")}</Link>
        <h1 className="font-serif text-lg font-bold">{t("title")}</h1>
        <span className="text-xs opacity-60">
          {t("summary", { total: counts.total, pending: counts.pending, verified: counts.verified })}
        </span>
      </div>

      {err && (
        <div className="rounded-lg border border-[var(--color-wait)]/40 bg-[var(--color-wait)]/10 px-4 py-2.5 text-sm font-semibold text-[var(--color-wait)]">
          {err}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("search")}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
        />
        <select value={roleF} onChange={(e) => setRoleF(e.target.value)} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm">
          <option value="">{t("allRoles")}</option>
          <option value="farmer">{t("farmer")}</option>
          <option value="buyer">{t("buyer")}</option>
          <option value="admin">{t("admin")}</option>
        </select>
        <select value={verF} onChange={(e) => setVerF(e.target.value)} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm">
          <option value="">{t("allVerification")}</option>
          <option value="pending">{t("v_pending")}</option>
          <option value="verified">{t("v_verified")}</option>
          <option value="unverified">{t("v_unverified")}</option>
          <option value="rejected">{t("v_rejected")}</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg)] text-xs uppercase opacity-60">
            <tr>
              <th className="px-3 py-2 font-semibold">{t("user")}</th>
              <th className="px-3 py-2 font-semibold">{t("role")}</th>
              <th className="px-3 py-2 font-semibold">{t("location")}</th>
              <th className="px-3 py-2 font-semibold">{t("activity")}</th>
              <th className="px-3 py-2 font-semibold">{t("status")}</th>
              <th className="px-3 py-2 font-semibold text-right">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center opacity-50">…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center opacity-50">{t("none")}</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className={`border-b border-[var(--color-border)] last:border-0 ${!r.is_active ? "opacity-50" : ""}`}>
                  <td className="px-3 py-2">
                    <div className="font-semibold">{r.name}</div>
                    <div className="text-xs opacity-60">{r.phone}</div>
                    {r.verification_ref && <div className="text-xs opacity-60">ref: {r.verification_ref}</div>}
                  </td>
                  <td className="px-3 py-2 capitalize">{r.role}</td>
                  <td className="px-3 py-2">{[r.district, r.state].filter(Boolean).join(", ") || "—"}</td>
                  <td className="px-3 py-2 text-xs opacity-70">
                    {r.lots}L · {r.demands}D · {r.deals} {t("deals")}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${V_STYLE[r.verification_status]}`}>
                      {t(`v_${r.verification_status}` as "v_verified")}
                    </span>
                    {!r.is_active && <span className="ml-1 text-[10px] font-bold text-[var(--color-wait)]">{t("inactive")}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {r.role !== "admin" && r.verification_status !== "verified" && (
                        <button
                          disabled={busy === r.id}
                          onClick={() => act(() => verifyUser(r.id, "verified", undefined, token!), r.id)}
                          className="rounded-lg bg-[var(--color-brand-dark)] px-2.5 py-1 text-xs font-bold text-white disabled:opacity-50"
                        >
                          {t("verify")}
                        </button>
                      )}
                      {r.role !== "admin" && r.verification_status !== "rejected" && r.verification_status !== "verified" && (
                        <button
                          disabled={busy === r.id}
                          onClick={() => act(() => verifyUser(r.id, "rejected", undefined, token!), r.id)}
                          className="rounded-lg border border-[var(--color-wait)]/50 px-2.5 py-1 text-xs font-bold text-[var(--color-wait)] disabled:opacity-50"
                        >
                          {t("reject")}
                        </button>
                      )}
                      {r.id !== user.id && (
                        <button
                          disabled={busy === r.id}
                          onClick={() => act(() => setUserActive(r.id, !r.is_active, token!), r.id)}
                          className="rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs font-bold opacity-80 disabled:opacity-50"
                        >
                          {r.is_active ? t("deactivate") : t("activate")}
                        </button>
                      )}
                    </div>
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

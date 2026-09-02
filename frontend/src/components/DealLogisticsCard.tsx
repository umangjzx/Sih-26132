"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Icon } from "@/components/ui";
import {
  getDealLogistics,
  nearbyTransporters,
  saveDealLogistics,
  type DealLogistics,
  type Transporter,
} from "@/lib/api";

const MODES = ["self_pickup", "hired_transport", "buyer_arranged"] as const;
const VEHICLES = ["tractor_trailer", "mini_truck", "truck_6t", "truck_10t", "other"] as const;
const STATUSES = ["planned", "in_transit", "delivered"] as const;

export function DealLogisticsCard({
  dealId,
  token,
  closed,
}: {
  dealId: number | string;
  token: string;
  closed: boolean;
}) {
  const t = useTranslations("logistics");
  const [row, setRow] = useState<DealLogistics | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<DealLogistics>>({});
  const [transporters, setTransporters] = useState<Transporter[] | null>(null);
  const [loadingT, setLoadingT] = useState(false);

  async function findTransporters(district: string) {
    setLoadingT(true);
    try {
      setTransporters(await nearbyTransporters({ district, limit: 6 }, token));
    } catch {
      setTransporters([]);
    } finally {
      setLoadingT(false);
    }
  }

  const load = useCallback(async () => {
    try {
      const r = await getDealLogistics(dealId, token);
      setRow(r);
      setForm(r);
    } catch {
      /* non-fatal */
    }
  }, [dealId, token]);

  useEffect(() => {
    load();
  }, [load]);

  if (!row) return null;

  const inputCls =
    "rounded-lg border border-[var(--line)] px-2.5 py-2 text-sm focus:border-[var(--green-600)] focus:outline-none";

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const saved = await saveDealLogistics(
        dealId,
        {
          mode: form.mode,
          transporter_name: form.transporter_name || null,
          transporter_phone: form.transporter_phone || null,
          vehicle_type: form.vehicle_type || null,
          pickup_date: form.pickup_date || null,
          pickup_point: form.pickup_point || null,
          drop_point: form.drop_point || null,
          est_cost_inr: form.est_cost_inr ?? null,
          status: form.status,
          notes: form.notes || null,
        },
        token,
      );
      setRow(saved);
      setForm(saved);
      setEditing(false);
    } catch (e) {
      setErr(e instanceof Error && e.message.includes("409") ? t("closed") : t("error"));
    } finally {
      setSaving(false);
    }
  }

  const statusStyle =
    row.status === "delivered"
      ? "bg-[var(--green-100)] text-[var(--green-700)]"
      : row.status === "in_transit"
        ? "bg-[var(--amber-100)] text-[var(--amber-700)]"
        : "bg-[var(--line)] text-[var(--ink-soft)]";

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-heading text-base font-bold text-[var(--ink)]">
          <Icon name="truck" size={18} className="text-[var(--green-700)]" /> {t("title")}
        </h2>
        <div className="flex items-center gap-2">
          {!row.is_draft && (
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusStyle}`}>
              {t(`status_${row.status}` as "status_planned")}
            </span>
          )}
          {!closed && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-lg border border-[var(--green-600)] px-3 py-1 text-xs font-bold text-[var(--green-700)] hover:bg-[var(--green-100)]"
            >
              {row.is_draft ? t("plan") : t("edit")}
            </button>
          )}
        </div>
      </div>

      {row.is_draft && !editing && (
        <p className="mb-3 text-xs text-[var(--ink-soft)]">{t("draftHint")}</p>
      )}

      {!editing ? (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wider text-[var(--ink-soft)]">{t("route")}</dt>
            <dd className="font-semibold text-[var(--ink)]">
              {(row.pickup_point || "—")} → {(row.drop_point || "—")}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-[var(--ink-soft)]">{t("distance")}</dt>
            <dd className="font-semibold text-[var(--ink)]">
              {row.distance_km != null ? `${Math.round(row.distance_km)} km` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-[var(--ink-soft)]">{t("estCost")}</dt>
            <dd className="font-semibold text-[var(--green-700)]">
              {row.est_cost_inr != null ? `₹${Math.round(row.est_cost_inr).toLocaleString()}` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-[var(--ink-soft)]">{t("mode")}</dt>
            <dd className="font-semibold text-[var(--ink)]">{t(`mode_${row.mode}` as "mode_self_pickup")}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-[var(--ink-soft)]">{t("transporter")}</dt>
            <dd className="font-semibold text-[var(--ink)]">
              {row.transporter_name || "—"}
              {row.transporter_phone && <span className="ml-1 text-xs text-[var(--ink-soft)]">{row.transporter_phone}</span>}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-[var(--ink-soft)]">{t("pickupDate")}</dt>
            <dd className="font-semibold text-[var(--ink)]">{row.pickup_date || "—"}</dd>
          </div>
          {row.notes && (
            <div className="col-span-2 sm:col-span-3">
              <dt className="text-xs uppercase tracking-wider text-[var(--ink-soft)]">{t("notes")}</dt>
              <dd className="text-[var(--ink-soft)]">{row.notes}</dd>
            </div>
          )}
        </dl>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--ink-soft)]">
            {t("mode")}
            <select value={form.mode ?? "hired_transport"} onChange={(e) => setForm({ ...form, mode: e.target.value })} className={inputCls}>
              {MODES.map((m) => <option key={m} value={m}>{t(`mode_${m}` as "mode_self_pickup")}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--ink-soft)]">
            {t("statusField")}
            <select value={form.status ?? "planned"} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls}>
              {STATUSES.map((s) => <option key={s} value={s}>{t(`status_${s}` as "status_planned")}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--ink-soft)]">
            {t("transporterName")}
            <input value={form.transporter_name ?? ""} onChange={(e) => setForm({ ...form, transporter_name: e.target.value })} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--ink-soft)]">
            {t("transporterPhone")}
            <input value={form.transporter_phone ?? ""} onChange={(e) => setForm({ ...form, transporter_phone: e.target.value })} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--ink-soft)]">
            {t("vehicle")}
            <select value={form.vehicle_type ?? ""} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })} className={inputCls}>
              <option value="">—</option>
              {VEHICLES.map((v) => <option key={v} value={v}>{t(`veh_${v}` as "veh_other")}</option>)}
            </select>
          </label>

          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={() => findTransporters(row?.drop_point || row?.pickup_point || "")}
              disabled={loadingT}
              className="rounded-lg border border-[var(--green-600)] px-3 py-1.5 text-xs font-bold text-[var(--green-700)] hover:bg-[var(--green-100)] disabled:opacity-60"
            >
              {t("findTransporter")}
            </button>
            {transporters && (
              <ul className="mt-2 flex flex-col gap-1.5">
                {transporters.length === 0 && (
                  <li className="text-xs text-[var(--ink-soft)]">{t("noTransporters")}</li>
                )}
                {transporters.map((tr) => (
                  <li key={tr.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--paper)] px-3 py-1.5 text-xs">
                    <span className="min-w-0">
                      <span className="font-bold text-[var(--ink)]">{tr.name}</span>
                      <span className="ml-1 text-[var(--ink-soft)]">
                        {tr.district}
                        {tr.distance_km != null ? ` · ${Math.round(tr.distance_km)} km` : ""}
                        {tr.rate_per_km_per_qtl != null ? ` · ₹${tr.rate_per_km_per_qtl}/km/qtl` : ""}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, transporter_name: tr.name, transporter_phone: tr.phone ?? "", mode: "hired_transport" })}
                      className="shrink-0 rounded-md bg-[var(--green-700)] px-2 py-1 font-bold text-white"
                    >
                      {t("useThis")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--ink-soft)]">
            {t("pickupDate")}
            <input type="date" value={form.pickup_date ?? ""} onChange={(e) => setForm({ ...form, pickup_date: e.target.value })} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--ink-soft)]">
            {t("pickupPoint")}
            <input value={form.pickup_point ?? ""} onChange={(e) => setForm({ ...form, pickup_point: e.target.value })} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--ink-soft)]">
            {t("dropPoint")}
            <input value={form.drop_point ?? ""} onChange={(e) => setForm({ ...form, drop_point: e.target.value })} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--ink-soft)]">
            {t("estCostOverride")}
            <input
              type="number"
              value={form.est_cost_inr ?? ""}
              onChange={(e) => setForm({ ...form, est_cost_inr: e.target.value ? Number(e.target.value) : null })}
              placeholder={row.est_cost_inr != null ? String(Math.round(row.est_cost_inr)) : ""}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--ink-soft)] sm:col-span-2">
            {t("notes")}
            <textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={inputCls} />
          </label>

          {err && <p className="text-xs font-semibold text-[var(--color-wait)] sm:col-span-2">{err}</p>}

          <div className="flex gap-2 sm:col-span-2">
            <button type="button" onClick={save} disabled={saving}
              className="rounded-xl bg-[var(--green-700)] px-5 py-2 text-sm font-bold text-white hover:bg-[var(--green-900)] disabled:opacity-60">
              {saving ? t("saving") : t("save")}
            </button>
            <button type="button" onClick={() => { setEditing(false); setForm(row); }}
              className="rounded-xl border border-[var(--line)] px-5 py-2 text-sm font-bold text-[var(--ink-soft)]">
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

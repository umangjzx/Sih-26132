"use client";

/**
 * Pooled requests (v1.3) — list open pools, see my pools, start a new pool.
 * Farmers only. Client component (Cordova constraint).
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/AuthProvider";
import { PageHeader } from "@/components/PageHeader";
import { Icon } from "@/components/ui";
import { createPool, listPools, type PoolCreate, type PoolSummary } from "@/lib/api";
import { useLocation } from "@/lib/useLocation";
import { NEARBY_RADIUS_KM } from "@/lib/useCropMarket";

const EMPTY: PoolForm = {
  crop: "",
  title: "",
  target_quantity_kg: "",
  floor_price: "",
  grade: "B",
  delivery_window: "",
  location: "",
};

type PoolForm = {
  crop: string;
  title: string;
  target_quantity_kg: string;
  floor_price: string;
  grade: string;
  delivery_window: string;
  location: string;
};

function PoolCard({ pool }: { pool: PoolSummary }) {
  const t = useTranslations("pools");
  return (
    <Link
      href={`/pools/${pool.id}`}
      className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-heading text-base font-bold text-[var(--ink)]">{pool.title}</div>
          <div className="mt-0.5 text-xs font-medium text-[var(--ink-soft)]">
            {pool.crop} · {pool.location || "—"} · {t("members", { count: pool.members })}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
            pool.status === "open"
              ? "bg-[var(--green-100)] text-[var(--green-700)]"
              : pool.status === "locked"
                ? "bg-[var(--amber-100)] text-[var(--amber-700)]"
                : "bg-[var(--line)] text-[var(--ink-soft)]"
          }`}
        >
          {t(`status_${pool.status}` as "status_open")}
        </span>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between text-xs font-semibold text-[var(--ink-soft)]">
          <span>{Math.round(pool.committed_quantity_kg)} / {Math.round(pool.target_quantity_kg)} kg</span>
          <span>{t("filled", { pct: Math.round(pool.fill_pct) })}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--line)]">
          <div
            className="h-full rounded-full bg-[var(--green-600)]"
            style={{ width: `${Math.min(100, pool.fill_pct)}%` }}
          />
        </div>
      </div>
      <div className="text-xs font-medium text-[var(--ink-soft)]">
        {t("aggFloor")}: ₹{Math.round(pool.floor_price)}/qtl
        {pool.delivery_window ? ` · ${pool.delivery_window}` : ""}
      </div>
    </Link>
  );
}

export default function PoolsPage() {
  const { isAuthenticated, ready, user, token } = useAuth();
  const router = useRouter();
  const t = useTranslations("pools");
  const tlots = useTranslations("lots");

  const [open, setOpen] = useState<PoolSummary[]>([]);
  const [mine, setMine] = useState<PoolSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<PoolForm>(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (ready && (!isAuthenticated || user?.role !== "farmer")) router.replace("/login");
  }, [ready, isAuthenticated, user, router]);

  const { location } = useLocation();
  const precise = !!location && location.source !== "state" && location.lat != null && location.lon != null;

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [o, m] = await Promise.all([
        listPools(token, {
          lat: location?.lat ?? null,
          lon: location?.lon ?? null,
          radiusKm: precise ? NEARBY_RADIUS_KM : null,
        }),
        listPools(token, { mine: true }),
      ]);
      setOpen(o);
      setMine(m);
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, [token, location?.lat, location?.lon, precise]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (user?.district && !form.location) setForm((f) => ({ ...f, location: user.district }));
  }, [user]);

  function upd(k: keyof PoolForm, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    const body: PoolCreate = {
      crop: form.crop.trim(),
      title: form.title.trim(),
      target_quantity_kg: parseFloat(form.target_quantity_kg),
      floor_price: parseFloat(form.floor_price),
      grade: form.grade,
      delivery_window: form.delivery_window.trim(),
      location: form.location.trim(),
    };
    setSubmitting(true);
    try {
      const created = await createPool(body, token);
      setForm(EMPTY);
      setShowForm(false);
      setToast(t("createTitle"));
      setTimeout(() => setToast(null), 2500);
      router.push(`/pools/${created.id}`);
    } catch {
      setToast(tlots("scanFailed"));
      setTimeout(() => setToast(null), 3500);
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready || !isAuthenticated) return null;

  const mineIds = new Set(mine.map((p) => p.id));
  const openOnly = open.filter((p) => !mineIds.has(p.id));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon="coins" title={t("title")} subtitle={t("subtitle")} />

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
          className="flex items-center gap-2 rounded-xl bg-[var(--green-700)] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-green-900/20 transition hover:bg-[var(--green-900)]"
        >
          <Icon name={showForm ? "close" : "coins"} size={16} />
          {showForm ? t("cancel") : t("create")}
        </button>
      </div>

      {showForm && (
        <section className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-heading text-base font-bold text-[var(--ink)]">{t("createTitle")}</h2>
          <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--ink)]">
              {t("crop")}
              <input required value={form.crop} onChange={(e) => upd("crop", e.target.value)}
                className="rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm font-normal focus:border-[var(--green-600)] focus:outline-none" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--ink)]">
              {t("poolTitle")}
              <input required value={form.title} onChange={(e) => upd("title", e.target.value)}
                placeholder={t("poolTitlePlaceholder")}
                className="rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm font-normal focus:border-[var(--green-600)] focus:outline-none" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--ink)]">
              {t("targetQty")}
              <input required type="number" min="1" value={form.target_quantity_kg}
                onChange={(e) => upd("target_quantity_kg", e.target.value)}
                className="rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm font-normal focus:border-[var(--green-600)] focus:outline-none" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--ink)]">
              {t("floorPrice")}
              <input required type="number" min="1" value={form.floor_price}
                onChange={(e) => upd("floor_price", e.target.value)}
                className="rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm font-normal focus:border-[var(--green-600)] focus:outline-none" />
              <span className="text-xs font-normal text-[var(--ink-soft)]">{t("floorHint")}</span>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--ink)]">
              {t("grade")}
              <select value={form.grade} onChange={(e) => upd("grade", e.target.value)}
                className="rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm font-normal focus:border-[var(--green-600)] focus:outline-none">
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--ink)]">
              {t("deliveryWindow")}
              <input value={form.delivery_window} onChange={(e) => upd("delivery_window", e.target.value)}
                placeholder="Within 10 days"
                className="rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm font-normal focus:border-[var(--green-600)] focus:outline-none" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--ink)] sm:col-span-2">
              {t("location")}
              <input value={form.location} onChange={(e) => upd("location", e.target.value)}
                className="rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm font-normal focus:border-[var(--green-600)] focus:outline-none" />
            </label>
            <div className="sm:col-span-2">
              <button type="submit" disabled={submitting}
                className="flex items-center gap-2 rounded-xl bg-[var(--green-700)] px-6 py-3 font-bold text-white shadow-md shadow-green-900/20 transition hover:bg-[var(--green-900)] disabled:opacity-60">
                <Icon name="coins" size={18} />
                {submitting ? t("submitting") : t("submit")}
              </button>
            </div>
          </form>
        </section>
      )}

      {loading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-36 w-full animate-pulse rounded-2xl bg-white/50" />)}
        </div>
      ) : (
        <>
          {mine.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-[var(--ink-soft)]">{t("myPools")}</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {mine.map((p) => <PoolCard key={p.id} pool={p} />)}
              </div>
            </section>
          )}
          <section>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-[var(--ink-soft)]">{t("openPools")}</h2>
            {openOnly.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--paper)] py-12 text-center">
                <Icon name="coins" size={30} className="text-[var(--green-300)]" />
                <p className="text-sm font-medium text-[var(--ink-soft)]">{t("noPools")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {openOnly.map((p) => <PoolCard key={p.id} pool={p} />)}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

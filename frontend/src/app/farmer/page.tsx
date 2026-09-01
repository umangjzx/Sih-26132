"use client";

/**
 * Farmer dashboard — lot creation form (with offline queue) + lot list.
 *
 * LOT-01: create lot form
 * LOT-02: offline-tolerant — saves draft to localStorage, queues when offline,
 *         flushes queue on reconnect via window "online" event.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/AuthProvider";
import { createLot, listMyLots, type LotCreate, type LotResponse } from "@/lib/api";

const DRAFT_KEY = "agrilink.lot_draft";
const QUEUE_KEY = "agrilink.lot_queue";

type FormState = {
  crop: string;
  quantity_kg: string;
  quality_grade: string;
  expected_price: string;
  available_from: string;
  location: string;
  photo_url: string;
};

const EMPTY_FORM: FormState = {
  crop: "",
  quantity_kg: "",
  quality_grade: "A",
  expected_price: "",
  available_from: "",
  location: "",
  photo_url: "",
};

function getQueue(): LotCreate[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as LotCreate[];
  } catch { return []; }
}

function saveQueue(q: LotCreate[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export default function FarmerPage() {
  const { isAuthenticated, user, token } = useAuth();
  const router = useRouter();
  const t = useTranslations("lots");

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [lots, setLots] = useState<LotResponse[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [queueCount, setQueueCount] = useState(0);

  // Guard
  useEffect(() => {
    if (!isAuthenticated || user?.role !== "farmer") {
      router.replace("/login");
    }
  }, [isAuthenticated, user, router]);

  // Restore draft
  useEffect(() => {
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      try { setForm(JSON.parse(draft) as FormState); } catch { /* ignore */ }
    }
    setIsOnline(navigator.onLine);
    setQueueCount(getQueue().length);
  }, []);

  // Online/offline events
  useEffect(() => {
    const onOnline = () => { setIsOnline(true); flushQueue(); };
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  });

  const loadLots = useCallback(async () => {
    if (!token) return;
    try {
      const data = await listMyLots(token);
      setLots(data);
    } catch { /* non-fatal */ }
  }, [token]);

  useEffect(() => { loadLots(); }, [loadLots]);

  function updateField(field: keyof FormState, value: string) {
    const next = { ...form, [field]: value };
    setForm(next);
    localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
  }

  async function flushQueue() {
    if (!token) return;
    const queue = getQueue();
    if (queue.length === 0) return;
    const remaining: LotCreate[] = [];
    for (const body of queue) {
      try {
        await createLot(body, token);
      } catch {
        remaining.push(body);
      }
    }
    saveQueue(remaining);
    setQueueCount(remaining.length);
    if (remaining.length === 0) loadLots();
  }

  function toBody(): LotCreate {
    return {
      crop: form.crop,
      quantity_kg: parseFloat(form.quantity_kg),
      quality_grade: form.quality_grade,
      expected_price: parseFloat(form.expected_price),
      available_from: form.available_from,
      location: form.location,
      photo_url: form.photo_url || null,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = toBody();

    if (!navigator.onLine) {
      const q = [...getQueue(), body];
      saveQueue(q);
      setQueueCount(q.length);
      setToast(t("queuedOffline", { count: q.length }));
      setTimeout(() => setToast(null), 4000);
      return;
    }

    setSubmitting(true);
    try {
      await createLot(body, token!);
      localStorage.removeItem(DRAFT_KEY);
      setForm({ ...EMPTY_FORM, location: user?.district ?? "" });
      setToast(t("success"));
      setTimeout(() => setToast(null), 3000);
      loadLots();
    } catch {
      setToast(t("queuedOffline", { count: 1 }));
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSubmitting(false);
    }
  }

  // Pre-fill location with farmer's district on first render
  useEffect(() => {
    if (user?.district && !form.location) {
      setForm((f) => ({ ...f, location: user.district }));
    }
  }, [user]);

  if (!isAuthenticated) return null;

  return (
    <div className="flex flex-col gap-8">
      {/* Offline banner */}
      {!isOnline && (
        <div className="rounded-md bg-[var(--color-accent)] bg-opacity-10 border border-[var(--color-accent)] px-4 py-3 text-sm text-[var(--color-accent)]">
          {t("offlineBanner")}
        </div>
      )}
      {queueCount > 0 && isOnline && (
        <div className="rounded-md bg-[var(--color-accent)] bg-opacity-10 border border-[var(--color-accent)] px-4 py-3 text-sm text-[var(--color-accent)]">
          {t("queuedOffline", { count: queueCount })}
        </div>
      )}
      {toast && (
        <div className="rounded-md bg-[var(--color-sell)] bg-opacity-10 border border-[var(--color-sell)] px-4 py-3 text-sm text-[var(--color-sell)]">
          {toast}
        </div>
      )}

      {/* Create lot form */}
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h2 className="mb-4 text-lg font-semibold">{t("createTitle")}</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t("cropLabel")}
            <input type="text" value={form.crop} onChange={(e) => updateField("crop", e.target.value)}
              placeholder={t("cropPlaceholder")} required
              className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t("quantityLabel")}
            <input type="number" min="1" value={form.quantity_kg} onChange={(e) => updateField("quantity_kg", e.target.value)}
              required className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t("gradeLabel")}
            <select value={form.quality_grade} onChange={(e) => updateField("quality_grade", e.target.value)}
              className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm">
              <option value="A">{t("gradeA")}</option>
              <option value="B">{t("gradeB")}</option>
              <option value="C">{t("gradeC")}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t("priceLabel")}
            <input type="number" min="1" value={form.expected_price} onChange={(e) => updateField("expected_price", e.target.value)}
              required className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t("dateLabel")}
            <input type="date" value={form.available_from} onChange={(e) => updateField("available_from", e.target.value)}
              required className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t("locationLabel")}
            <input type="text" value={form.location} onChange={(e) => updateField("location", e.target.value)}
              required className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
            {t("photoUrlLabel")}
            <input type="url" value={form.photo_url} onChange={(e) => updateField("photo_url", e.target.value)}
              className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm" />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" disabled={submitting}
              className="rounded-md bg-[var(--color-brand)] px-6 py-3 font-semibold text-white hover:bg-[var(--color-brand-dark)] disabled:opacity-60 transition-colors">
              {submitting ? t("submitting") : t("submit")}
            </button>
          </div>
        </form>
      </section>

      {/* Lot list */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">{t("title")}</h2>
        {lots.length === 0 ? (
          <p className="text-sm opacity-60">{t("noLots")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {lots.map((lot) => (
              <li key={lot.id}
                className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
                <div className="flex flex-col gap-1">
                  <span className="font-semibold">{lot.crop}</span>
                  <span className="text-sm opacity-70">
                    {lot.quantity_kg} kg · Grade {lot.quality_grade} · ₹{lot.expected_price}/quintal
                  </span>
                  <span className="text-xs opacity-50">{lot.location} · {lot.available_from}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    lot.status === "open"
                      ? "bg-[var(--color-sell)] bg-opacity-10 text-[var(--color-sell)]"
                      : "bg-[var(--color-border)] text-[var(--color-text)] opacity-60"
                  }`}>
                    {t(`status_${lot.status}` as "status_open")}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

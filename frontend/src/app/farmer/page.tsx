"use client";

/**
 * Farmer dashboard — lot creation form (with offline queue) + lot list.
 *
 * LOT-01: create lot form
 * LOT-02: offline-tolerant — saves draft to localStorage, queues when offline,
 *         flushes queue on reconnect via window "online" event.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/AuthProvider";
import { NearbyResources } from "@/components/NearbyResources";
import { PageHeader } from "@/components/PageHeader";
import { Icon } from "@/components/ui";
import { createLot, listMyLots, scanLotSlip, type LotCreate, type LotResponse } from "@/lib/api";

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
  const { isAuthenticated, ready, user, token } = useAuth();
  const router = useRouter();
  const t = useTranslations("lots");
  const tdash = useTranslations("dash");

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [lots, setLots] = useState<LotResponse[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [queueCount, setQueueCount] = useState(0);
  const [scanning, setScanning] = useState(false);
  const slipInputRef = useRef<HTMLInputElement>(null);

  // Guard
  useEffect(() => {
    if (ready && (!isAuthenticated || user?.role !== "farmer")) {
      router.replace("/login");
    }
  }, [ready, isAuthenticated, user, router]);

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

  async function handleSlip(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be picked again
    if (!file || !token) return;
    setScanning(true);
    try {
      const d = await scanLotSlip(file, token);
      if (!d.available) {
        setToast(t("scanFailed"));
        setTimeout(() => setToast(null), 4000);
        return;
      }
      const next: FormState = {
        ...form,
        crop: d.crop ?? form.crop,
        quantity_kg: d.quantity_kg != null ? String(d.quantity_kg) : form.quantity_kg,
        quality_grade: d.grade && d.grade !== "FAQ" ? d.grade : form.quality_grade,
        expected_price: d.expected_price != null ? String(d.expected_price) : form.expected_price,
        available_from: d.available_from ?? form.available_from,
      };
      setForm(next);
      localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
      const filledAll = d.crop && d.quantity_kg != null && d.expected_price != null;
      setToast(
        d.confidence != null && d.confidence < 0.5
          ? t("scanLowConfidence")
          : filledAll ? t("scanFilled") : t("scanPartial"),
      );
      setTimeout(() => setToast(null), 5000);
    } catch {
      setToast(t("scanFailed"));
      setTimeout(() => setToast(null), 4000);
    } finally {
      setScanning(false);
    }
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

  if (!ready || !isAuthenticated) return null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon="leaf"
        title={tdash("farmerTitle")}
        subtitle={tdash("farmerSubtitle")}
      />

      {/* Status Banners */}
      {!isOnline && (
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--amber-500)]/30 bg-[var(--amber-100)] px-5 py-4 text-sm font-semibold text-[var(--amber-700)]">
          <Icon name="wind" size={18} />
          {t("offlineBanner")}
        </div>
      )}
      {queueCount > 0 && isOnline && (
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--amber-500)]/30 bg-[var(--amber-100)] px-5 py-4 text-sm font-semibold text-[var(--amber-700)]">
          <Icon name="clock" size={18} />
          {t("queuedOffline", { count: queueCount })}
        </div>
      )}
      {toast && (
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--green-600)]/30 bg-[var(--green-100)] px-5 py-4 text-sm font-bold text-[var(--green-700)]">
          <Icon name="check" size={18} />
          {toast}
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: "leaf", label: tdash("qaListProduce"), href: "#create-lot", color: "bg-[var(--green-700)]" },
          { icon: "connection", label: tdash("qaViewMatches"), href: "/matches", color: "bg-[var(--green-600)]" },
          { icon: "handshake", label: tdash("qaTrackDeals"), href: "/history", color: "bg-[var(--amber-700)]" },
          { icon: "warehouse", label: tdash("qaFindStorage"), href: "/directory", color: "bg-slate-700" },
        ].map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--line)] bg-white p-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${action.color} text-white`}>
              <Icon name={action.icon} size={22} />
            </div>
            <span className="text-sm font-bold text-[var(--ink)]">{action.label}</span>
          </Link>
        ))}
      </div>

      {/* Create lot form */}
      <section id="create-lot" className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--green-100)] text-[var(--green-700)]">
            <Icon name="leaf" size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-base font-bold text-[var(--ink)]">{t("createTitle")}</h2>
            <p className="text-xs text-[var(--ink-soft)]">{tdash("createLotHint")}</p>
          </div>
          <input
            ref={slipInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={handleSlip}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => slipInputRef.current?.click()}
            disabled={scanning}
            className="flex shrink-0 items-center gap-2 rounded-xl border border-[var(--green-600)] px-4 py-2 text-sm font-bold text-[var(--green-700)] transition hover:bg-[var(--green-100)] disabled:opacity-60"
          >
            <Icon name={scanning ? "clock" : "camera"} size={16} />
            {scanning ? t("scanning") : t("scanSlip")}
          </button>
        </div>
        <p className="mb-4 text-xs text-[var(--ink-soft)]">{t("scanHint")}</p>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            { key: "crop" as keyof FormState, label: t("cropLabel"), type: "text", placeholder: t("cropPlaceholder"), required: true },
            { key: "quantity_kg" as keyof FormState, label: t("quantityLabel"), type: "number", required: true },
            { key: "expected_price" as keyof FormState, label: t("priceLabel"), type: "number", required: true },
            { key: "available_from" as keyof FormState, label: t("dateLabel"), type: "date", required: true },
            { key: "location" as keyof FormState, label: t("locationLabel"), type: "text", required: true },
            { key: "photo_url" as keyof FormState, label: t("photoUrlLabel"), type: "url", required: false },
          ].map((field) => (
            <label key={field.key} className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--ink)]">
              {field.label}
              <input
                type={field.type}
                value={form[field.key]}
                onChange={(e) => updateField(field.key, e.target.value)}
                placeholder={"placeholder" in field ? field.placeholder as string : undefined}
                required={field.required}
                className="rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm font-normal focus:border-[var(--green-600)] focus:outline-none transition-colors"
              />
            </label>
          ))}

          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--ink)]">
            {t("gradeLabel")}
            <select
              value={form.quality_grade}
              onChange={(e) => updateField("quality_grade", e.target.value)}
              className="rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm font-normal focus:border-[var(--green-600)] focus:outline-none"
            >
              <option value="A">{t("gradeA")}</option>
              <option value="B">{t("gradeB")}</option>
              <option value="C">{t("gradeC")}</option>
            </select>
          </label>

          <div className="sm:col-span-2 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-xl bg-[var(--green-700)] px-6 py-3 font-bold text-white shadow-md shadow-green-900/20 transition hover:bg-[var(--green-900)] disabled:opacity-60"
            >
              <Icon name="leaf" size={18} />
              {submitting ? t("submitting") : t("submit")}
            </button>
          </div>
        </form>
      </section>

      {/* Lot list */}
      <section className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-base font-bold text-[var(--ink)]">
            {t("title")}
            {lots.length > 0 && (
              <span className="ml-2 rounded-full bg-[var(--green-100)] px-2 py-0.5 text-xs font-bold text-[var(--green-700)]">
                {lots.length}
              </span>
            )}
          </h2>
          <Link href="/matches" className="text-xs font-semibold text-[var(--green-700)] hover:underline">
            {tdash("qaViewMatches")} →
          </Link>
        </div>
        {lots.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--line)] py-10 text-center">
            <Icon name="leaf" size={28} className="text-[var(--green-400)]" />
            <p className="text-sm text-[var(--ink-soft)]">{t("noLots")}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {lots.map((lot) => (
              <li
                key={lot.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--green-100)] text-[var(--green-700)]">
                    <Icon name="leaf" size={20} />
                  </div>
                  <div>
                    <span className="font-bold text-[var(--ink)]">{lot.crop}</span>
                    <div className="mt-0.5 text-xs text-[var(--ink-soft)]">
                      {lot.quantity_kg} kg · {tdash("gradeShort")} {lot.quality_grade} · ₹{lot.expected_price}/qtl
                    </div>
                    <div className="text-xs text-[var(--ink-soft)]/70">{lot.location} · {lot.available_from}</div>
                  </div>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                  lot.status === "open"
                    ? "bg-[var(--green-100)] text-[var(--green-700)]"
                    : "bg-[var(--line)] text-[var(--ink-soft)]"
                }`}>
                  {t(`status_${lot.status}` as "status_open")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <NearbyResources
        district={user?.district}
        crop={lots[0]?.crop ?? (form.crop || undefined)}
      />
    </div>
  );
}

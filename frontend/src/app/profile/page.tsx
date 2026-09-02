"use client";

/**
 * Profile & verification — every authed user.
 *
 * Sets the trading location that distance-aware matching and the radius filters
 * depend on, and lets a farmer / buyer request account verification.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/AuthProvider";
import { PageHeader } from "@/components/PageHeader";
import { Icon } from "@/components/ui";
import { useLocation } from "@/lib/useLocation";
import { requestVerification, updateProfile } from "@/lib/api";

const V_STYLE: Record<string, string> = {
  verified: "bg-[var(--green-100)] text-[var(--green-700)]",
  pending: "bg-[var(--amber-100)] text-[var(--amber-700)]",
  rejected: "bg-[var(--red-100)] text-[var(--red-700)]",
  unverified: "bg-[var(--line)] text-[var(--ink-soft)]",
};

export default function ProfilePage() {
  const { user, token, ready, isAuthenticated, updateUser } = useAuth();
  const { location, detect, loading: locating } = useLocation();
  const router = useRouter();
  const t = useTranslations("profile");
  const inputCls =
    "rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm focus:border-[var(--green-600)] focus:outline-none";

  const [name, setName] = useState("");
  const [district, setDistrict] = useState("");
  const [state, setState] = useState("");
  const [coords, setCoords] = useState<{ lat: number | null; lon: number | null }>({ lat: null, lon: null });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [vNote, setVNote] = useState("");
  const [vRef, setVRef] = useState("");

  useEffect(() => {
    if (ready && !isAuthenticated) router.replace("/login");
  }, [ready, isAuthenticated, router]);

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? "");
    setDistrict(user.district ?? "");
    setState(user.state ?? "");
    setCoords({ lat: user.latitude ?? null, lon: user.longitude ?? null });
  }, [user]);

  if (!ready || !isAuthenticated || !user) return null;

  function pullFromChip() {
    if (!location) return;
    setDistrict(location.district || district);
    setState(location.state || state);
    setCoords({ lat: location.lat ?? null, lon: location.lon ?? null });
    flash(t("pulled"));
  }

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function save() {
    if (!token) return;
    setSaving(true);
    try {
      const next = await updateProfile(
        {
          name: name.trim() || undefined,
          district: district.trim(),
          state: state.trim(),
          latitude: coords.lat,
          longitude: coords.lon,
        },
        token,
      );
      updateUser(next);
      flash(t("saved"));
    } catch {
      flash(t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function askVerify() {
    if (!token) return;
    setSaving(true);
    try {
      const next = await requestVerification(
        { note: vNote.trim() || undefined, reference: vRef.trim() || undefined },
        token,
      );
      updateUser(next);
      flash(t("vRequested"));
    } catch {
      flash(t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  const v = user.verification_status ?? "unverified";
  const hasCoords = coords.lat != null && coords.lon != null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon="users" title={t("title")} subtitle={t("subtitle")} />

      {toast && (
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--green-600)]/30 bg-[var(--green-100)] px-5 py-4 text-sm font-bold text-[var(--green-700)]">
          <Icon name="check" size={18} /> {toast}
        </div>
      )}

      {/* Account + location */}
      <section className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
        <h2 className="mb-1 font-heading text-base font-bold text-[var(--ink)]">{t("account")}</h2>
        <p className="mb-4 text-xs text-[var(--ink-soft)]">{t("locationWhy")}</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--ink)]">
            {t("name")}
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--ink)]">
            {t("phone")}
            <input value={user.phone} disabled className={`${inputCls} opacity-60`} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--ink)]">
            {t("district")}
            <input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder={t("districtPh")} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--ink)]">
            {t("state")}
            <input value={state} onChange={(e) => setState(e.target.value)} className={inputCls} />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => detect()}
            disabled={locating}
            className="flex items-center gap-2 rounded-xl border border-[var(--green-600)] px-4 py-2 text-sm font-bold text-[var(--green-700)] hover:bg-[var(--green-100)] disabled:opacity-60"
          >
            <Icon name="pin" size={15} /> {locating ? t("detecting") : t("useGps")}
          </button>
          {location && (
            <button
              type="button"
              onClick={pullFromChip}
              className="flex items-center gap-2 rounded-xl border border-[var(--line)] px-4 py-2 text-sm font-bold text-[var(--ink-soft)] hover:bg-[var(--paper)]"
            >
              <Icon name="map" size={15} /> {t("pullChip", { label: location.label })}
            </button>
          )}
          <span className="text-xs text-[var(--ink-soft)]">
            {hasCoords ? `${coords.lat!.toFixed(3)}, ${coords.lon!.toFixed(3)}` : t("noCoords")}
          </span>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="mt-5 flex items-center gap-2 rounded-xl bg-[var(--green-700)] px-6 py-3 font-bold text-white shadow-md shadow-green-900/20 hover:bg-[var(--green-900)] disabled:opacity-60"
        >
          <Icon name="check" size={18} /> {saving ? t("saving") : t("save")}
        </button>
      </section>

      {/* Verification */}
      {user.role !== "admin" && (
        <section className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <div className="mb-2 flex items-center gap-3">
            <h2 className="font-heading text-base font-bold text-[var(--ink)]">{t("verification")}</h2>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${V_STYLE[v]}`}>
              {t(`v_${v}` as "v_verified")}
            </span>
          </div>
          <p className="mb-4 text-xs text-[var(--ink-soft)]">{t("verificationWhy")}</p>

          {user.verification_note && (
            <p className="mb-3 rounded-lg bg-[var(--paper)] px-3 py-2 text-xs text-[var(--ink-soft)]">
              {t("adminNote")}: {user.verification_note}
            </p>
          )}

          {v === "verified" ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-[var(--green-700)]">
              <Icon name="check" size={16} /> {t("vVerifiedMsg")}
            </p>
          ) : v === "pending" ? (
            <p className="text-sm text-[var(--amber-700)]">{t("vPendingMsg")}</p>
          ) : (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--ink)]">
                {t("vRefLabel")}
                <input value={vRef} onChange={(e) => setVRef(e.target.value)} placeholder={t("vRefPh")} className={inputCls} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--ink)]">
                {t("vNoteLabel")}
                <textarea value={vNote} onChange={(e) => setVNote(e.target.value)} rows={2} className={inputCls} />
              </label>
              <button
                type="button"
                onClick={askVerify}
                disabled={saving}
                className="flex w-fit items-center gap-2 rounded-xl bg-[var(--green-700)] px-5 py-2.5 text-sm font-bold text-white hover:bg-[var(--green-900)] disabled:opacity-60"
              >
                <Icon name="spark" size={16} /> {t("vRequest")}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

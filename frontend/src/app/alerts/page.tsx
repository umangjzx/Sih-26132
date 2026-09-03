"use client";

/**
 * Price-alert management (v2.0). Auth required.
 * Redesigned with premium UI/UX.
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { useAuth } from "@/components/AuthProvider";
import { PageHeader } from "@/components/PageHeader";
import { Icon } from "@/components/ui";
import {
  ApiError,
  createAlert,
  deleteAlert,
  listAlerts,
  toggleAlert,
  type PriceAlert,
} from "@/lib/api";

export default function AlertsPage() {
  const { token, isAuthenticated, ready } = useAuth();
  const t = useTranslations("alerts");
  const tc = useTranslations("common");
  const tn = useTranslations("nav");

  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [crop, setCrop] = useState("");
  const [market, setMarket] = useState("");
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [threshold, setThreshold] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setAlerts(await listAlerts(token));
      setError(null);
    } catch {
      setError(tc("error"));
    }
  }, [token, tc]);

  useEffect(() => { load(); }, [load]);

  if (!ready) return null;

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-[var(--line)] bg-white p-12 text-center shadow-sm">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--green-100)] text-[var(--green-700)]">
          <Icon name="bell" size={32} />
        </div>
        <div>
          <h2 className="font-heading text-xl font-bold text-[var(--ink)]">{tc("loginRequired")}</h2>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">{t("loginRequired")}</p>
        </div>
        <Link
          href="/login"
          className="rounded-xl bg-[var(--green-700)] px-6 py-2.5 text-sm font-bold text-white hover:bg-[var(--green-900)] transition-colors"
        >
          {tn("login")}
        </Link>
      </div>
    );
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !crop.trim() || !market.trim() || !threshold) return;
    setBusy(true);
    setError(null);
    try {
      await createAlert(
        { crop: crop.trim(), market: market.trim(), direction, threshold: Number(threshold) },
        token,
      );
      setCrop("");
      setMarket("");
      setThreshold("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tc("error"));
    } finally {
      setBusy(false);
    }
  }

  async function runAlertAction(fn: Promise<unknown>) {
    setError(null);
    try {
      await fn;
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tc("error"));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon="bell"
        title={t("title")}
        subtitle={t("subtitle")}
      />

      {/* Success toast */}
      {success && (
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--green-600)]/30 bg-[var(--green-100)] px-5 py-4 text-sm font-semibold text-[var(--green-700)]">
          <Icon name="check" size={18} />
          {t("createdSuccess")}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--red-600)]/30 bg-[var(--red-100)] px-5 py-4 text-sm font-semibold text-[var(--red-700)]">
          <Icon name="close" size={18} />
          {error}
        </div>
      )}

      {/* Alert Creation Form */}
      <div className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
        <h2 className="mb-2 font-heading text-base font-bold text-[var(--ink)]">
          {t("create")}
        </h2>
        <p className="mb-5 text-sm text-[var(--ink-soft)]">{t("createHint")}</p>

        <form onSubmit={add}>
          {/* Visual form builder */}
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl bg-[var(--paper)] p-4 text-sm">
            <span className="font-semibold text-[var(--ink-soft)]">{t("builderNotifyWhen")}</span>
            <input
              value={crop}
              onChange={(e) => setCrop(e.target.value)}
              required
              placeholder={t("cropPlaceholder")}
              className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold focus:border-[var(--green-600)] focus:outline-none"
            />
            <span className="font-semibold text-[var(--ink-soft)]">{t("builderAt")}</span>
            <input
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              required
              placeholder={t("marketPlaceholder")}
              className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold focus:border-[var(--green-600)] focus:outline-none"
            />
            <span className="font-semibold text-[var(--ink-soft)]">{t("builderGoes")}</span>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as "above" | "below")}
              className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold focus:border-[var(--green-600)] focus:outline-none"
            >
              <option value="above">{t("above")}</option>
              <option value="below">{t("below")}</option>
            </select>
            <div className="flex items-center gap-1 rounded-xl border border-[var(--line)] bg-white px-3 py-2">
              <span className="text-sm font-bold text-[var(--ink-soft)]">₹</span>
              <input
                type="number"
                min="1"
                max="5000000"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                required
                placeholder={t("thresholdShort")}
                className="w-24 text-sm font-semibold focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="flex items-center gap-2 rounded-xl bg-[var(--green-700)] px-6 py-3 text-sm font-bold text-white shadow-md shadow-green-900/20 transition hover:bg-[var(--green-900)] disabled:opacity-50"
          >
            <Icon name="bell" size={16} />
            {busy ? t("adding") : t("add")}
          </button>
        </form>
      </div>

      {/* Active Alerts List */}
      <div className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-base font-bold text-[var(--ink)]">
            {t("yourAlerts")}
            {alerts.length > 0 && (
              <span className="ml-2 rounded-full bg-[var(--green-100)] px-2 py-0.5 text-xs font-bold text-[var(--green-700)]">
                {alerts.length}
              </span>
            )}
          </h2>
        </div>

        {alerts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--line)] py-10 text-center">
            <Icon name="bell" size={28} className="text-[var(--green-400)]" />
            <div>
              <p className="font-semibold text-[var(--ink)]">{t("none")}</p>
              <p className="mt-0.5 text-sm text-[var(--ink-soft)]">{t("noneHint")}</p>
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {alerts.map((al) => (
              <li
                key={al.id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 transition-colors ${
                  al.active
                    ? "border-[var(--green-600)]/20 bg-[var(--green-50)]"
                    : "border-[var(--line)] bg-[var(--paper)]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    al.direction === "above"
                      ? "bg-[var(--green-100)] text-[var(--green-700)]"
                      : "bg-[var(--red-100)] text-[var(--red-700)]"
                  }`}>
                    <Icon name={al.direction === "above" ? "arrowUp" : "arrowDown"} size={18} />
                  </div>
                  <div>
                    <span className="font-bold text-[var(--ink)]">{al.crop}</span>
                    <span className="text-sm text-[var(--ink-soft)]"> @ {al.market}</span>
                    <div className="mt-0.5 text-sm">
                      <span className={al.direction === "above" ? "text-[var(--green-700)]" : "text-[var(--red-700)]"}>
                        {al.direction === "above" ? `▲ ${t("above")}` : `▼ ${t("below")}`} ₹{al.threshold}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    al.active
                      ? "bg-[var(--green-100)] text-[var(--green-700)]"
                      : "bg-[var(--line)] text-[var(--ink-soft)]"
                  }`}>
                    {al.active ? t("active") : t("paused")}
                  </span>
                  <button
                    type="button"
                    onClick={() => token && runAlertAction(toggleAlert(al.id, token))}
                    className="rounded-xl border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--paper)] transition-colors"
                  >
                    {al.active ? t("pause") : t("resume")}
                  </button>
                  <button
                    type="button"
                    onClick={() => token && runAlertAction(deleteAlert(al.id, token))}
                    className="rounded-xl border border-[var(--red-500)]/30 bg-[var(--red-100)] px-3 py-1.5 text-xs font-semibold text-[var(--red-700)] hover:bg-[var(--red-100)] transition-colors"
                  >
                    {t("delete")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

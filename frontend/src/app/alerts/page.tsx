"use client";

/**
 * Price-alert management (v1.1). Auth required.
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { useAuth } from "@/components/AuthProvider";
import {
  createAlert,
  deleteAlert,
  listAlerts,
  toggleAlert,
  type PriceAlert,
} from "@/lib/api";

export default function AlertsPage() {
  const { token, isAuthenticated } = useAuth();
  const t = useTranslations("alerts");

  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [crop, setCrop] = useState("");
  const [market, setMarket] = useState("");
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [threshold, setThreshold] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setAlerts(await listAlerts(token));
    } catch {
      /* ignore */
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  if (!isAuthenticated) {
    return (
      <p className="rounded-xl border border-[var(--color-border)] bg-white/50 px-4 py-3 text-sm text-stone-600">
        {t("loginRequired")}
      </p>
    );
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !crop.trim() || !market.trim() || !threshold) return;
    setBusy(true);
    try {
      await createAlert(
        { crop: crop.trim(), market: market.trim(), direction, threshold: Number(threshold) },
        token,
      );
      setCrop("");
      setMarket("");
      setThreshold("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-stone-600">{t("subtitle")}</p>
      </div>

      <form
        onSubmit={add}
        className="grid gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-lg sm:grid-cols-2"
      >
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t("crop")}
          <input
            value={crop}
            onChange={(e) => setCrop(e.target.value)}
            required
            placeholder="Onion"
            className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t("market")}
          <input
            value={market}
            onChange={(e) => setMarket(e.target.value)}
            required
            placeholder="Pune"
            className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t("direction")}
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as "above" | "below")}
            className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm"
          >
            <option value="above">{t("above")}</option>
            <option value="below">{t("below")}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t("threshold")}
          <input
            type="number"
            min="1"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            required
            className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm"
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={busy}
            className="min-h-11 rounded-xl bg-[var(--color-brand)] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-brand-dark)] disabled:opacity-50"
          >
            {busy ? t("adding") : t("add")}
          </button>
        </div>
      </form>

      <section>
        <h2 className="mb-2 font-heading text-sm font-bold">{t("yourAlerts")}</h2>
        {alerts.length === 0 ? (
          <p className="text-sm opacity-60">{t("none")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {alerts.map((al) => (
              <li
                key={al.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-white/50 px-4 py-3 text-sm"
              >
                <span>
                  <span className="font-semibold">{al.crop}</span> @ {al.market} · {t("direction")}{" "}
                  <span className="font-semibold">
                    {al.direction === "above" ? t("above") : t("below")} ₹{al.threshold}
                  </span>
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      al.active
                        ? "bg-[var(--color-sell)]/10 text-[var(--color-sell)]"
                        : "bg-[var(--color-border)] text-stone-500"
                    }`}
                  >
                    {al.active ? t("active") : t("paused")}
                  </span>
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => token && toggleAlert(al.id, token).then(load)}
                    className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold"
                  >
                    {al.active ? t("pause") : t("resume")}
                  </button>
                  <button
                    type="button"
                    onClick={() => token && deleteAlert(al.id, token).then(load)}
                    className="rounded-lg border border-[var(--color-wait)]/40 px-3 py-1.5 text-xs font-semibold text-[var(--color-wait)]"
                  >
                    {t("delete")}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

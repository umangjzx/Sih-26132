"use client";

/**
 * Buyer dashboard — post demand + list demands + ranked matches with verified badge.
 *
 * DEMAND-01: demand creation form
 * MATCH-02:  ranked match list with score breakdown
 * VERIFY-01: verified badge on farmer counterparty
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/AuthProvider";
import {
  createDemand,
  listMyDemands,
  listMyMatches,
  type DemandCreate,
  type DemandResponse,
  type MatchResponse,
  type ScoreDetail,
} from "@/lib/api";

function parseScoreDetail(raw: string | null): ScoreDetail | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as ScoreDetail; } catch { return null; }
}

function ScoreBar({ score, detail }: { score: number; detail: ScoreDetail | null }) {
  const tm = useTranslations("matching");
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <div className="h-2 flex-1 rounded-full bg-[var(--color-border)]">
          <div
            className="h-full rounded-full bg-[var(--color-brand)]"
            style={{ width: `${score}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-[var(--color-brand)]">{score}/100</span>
      </div>
      {detail && (
        <p className="text-xs opacity-60">
          {tm("quantityScore")}: {detail.quantity} · {tm("priceScore")}: {detail.price} · {tm("distanceScore")}: {detail.distance}
        </p>
      )}
    </div>
  );
}

export default function BuyerPage() {
  const { isAuthenticated, user, token } = useAuth();
  const router = useRouter();
  const td = useTranslations("demands");
  const tm = useTranslations("matching");

  const [form, setForm] = useState<DemandCreate>({
    crop: "", quantity_kg: 0, quality_spec: "", price_band_min: 0, price_band_max: 0, delivery_window: "",
  });
  const [demands, setDemands] = useState<DemandResponse[]>([]);
  const [matches, setMatches] = useState<MatchResponse[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "buyer") router.replace("/login");
  }, [isAuthenticated, user, router]);

  const loadData = useCallback(async () => {
    if (!token) return;
    const [d, m] = await Promise.allSettled([
      listMyDemands(token),
      listMyMatches(token),
    ]);
    if (d.status === "fulfilled") setDemands(d.value);
    if (m.status === "fulfilled") setMatches(m.value);
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    try {
      await createDemand(form, token);
      setForm({ crop: "", quantity_kg: 0, quality_spec: "", price_band_min: 0, price_band_max: 0, delivery_window: "" });
      setToast(td("success"));
      setTimeout(() => setToast(null), 3000);
      loadData();
    } catch {
      setToast(td("noDemands")); // reuse as generic error; 02-04 adds proper error key
    } finally {
      setSubmitting(false);
    }
  }

  if (!isAuthenticated) return null;

  return (
    <div className="flex flex-col gap-8">
      {toast && (
        <div className="rounded-md bg-[var(--color-sell)] bg-opacity-10 border border-[var(--color-sell)] px-4 py-3 text-sm text-[var(--color-sell)]">
          {toast}
        </div>
      )}

      {/* Post demand form */}
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h2 className="mb-4 text-lg font-semibold">{td("createTitle")}</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            {td("cropLabel")}
            <input type="text" value={form.crop} onChange={(e) => setForm({ ...form, crop: e.target.value })}
              placeholder={td("cropPlaceholder")} required
              className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {td("quantityLabel")}
            <input type="number" min="1" value={form.quantity_kg || ""} onChange={(e) => setForm({ ...form, quantity_kg: parseFloat(e.target.value) })}
              required className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
            {td("qualitySpecLabel")}
            <input type="text" value={form.quality_spec} onChange={(e) => setForm({ ...form, quality_spec: e.target.value })}
              placeholder={td("qualitySpecPlaceholder")} required
              className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {td("priceMinLabel")}
            <input type="number" min="1" value={form.price_band_min || ""} onChange={(e) => setForm({ ...form, price_band_min: parseFloat(e.target.value) })}
              required className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {td("priceMaxLabel")}
            <input type="number" min="1" value={form.price_band_max || ""} onChange={(e) => setForm({ ...form, price_band_max: parseFloat(e.target.value) })}
              required className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
            {td("deliveryWindowLabel")}
            <input type="text" value={form.delivery_window} onChange={(e) => setForm({ ...form, delivery_window: e.target.value })}
              placeholder={td("deliveryWindowPlaceholder")} required
              className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm" />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" disabled={submitting}
              className="rounded-md bg-[var(--color-brand)] px-6 py-3 font-semibold text-white hover:bg-[var(--color-brand-dark)] disabled:opacity-60 transition-colors">
              {submitting ? td("submitting") : td("submit")}
            </button>
          </div>
        </form>
      </section>

      {/* Matches list */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">{tm("title")}</h2>
        {matches.length === 0 ? (
          <p className="text-sm opacity-60">{tm("noMatches")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {matches.map((match) => {
              const detail = parseScoreDetail(match.score_detail);
              const cp = match.counterparty;
              return (
                <li key={match.id}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="font-semibold">{match.lot.crop}</span>
                      <span className="ml-2 text-sm opacity-60">
                        {match.lot.quantity_kg} kg · ₹{match.lot.expected_price}/quintal · {match.lot.location}
                      </span>
                      {cp && (
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-sm opacity-70">{cp.name}</span>
                          {cp.kyc_status === "verified" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-sell)] bg-opacity-10 px-2 py-0.5 text-xs font-medium text-[var(--color-sell)]">
                              ✓ {tm("verifiedFarmer")}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <Link href={`/matches/${match.id}`}
                      className="shrink-0 rounded-md border border-[var(--color-brand)] px-3 py-1.5 text-sm font-medium text-[var(--color-brand)] hover:bg-[var(--color-brand)] hover:text-white transition-colors">
                      {tm("viewOffers")}
                    </Link>
                  </div>
                  <ScoreBar score={match.score} detail={detail} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

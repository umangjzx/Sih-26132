"use client";

/**
 * Discovery board — a buyer browses nearby open lots, a farmer browses nearby
 * open demands. Radius-filtered against the viewer's profile location.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/AuthProvider";
import { PageHeader } from "@/components/PageHeader";
import { Icon } from "@/components/ui";
import { NEARBY_RADIUS_KM } from "@/lib/useCropMarket";
import {
  browseDemands,
  browseLots,
  expressInterestInDemand,
  expressInterestInLot,
  type BrowseDemand,
  type BrowseLot,
  type ExpressInterestResult,
} from "@/lib/api";

function VBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
        ok ? "bg-[var(--green-100)] text-[var(--green-700)]" : "bg-[var(--line)] text-[var(--ink-soft)]"
      }`}
    >
      {ok && <Icon name="check" size={10} />} {label}
    </span>
  );
}

export default function BrowsePage() {
  const { user, token, ready, isAuthenticated } = useAuth();
  const router = useRouter();
  const t = useTranslations("browse");
  const isBuyer = user?.role === "buyer";
  const verifiedTxt = t("verified");
  const unverifiedTxt = t("unverified");
  const dist = (km: number | null) =>
    km == null ? t("distUnknown") : km < 1 ? t("distHere") : `${Math.round(km)} km`;

  const [crop, setCrop] = useState("");
  const [wide, setWide] = useState(false);
  const [lots, setLots] = useState<BrowseLot[]>([]);
  const [demands, setDemands] = useState<BrowseDemand[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [note, setNote] = useState<{ id: number; msg: string; ok: boolean; matchId?: number | null } | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) router.replace("/login");
    else if (user?.role === "admin") router.replace("/admin");
  }, [ready, isAuthenticated, user, router]);

  const load = useCallback(async () => {
    if (!token || !user || user.role === "admin") return;
    setLoading(true);
    const opts = { crop: crop.trim() || undefined, radiusKm: wide ? null : NEARBY_RADIUS_KM };
    try {
      if (user.role === "buyer") setLots(await browseLots(token, opts));
      else setDemands(await browseDemands(token, opts));
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [token, user, crop, wide]);

  useEffect(() => {
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
  }, [load]);

  async function interest(id: number, fn: () => Promise<ExpressInterestResult>) {
    setBusy(id);
    setNote(null);
    try {
      const r = await fn();
      setNote({
        id,
        ok: r.matched,
        msg: r.matched ? t("matchOpened", { score: Math.round(r.score ?? 0) }) : r.reason || t("noMatchYet"),
        matchId: r.match_id,
      });
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      setNote({ id, ok: false, msg: m.includes("409") ? (isBuyer ? t("needDemand") : t("needLot")) : t("error") });
    } finally {
      setBusy(null);
    }
  }

  if (!ready || !isAuthenticated || !user || user.role === "admin") return null;

  const hasLoc = user.district || (user.latitude != null && user.longitude != null);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={isBuyer ? "leaf" : "handshake"}
        title={isBuyer ? t("titleBuyer") : t("titleFarmer")}
        subtitle={isBuyer ? t("subBuyer") : t("subFarmer")}
      />

      {!hasLoc && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--amber-500)]/30 bg-[var(--amber-100)] px-5 py-4 text-sm font-semibold text-[var(--amber-700)]">
          <Icon name="pin" size={16} /> {t("noLocation")}
          <Link href="/profile" className="underline">{t("setLocation")}</Link>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={crop}
          onChange={(e) => setCrop(e.target.value)}
          placeholder={t("cropFilter")}
          className="rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm focus:border-[var(--green-600)] focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setWide((w) => !w)}
          className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${
            wide
              ? "border-[var(--green-600)] bg-[var(--green-100)] text-[var(--green-700)]"
              : "border-[var(--line)] text-[var(--ink-soft)] hover:bg-[var(--paper)]"
          }`}
        >
          {wide ? t("allIndia") : t("within", { km: NEARBY_RADIUS_KM })}
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/50" />)}
        </div>
      ) : (isBuyer ? lots : demands).length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--paper)] py-12 text-center">
          <Icon name={isBuyer ? "leaf" : "handshake"} size={30} className="text-[var(--green-300)]" />
          <p className="text-sm font-medium text-[var(--ink-soft)]">{t("empty")}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {isBuyer
            ? lots.map((l) => (
                <li key={l.id} className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-heading text-base font-bold text-[var(--ink)]">{l.crop}</span>
                        <span className="rounded-md bg-[var(--paper)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--ink-soft)]">
                          {t("grade")} {l.quality_grade}
                        </span>
                      </div>
                      <div className="mt-1 text-sm font-medium text-[var(--ink-soft)]">
                        {Math.round(l.quantity_kg)} kg · ₹{Math.round(l.expected_price)}/qtl · {t("from")} {l.available_from}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--ink-soft)]">
                        <span className="font-bold text-[var(--ink)]">{l.farmer_name}</span>
                        <VBadge ok={l.farmer_verified} label={l.farmer_verified ? verifiedTxt : unverifiedTxt} />
                        <span className="inline-flex items-center gap-1"><Icon name="pin" size={12} /> {l.farmer_district} · {dist(l.distance_km)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => interest(l.id, () => expressInterestInLot(l.id, token!))}
                      disabled={busy === l.id}
                      className="shrink-0 rounded-xl bg-[var(--green-700)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--green-900)] disabled:opacity-60"
                    >
                      {t("interest")}
                    </button>
                  </div>
                  {note?.id === l.id && (
                    <p className={`mt-2 text-xs font-semibold ${note.ok ? "text-[var(--green-700)]" : "text-[var(--amber-700)]"}`}>
                      {note.msg}
                      {note.ok && note.matchId && (
                        <Link href={`/matches/${note.matchId}`} className="ml-1 underline">{t("openMatch")}</Link>
                      )}
                    </p>
                  )}
                </li>
              ))
            : demands.map((d) => (
                <li key={d.id} className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-heading text-base font-bold text-[var(--ink)]">{d.crop}</span>
                        {d.quality_grade_min && (
                          <span className="rounded-md bg-[var(--paper)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--ink-soft)]">
                            {t("gradeMin", { grade: d.quality_grade_min })}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-sm font-medium text-[var(--ink-soft)]">
                        {Math.round(d.quantity_kg)} kg · ₹{Math.round(d.price_band_min)}–{Math.round(d.price_band_max)}/qtl · {d.delivery_window}
                      </div>
                      {d.quality_spec && <div className="mt-0.5 text-xs text-[var(--ink-soft)]">{t("wants")}: {d.quality_spec}</div>}
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--ink-soft)]">
                        <span className="font-bold text-[var(--ink)]">{d.buyer_name}</span>
                        <VBadge ok={d.buyer_verified} label={d.buyer_verified ? verifiedTxt : unverifiedTxt} />
                        <span className="inline-flex items-center gap-1"><Icon name="pin" size={12} /> {d.delivery_district} · {dist(d.distance_km)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => interest(d.id, () => expressInterestInDemand(d.id, token!))}
                      disabled={busy === d.id}
                      className="shrink-0 rounded-xl bg-[var(--green-700)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--green-900)] disabled:opacity-60"
                    >
                      {t("interest")}
                    </button>
                  </div>
                  {note?.id === d.id && (
                    <p className={`mt-2 text-xs font-semibold ${note.ok ? "text-[var(--green-700)]" : "text-[var(--amber-700)]"}`}>
                      {note.msg}
                      {note.ok && note.matchId && (
                        <Link href={`/matches/${note.matchId}`} className="ml-1 underline">{t("openMatch")}</Link>
                      )}
                    </p>
                  )}
                </li>
              ))}
        </ul>
      )}
    </div>
  );
}

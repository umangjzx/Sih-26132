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
import { PageHeader } from "@/components/PageHeader";
import { StatCards, type Stat } from "@/components/StatCards";
import { Icon } from "@/components/ui";
import {
  createDemand,
  listMyDemands,
  listMyMatches,
  type DemandCreate,
  type DemandResponse,
  type MatchResponse,
  type ScoreDetail,
} from "@/lib/api";

function tierOf(m: MatchResponse): string {
  try {
    const d = m.score_detail ? (JSON.parse(m.score_detail) as { tier?: string }) : null;
    return d?.tier ?? (m.score >= 75 ? "strong" : m.score >= 50 ? "good" : "fair");
  } catch {
    return m.score >= 75 ? "strong" : "fair";
  }
}

function parseScoreDetail(raw: string | null): ScoreDetail | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as ScoreDetail; } catch { return null; }
}

function ScoreBar({ score, detail }: { score: number; detail: ScoreDetail | null }) {
  const tm = useTranslations("matching");
  const tdash = useTranslations("dash");
  return (
    <div className="mt-3 flex flex-col gap-2 rounded-xl bg-[var(--paper)] p-3 border border-[var(--line)]">
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-[var(--ink-soft)] uppercase tracking-widest shrink-0">{tm("scoreLabel")}</span>
        <div className="h-2 flex-1 rounded-full bg-[var(--line)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--green-600)]"
            style={{ width: `${score}%` }}
          />
        </div>
        <span className="text-sm font-extrabold text-[var(--green-700)]">{score}%</span>
      </div>
      {detail && (
        <div className="flex items-center gap-4 text-xs font-medium text-[var(--ink-soft)]">
          <span className="flex items-center gap-1"><Icon name="leaf" size={14} className="text-[var(--amber-600)]" /> {tdash("qty")}: {detail.quantity}/30</span>
          <span className="flex items-center gap-1"><Icon name="chart" size={14} className="text-[var(--amber-600)]" /> {tdash("price")}: {detail.price}/40</span>
          <span className="flex items-center gap-1"><Icon name="pin" size={14} className="text-[var(--amber-600)]" /> {tdash("dist")}: {detail.distance}/30</span>
        </div>
      )}
    </div>
  );
}

export default function BuyerPage() {
  const { isAuthenticated, ready, user, token } = useAuth();
  const router = useRouter();
  const td = useTranslations("demands");
  const tm = useTranslations("matching");
  const tdash = useTranslations("dash");

  const [form, setForm] = useState<DemandCreate>({
    crop: "", quantity_kg: 0, quality_spec: "", price_band_min: 0, price_band_max: 0, delivery_window: "", delivery_district: "",
  });
  const [demands, setDemands] = useState<DemandResponse[]>([]);
  const [matches, setMatches] = useState<MatchResponse[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (ready && (!isAuthenticated || user?.role !== "buyer")) router.replace("/login");
  }, [ready, isAuthenticated, user, router]);

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

  const openDemands = demands.filter((d) => d.status === "open");
  const totalKg = openDemands.reduce((s, d) => s + d.quantity_kg, 0);
  const estSpend = openDemands.reduce(
    (s, d) => s + (d.quantity_kg / 100) * ((d.price_band_min + d.price_band_max) / 2),
    0,
  );
  const strongMatches = matches.filter((m) => tierOf(m) === "strong").length;
  const verifiedFarmers = new Set(
    matches.filter((m) => m.counterparty?.kyc_status === "verified").map((m) => m.counterparty?.id),
  ).size;

  const stats: Stat[] = [
    { label: td("statOpenDemands"), value: String(openDemands.length), sub: `${demands.length} ${td("statAllTime")}`, icon: "handshake" },
    { label: td("statSought"), value: `${(totalKg / 100).toFixed(1)} qtl`, sub: td("statAcross", { n: openDemands.length }), icon: "chart" },
    {
      label: td("statEstSpend"),
      value: estSpend >= 1e5 ? `₹${(estSpend / 1e5).toFixed(2)}L` : `₹${Math.round(estSpend).toLocaleString()}`,
      sub: td("statAtMidBand"),
      icon: "coins",
      tone: "good",
    },
    {
      label: td("statMatches"),
      value: String(matches.length),
      sub: strongMatches ? td("statStrong", { n: strongMatches }) : verifiedFarmers ? td("statVerified", { n: verifiedFarmers }) : td("statNoneYet"),
      icon: "connection",
      tone: matches.length ? "good" : "neutral",
    },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    try {
      await createDemand(
        { ...form, delivery_district: form.delivery_district?.trim() || user?.district || null },
        token,
      );
      setForm({ crop: "", quantity_kg: 0, quality_spec: "", price_band_min: 0, price_band_max: 0, delivery_window: "", delivery_district: "" });
      setToast(td("success"));
      setTimeout(() => setToast(null), 3000);
      loadData();
    } catch {
      setToast(td("noDemands")); // reuse as generic error; 02-04 adds proper error key
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready || !isAuthenticated) return null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon="handshake"
        title={tdash("buyerTitle")}
        subtitle={tdash("buyerSubtitle")}
      />

      <StatCards stats={stats} />

      {toast && (
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--green-600)]/30 bg-[var(--green-100)] px-5 py-4 text-sm font-bold text-[var(--green-700)]">
          <Icon name="check" size={18} />
          {toast}
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: "handshake", label: tdash("qaPostDemand"), href: "#create-demand", color: "bg-[var(--green-700)]" },
          { icon: "connection", label: tdash("qaViewMatches"), href: "#matches", color: "bg-[var(--green-600)]" },
          { icon: "clock", label: tdash("qaTrackDeals"), href: "/history", color: "bg-[var(--amber-700)]" },
          { icon: "warehouse", label: tdash("qaFindFpos"), href: "/directory", color: "bg-slate-700" },
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

      {/* Post demand form */}
      <section id="create-demand" className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--green-100)] text-[var(--green-700)]">
            <Icon name="handshake" size={20} />
          </div>
          <div>
            <h2 className="font-heading text-base font-bold text-[var(--ink)]">{td("createTitle")}</h2>
            <p className="text-xs text-[var(--ink-soft)]">{tdash("createDemandHint")}</p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            { key: "crop" as keyof DemandCreate, label: td("cropLabel"), type: "text", placeholder: td("cropPlaceholder"), required: true },
            { key: "quantity_kg" as keyof DemandCreate, label: td("quantityLabel"), type: "number", required: true },
            { key: "price_band_min" as keyof DemandCreate, label: td("priceMinLabel"), type: "number", required: true },
            { key: "price_band_max" as keyof DemandCreate, label: td("priceMaxLabel"), type: "number", required: true },
          ].map((field) => (
            <label key={field.key} className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--ink)]">
              {field.label}
              <input
                type={field.type}
                value={(form[field.key] as string | number) || ""}
                onChange={(e) => setForm({ ...form, [field.key]: field.type === "number" ? parseFloat(e.target.value) : e.target.value })}
                placeholder={"placeholder" in field ? field.placeholder as string : undefined}
                required={field.required}
                className="rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm font-normal focus:border-[var(--green-600)] focus:outline-none transition-colors"
              />
            </label>
          ))}
          
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--ink)] sm:col-span-2">
            {td("qualitySpecLabel")}
            <input 
              type="text" 
              value={form.quality_spec} 
              onChange={(e) => setForm({ ...form, quality_spec: e.target.value })}
              placeholder={td("qualitySpecPlaceholder")} 
              required
              className="rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm font-normal focus:border-[var(--green-600)] focus:outline-none transition-colors"
            />
          </label>
          
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--ink)]">
            {td("deliveryWindowLabel")}
            <input
              type="text"
              value={form.delivery_window}
              onChange={(e) => setForm({ ...form, delivery_window: e.target.value })}
              placeholder={td("deliveryWindowPlaceholder")}
              required
              className="rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm font-normal focus:border-[var(--green-600)] focus:outline-none transition-colors"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--ink)]">
            {td("deliverToLabel")}
            <input
              type="text"
              value={form.delivery_district ?? ""}
              onChange={(e) => setForm({ ...form, delivery_district: e.target.value })}
              placeholder={user?.district || td("deliverToPlaceholder")}
              className="rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm font-normal focus:border-[var(--green-600)] focus:outline-none transition-colors"
            />
            <span className="text-xs font-normal text-[var(--ink-soft)]">
              {user?.district
                ? td("deliverToHint", { d: user.district })
                : td("deliverToNoProfile")}
              {!user?.district && (
                <Link href="/profile" className="ml-1 font-semibold text-[var(--green-700)] hover:underline">
                  {td("setProfile")}
                </Link>
              )}
            </span>
          </label>

          <div className="sm:col-span-2 pt-2">
            <button 
              type="submit" 
              disabled={submitting}
              className="flex items-center gap-2 rounded-xl bg-[var(--green-700)] px-6 py-3 font-bold text-white shadow-md shadow-green-900/20 transition hover:bg-[var(--green-900)] disabled:opacity-60"
            >
              <Icon name="handshake" size={18} />
              {submitting ? td("submitting") : td("submit")}
            </button>
          </div>
        </form>
      </section>

      {/* Matches list */}
      <section id="matches" className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-base font-bold text-[var(--ink)]">
            {tm("title")}
            {matches.length > 0 && (
              <span className="ml-2 rounded-full bg-[var(--green-100)] px-2 py-0.5 text-xs font-bold text-[var(--green-700)]">
                {matches.length}
              </span>
            )}
          </h2>
          <Link href="#matches" className="text-xs font-semibold text-[var(--green-700)] hover:underline">
            {tdash("viewAll")} →
          </Link>
        </div>
        {matches.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--line)] py-10 text-center">
            <Icon name="connection" size={28} className="text-[var(--green-400)]" />
            <p className="text-sm text-[var(--ink-soft)]">{tm("noMatches")}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {matches.map((match) => {
              const detail = parseScoreDetail(match.score_detail);
              const cp = match.counterparty;
              return (
                <li key={match.id}
                  className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4 flex flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--green-100)] text-[var(--green-700)]">
                        <Icon name="leaf" size={20} />
                      </div>
                      <div>
                        <span className="font-bold text-[var(--ink)]">{match.lot.crop}</span>
                        <div className="mt-0.5 text-xs text-[var(--ink-soft)]">
                          {match.lot.quantity_kg} kg · ₹{match.lot.expected_price}/qtl · {match.lot.location}
                        </div>
                        {cp && (
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-[var(--ink)]">{cp.name}</span>
                            {cp.kyc_status === "verified" && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--green-100)] px-2 py-0.5 text-xs font-bold text-[var(--green-700)]">
                                <Icon name="check" size={12} /> {tm("verifiedFarmer")}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <Link href={`/matches/${match.id}`}
                      className="shrink-0 rounded-xl bg-[var(--green-700)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--green-900)]">
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

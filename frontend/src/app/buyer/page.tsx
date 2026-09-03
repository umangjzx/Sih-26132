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
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { QuickActions } from "@/components/QuickActions";
import { Icon } from "@/components/ui";
import {
  ApiError,
  createDemand,
  listMyDemands,
  listMyMatches,
  updateDemand,
  withdrawDemand,
  type DemandCreate,
  type DemandResponse,
  type MatchResponse,
  type ScoreDetail,
} from "@/lib/api";

const EMPTY_DEMAND: DemandCreate = {
  crop: "", quantity_kg: 0, quality_spec: "", quality_grade_min: null,
  price_band_min: 0, price_band_max: 0, delivery_window: "", delivery_district: "",
};

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
  const tc = useTranslations("common");
  const tq = useTranslations("quick");

  const [form, setForm] = useState<DemandCreate>(EMPTY_DEMAND);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [demands, setDemands] = useState<DemandResponse[]>([]);
  const [matches, setMatches] = useState<MatchResponse[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [toastErr, setToastErr] = useState(false);
  const [loadErr, setLoadErr] = useState(false);
  const flash = useCallback((msg: string, isErr = false) => {
    setToast(msg);
    setToastErr(isErr);
    setTimeout(() => setToast(null), isErr ? 6000 : 3500);
  }, []);

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
    setLoadErr(d.status === "rejected" || m.status === "rejected");
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  const openDemands = demands.filter((d) => d.status === "open");
  const openMatchCount = matches.filter((m) => m.status === "proposed" || m.status === "offered").length;
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

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_DEMAND);
  }

  function startEdit(d: DemandResponse) {
    setEditingId(d.id);
    setForm({
      crop: d.crop,
      quantity_kg: d.quantity_kg,
      quality_spec: d.quality_spec,
      quality_grade_min: d.quality_grade_min ?? null,
      price_band_min: d.price_band_min,
      price_band_max: d.price_band_max,
      delivery_window: d.delivery_window,
      delivery_district: d.delivery_district ?? "",
    });
    document.getElementById("create-demand")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleWithdraw(d: DemandResponse) {
    if (!token || !window.confirm(td("withdrawConfirm"))) return;
    try {
      await withdrawDemand(d.id, token);
      flash(td("withdrawn"));
      if (editingId === d.id) resetForm();
      loadData();
    } catch (err) {
      flash(err instanceof ApiError ? err.message : td("errorGeneric"), true);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        delivery_district: form.delivery_district?.trim() || user?.district || null,
      };
      if (editingId !== null) {
        const { crop: _c, ...patch } = payload;
        await updateDemand(editingId, patch, token);
        flash(td("updated"));
      } else {
        await createDemand(payload, token);
        flash(td("success"));
      }
      resetForm();
      loadData();
    } catch (err) {
      flash(err instanceof ApiError ? err.message : td("errorGeneric"), true);
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

      <OnboardingChecklist
        role="buyer"
        hasLocation={!!user?.district}
        hasListing={demands.length > 0}
        hasMatch={matches.length > 0}
      />

      <QuickActions
        actions={[
          { label: tq("postDemand"), icon: "handshake", href: "#create-demand", accent: true },
          {
            label: tq("viewMatches"),
            icon: "connection",
            href: "/matches",
            badge: openMatchCount,
            accent: openMatchCount > 0,
          },
          { label: tq("browseLots"), icon: "leaf", href: "/browse" },
          { label: tq("checkPrices"), icon: "chart", href: "/prices" },
        ]}
      />

      <StatCards stats={stats} />

      {loadErr && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--red-600)]/25 bg-[var(--red-100)] px-5 py-3 text-sm font-semibold text-[var(--red-700)]">
          <span className="flex items-center gap-2"><Icon name="close" size={16} /> {tc("error")}</span>
          <button type="button" onClick={() => loadData()} className="rounded-lg border border-[var(--red-500)]/40 bg-white px-3 py-1 text-xs font-bold">
            {tc("retry")}
          </button>
        </div>
      )}

      {toast && (
        <div
          className={`flex items-center gap-3 rounded-2xl border px-5 py-4 text-sm font-bold ${
            toastErr
              ? "border-[var(--red-500)]/30 bg-[var(--red-100)] text-[var(--red-700)]"
              : "border-[var(--green-600)]/30 bg-[var(--green-100)] text-[var(--green-700)]"
          }`}
        >
          <Icon name={toastErr ? "alert" : "check"} size={18} />
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
            <h2 className="font-heading text-base font-bold text-[var(--ink)]">
              {editingId !== null ? td("editTitle") : td("createTitle")}
            </h2>
            <p className="text-xs text-[var(--ink-soft)]">{tdash("createDemandHint")}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            { key: "crop" as keyof DemandCreate, label: td("cropLabel"), type: "text", placeholder: td("cropPlaceholder"), required: true, min: undefined as string | undefined, disabled: editingId !== null },
            { key: "quantity_kg" as keyof DemandCreate, label: td("quantityLabel"), type: "number", required: true, min: "1" },
            { key: "price_band_min" as keyof DemandCreate, label: td("priceMinLabel"), type: "number", required: true, min: "1" },
            { key: "price_band_max" as keyof DemandCreate, label: td("priceMaxLabel"), type: "number", required: true, min: "1" },
          ].map((field) => (
            <label key={field.key} className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--ink)]">
              {field.label}
              <input
                type={field.type}
                value={(form[field.key] as string | number) || ""}
                onChange={(e) => setForm({ ...form, [field.key]: field.type === "number" ? parseFloat(e.target.value) : e.target.value })}
                placeholder={"placeholder" in field ? field.placeholder as string : undefined}
                required={field.required}
                min={field.min}
                step={field.type === "number" ? "any" : undefined}
                disabled={field.disabled}
                className="rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm font-normal focus:border-[var(--green-600)] focus:outline-none transition-colors disabled:bg-[var(--paper)] disabled:text-[var(--ink-soft)]"
              />
            </label>
          ))}
          
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--ink)]">
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
            {td("minGradeLabel")}
            <select
              value={form.quality_grade_min ?? ""}
              onChange={(e) => setForm({ ...form, quality_grade_min: e.target.value || null })}
              className="rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm font-normal focus:border-[var(--green-600)] focus:outline-none"
            >
              <option value="">{td("minGradeAny")}</option>
              <option value="A">A — {td("gradeADesc")}</option>
              <option value="B">B — {td("gradeBDesc")}</option>
              <option value="FAQ">FAQ — {td("gradeFaqDesc")}</option>
              <option value="C">C — {td("gradeCDesc")}</option>
            </select>
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

          <div className="flex flex-wrap gap-3 sm:col-span-2 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-xl bg-[var(--green-700)] px-6 py-3 font-bold text-white shadow-md shadow-green-900/20 transition hover:bg-[var(--green-900)] disabled:opacity-60"
            >
              <Icon name="handshake" size={18} />
              {submitting
                ? editingId !== null ? td("saving") : td("submitting")
                : editingId !== null ? td("saveChanges") : td("submit")}
            </button>
            {editingId !== null && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-[var(--line)] px-5 py-3 font-bold text-[var(--ink)] transition hover:bg-[var(--paper)]"
              >
                {td("cancelEdit")}
              </button>
            )}
          </div>
        </form>
      </section>

      {/* My demands */}
      <section className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-heading text-base font-bold text-[var(--ink)]">
          {td("myDemandsTitle")}
          {demands.length > 0 && (
            <span className="ml-2 rounded-full bg-[var(--green-100)] px-2 py-0.5 text-xs font-bold text-[var(--green-700)]">
              {demands.length}
            </span>
          )}
        </h2>
        {demands.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--line)] py-10 text-center">
            <Icon name="handshake" size={28} className="text-[var(--green-400)]" />
            <p className="text-sm text-[var(--ink-soft)]">{td("noDemands")}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {demands.map((d) => (
              <li
                key={d.id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-[var(--paper)] p-4 ${
                  editingId === d.id ? "border-[var(--green-600)]" : "border-[var(--line)]"
                }`}
              >
                <div className="min-w-0">
                  <span className="font-bold text-[var(--ink)]">{d.crop}</span>
                  <div className="mt-0.5 text-xs text-[var(--ink-soft)]">
                    {(d.quantity_kg / 100).toFixed(2)} qtl · ₹{d.price_band_min}–{d.price_band_max}/qtl · {d.delivery_window}
                  </div>
                  <div className="text-xs text-[var(--ink-soft)]/70">
                    {d.delivery_district || "—"}{d.quality_grade_min ? ` · min ${d.quality_grade_min}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {d.status === "open" && (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(d)}
                        className="rounded-lg border border-[var(--line)] px-3 py-1 text-xs font-bold text-[var(--ink)] transition hover:bg-white"
                      >
                        {td("edit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleWithdraw(d)}
                        className="rounded-lg border border-[var(--red-500)]/40 px-3 py-1 text-xs font-bold text-[var(--red-600)] transition hover:bg-[var(--red-100)]"
                      >
                        {td("withdraw")}
                      </button>
                    </>
                  )}
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                    d.status === "open"
                      ? "bg-[var(--green-100)] text-[var(--green-700)]"
                      : "bg-[var(--line)] text-[var(--ink-soft)]"
                  }`}>
                    {d.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
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

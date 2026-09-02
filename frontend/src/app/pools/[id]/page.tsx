"use client";

/**
 * Pool detail (v1.3) — aggregate position, members, join / withdraw, and
 * (organizer only) the ranked list of matching buyer demands.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/AuthProvider";
import { PageHeader } from "@/components/PageHeader";
import { Icon } from "@/components/ui";
import {
  acceptDemandForPool,
  getPool,
  joinPool,
  setPoolStatus,
  withdrawPool,
  type PoolDetail,
  type PoolDemandCandidate,
} from "@/lib/api";

const TIER_STYLE: Record<string, string> = {
  strong: "bg-[var(--green-100)] text-[var(--green-700)]",
  good: "bg-[var(--green-100)] text-[var(--green-700)]",
  fair: "bg-[var(--amber-100)] text-[var(--amber-700)]",
  weak: "bg-[var(--line)] text-[var(--ink-soft)]",
};

function CandidateRow({
  c,
  canAccept,
  busy,
  onAccept,
}: {
  c: PoolDemandCandidate;
  canAccept: boolean;
  busy: boolean;
  onAccept: (demandId: number) => void;
}) {
  const t = useTranslations("pools");
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[var(--ink)]">{c.buyer_name}</span>
          {c.buyer_kyc === "verified" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--green-100)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--green-700)]">
              <Icon name="check" size={10} />
            </span>
          )}
        </div>
        <div className="mt-0.5 text-xs font-medium text-[var(--ink-soft)]">
          {Math.round(c.quantity_kg)} kg · ₹{Math.round(c.price_band_min)}–{Math.round(c.price_band_max)}/qtl
          {" · "}{c.buyer_district}
          {c.delivery_window ? ` · ${c.delivery_window}` : ""}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${TIER_STYLE[c.tier] ?? TIER_STYLE.weak}`}>
          {t("scoreLabel")} {Math.round(c.score)}%
        </span>
        {canAccept && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onAccept(c.demand_id)}
            className="rounded-lg bg-[var(--green-700)] px-3 py-1.5 text-xs font-bold text-white hover:bg-[var(--green-900)] disabled:opacity-60"
          >
            {t("acceptDemand")}
          </button>
        )}
      </div>
    </li>
  );
}

export default function PoolDetailPage() {
  const params = useParams<{ id: string }>();
  const poolId = Number(params?.id);
  const { isAuthenticated, ready, user, token } = useAuth();
  const router = useRouter();
  const t = useTranslations("pools");

  const [pool, setPool] = useState<PoolDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) router.replace("/login");
    else if (user?.role === "buyer") router.replace("/buyer");
    else if (user?.role === "admin") router.replace("/admin");
  }, [ready, isAuthenticated, user, router]);

  const load = useCallback(async () => {
    if (!token || !Number.isFinite(poolId)) return;
    try {
      const p = await getPool(poolId, token);
      setPool(p);
      if (p.my_membership) {
        setQty(String(p.my_membership.quantity_kg));
        setPrice(String(p.my_membership.expected_price));
      } else if (!price) {
        setPrice(String(Math.round(p.floor_price)));
      }
    } catch {
      setPool(null);
    } finally {
      setLoading(false);
    }
  }, [token, poolId]);

  useEffect(() => { load(); }, [load]);

  async function doJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    try {
      await joinPool(poolId, { quantity_kg: parseFloat(qty), expected_price: parseFloat(price) }, token);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function doWithdraw() {
    if (!token) return;
    setBusy(true);
    try {
      await withdrawPool(poolId, token);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(next: PoolDetail["status"]) {
    if (!token) return;
    setBusy(true);
    try {
      await setPoolStatus(poolId, next, token);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function acceptDemand(demandId: number) {
    if (!token) return;
    setBusy(true);
    try {
      const r = await acceptDemandForPool(poolId, { demand_id: demandId }, token);
      router.push(`/deals/${r.deal_id}`);
    } catch {
      setBusy(false);
    }
  }

  if (!ready || !isAuthenticated) return null;

  if (loading) {
    return <div className="h-64 w-full animate-pulse rounded-2xl bg-white/50" />;
  }
  if (!pool) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/pools" className="text-sm font-semibold text-[var(--green-700)] hover:underline">← {t("backToPools")}</Link>
        <p className="text-sm text-[var(--ink-soft)]">{t("noPools")}</p>
      </div>
    );
  }

  const agg = pool.aggregate;
  const isMember = pool.my_membership?.status === "committed";
  const canJoin = pool.status === "open";

  return (
    <div className="flex flex-col gap-6">
      <Link href="/pools" className="text-sm font-semibold text-[var(--green-700)] hover:underline">← {t("backToPools")}</Link>

      <PageHeader
        icon="coins"
        title={pool.title}
        subtitle={`${pool.crop} · ${pool.location || "—"} · ${t(`status_${pool.status}` as "status_open")}`}
      />

      {pool.status === "matched" && pool.matched_deal_id && (
        <Link
          href={`/deals/${pool.matched_deal_id}`}
          className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--green-600)]/40 bg-[var(--green-100)] px-5 py-4 text-sm font-bold text-[var(--green-700)] hover:bg-[var(--green-100)]/70"
        >
          <span className="flex items-center gap-2"><Icon name="check" size={16} /> {t("poolMatched")}</span>
          <span className="underline">{t("viewDeal")} →</span>
        </Link>
      )}

      {pool.is_organizer && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--green-600)]/30 bg-[var(--green-100)] px-5 py-4">
          <span className="text-sm font-bold text-[var(--green-700)]">{t("organizerBadge")}</span>
          <div className="flex flex-wrap gap-2">
            {pool.status === "open" && (
              <button type="button" disabled={busy} onClick={() => changeStatus("locked")}
                className="rounded-lg bg-[var(--green-700)] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">
                {t("lockPool")}
              </button>
            )}
            {pool.status === "locked" && (
              <button type="button" disabled={busy} onClick={() => changeStatus("open")}
                className="rounded-lg border border-[var(--green-700)] px-3 py-1.5 text-xs font-bold text-[var(--green-700)] disabled:opacity-60">
                {t("reopenPool")}
              </button>
            )}
            {pool.status !== "closed" && (
              <button type="button" disabled={busy} onClick={() => changeStatus("closed")}
                className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-bold text-[var(--ink-soft)] disabled:opacity-60">
                {t("closePool")}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Aggregate position */}
      <section className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-heading text-base font-bold text-[var(--ink)]">{t("aggregate")}</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            [t("aggQty"), `${Math.round(agg.quantity_kg)} kg`],
            [t("aggPrice"), `₹${Math.round(agg.effective_price)}`],
            [t("aggFloor"), `₹${Math.round(agg.floor_price)}`],
            [t("aggFill"), `${Math.round(agg.fill_pct)}%`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-[var(--paper)] p-3 text-center">
              <div className="font-heading text-lg font-bold text-[var(--green-700)]">{value}</div>
              <div className="text-[11px] font-medium text-[var(--ink-soft)]">{label}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--line)]">
          <div className="h-full rounded-full bg-[var(--green-600)]" style={{ width: `${Math.min(100, agg.fill_pct)}%` }} />
        </div>
      </section>

      {/* Join / withdraw */}
      {user?.role === "farmer" && (
        <section className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          {isMember && (
            <p className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--green-700)]">
              <Icon name="check" size={16} /> {t("joined")}
            </p>
          )}
          {canJoin ? (
            <form onSubmit={doJoin} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--ink)]">
                {t("myQty")}
                <input required type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)}
                  className="rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm font-normal focus:border-[var(--green-600)] focus:outline-none" />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--ink)]">
                {t("myPrice")}
                <input required type="number" min="1" value={price} onChange={(e) => setPrice(e.target.value)}
                  className="rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm font-normal focus:border-[var(--green-600)] focus:outline-none" />
              </label>
              <div className="flex items-end gap-2">
                <button type="submit" disabled={busy}
                  className="flex-1 rounded-xl bg-[var(--green-700)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                  {isMember ? t("updateCommitment") : t("join")}
                </button>
                {isMember && (
                  <button type="button" disabled={busy} onClick={doWithdraw}
                    className="rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm font-bold text-[var(--ink-soft)] disabled:opacity-60">
                    {t("withdraw")}
                  </button>
                )}
              </div>
            </form>
          ) : (
            <p className="text-sm text-[var(--ink-soft)]">{t(`status_${pool.status}` as "status_open")}</p>
          )}
        </section>
      )}

      {/* Members */}
      <section className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-heading text-base font-bold text-[var(--ink)]">{t("memberList")}</h2>
        <ul className="flex flex-col gap-2">
          {pool.member_list.filter((m) => m.status === "committed").map((m) => (
            <li key={m.id} className="flex items-center justify-between rounded-xl bg-[var(--paper)] px-4 py-2.5 text-sm">
              <span className="font-medium text-[var(--ink)]">{m.farmer_name ?? `#${m.farmer_id}`}</span>
              <span className="text-xs font-semibold text-[var(--ink-soft)]">
                {Math.round(m.quantity_kg)} kg · ₹{Math.round(m.expected_price)}/qtl
              </span>
            </li>
          ))}
          {pool.member_list.filter((m) => m.status === "committed").length === 0 && (
            <li className="text-sm text-[var(--ink-soft)]">{t("members", { count: 0 })}</li>
          )}
        </ul>
      </section>

      {/* Matching buyers (organizer only) */}
      {pool.is_organizer && (
        <section className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <h2 className="mb-1 font-heading text-base font-bold text-[var(--ink)]">{t("candidates")}</h2>
          <p className="mb-4 text-xs text-[var(--ink-soft)]">{t("candidatesHint")}</p>
          {pool.candidates.length === 0 ? (
            <p className="text-sm text-[var(--ink-soft)]">{t("noCandidates")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {pool.candidates.map((c) => (
                <CandidateRow
                  key={c.demand_id}
                  c={c}
                  canAccept={(pool.status === "open" || pool.status === "locked") && agg.quantity_kg > 0}
                  busy={busy}
                  onAccept={acceptDemand}
                />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

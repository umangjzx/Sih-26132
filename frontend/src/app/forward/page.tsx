"use client";

/**
 * Forward contracts (v1.6) — pre-harvest market linkage.
 * Buyers post forward bids; farmers commit part of a growing crop at a locked
 * price. Client component (Cordova constraint).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { useAuth } from "@/components/AuthProvider";
import { PageHeader } from "@/components/PageHeader";
import { Card, Icon, Skeleton } from "@/components/ui";
import { useLocation } from "@/lib/useLocation";
import {
  ApiError,
  actOnCommitment,
  commitToForwardBid,
  createForwardBid,
  listForwardBids,
  setForwardBidStatus,
  type ForwardBid,
} from "@/lib/api";

function pctBar(pct: number) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--line)]">
      <div
        className="h-full rounded-full bg-[var(--green-600)]"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: "bg-[var(--green-100)] text-[var(--green-700)]",
    filled: "bg-[var(--green-200)] text-[var(--green-900)]",
    closed: "bg-[var(--line)] text-[var(--ink-soft)]",
    cancelled: "bg-[var(--red-100)] text-[var(--red-700)]",
    pending: "bg-[var(--amber-100)] text-[var(--amber-800)]",
    accepted: "bg-[var(--green-100)] text-[var(--green-700)]",
    declined: "bg-[var(--red-100)] text-[var(--red-700)]",
    withdrawn: "bg-[var(--line)] text-[var(--ink-soft)]",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${map[status] ?? "bg-[var(--line)]"}`}>
      {status}
    </span>
  );
}

// --------------------------------------------------------------------------- //
// Buyer: create form
// --------------------------------------------------------------------------- //

function BuyerCreateForm({ token, onDone }: { token: string; onDone: () => void }) {
  const t = useTranslations("forward");
  const [f, setF] = useState({
    crop: "", quantity_kg: "", price_min: "", price_max: "",
    delivery_from: "", delivery_to: "", quality_grade_min: "FAQ", notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await createForwardBid(
        {
          crop: f.crop.trim(),
          quantity_kg: Number(f.quantity_kg),
          price_min: Number(f.price_min),
          price_max: Number(f.price_max),
          delivery_from: f.delivery_from,
          delivery_to: f.delivery_to,
          quality_grade_min: f.quality_grade_min || null,
          notes: f.notes || null,
        },
        token,
      );
      setF({ crop: "", quantity_kg: "", price_min: "", price_max: "", delivery_from: "", delivery_to: "", quality_grade_min: "FAQ", notes: "" });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("createError"));
    } finally {
      setBusy(false);
    }
  }

  const input = "rounded-xl border border-[var(--line)] px-3 py-2 text-sm focus:border-[var(--green-600)] focus:outline-none";
  return (
    <Card>
      <h2 className="mb-3 flex items-center gap-2 font-heading text-base font-bold text-[var(--ink)]">
        <Icon name="calendar" size={18} className="text-[var(--green-600)]" /> {t("postBid")}
      </h2>
      <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t("crop")}
          <input className={input} required value={f.crop} onChange={(e) => setF({ ...f, crop: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t("quantityKg")}
          <input className={input} type="number" min="1" required value={f.quantity_kg} onChange={(e) => setF({ ...f, quantity_kg: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t("priceMin")}
          <input className={input} type="number" min="1" required value={f.price_min} onChange={(e) => setF({ ...f, price_min: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t("priceMax")}
          <input className={input} type="number" min="1" required value={f.price_max} onChange={(e) => setF({ ...f, price_max: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t("deliveryFrom")}
          <input className={input} type="date" required value={f.delivery_from} onChange={(e) => setF({ ...f, delivery_from: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t("deliveryTo")}
          <input className={input} type="date" required value={f.delivery_to} onChange={(e) => setF({ ...f, delivery_to: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t("minGrade")}
          <select className={input} value={f.quality_grade_min} onChange={(e) => setF({ ...f, quality_grade_min: e.target.value })}>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="FAQ">FAQ</option>
            <option value="C">C</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">
          {t("notes")}
          <textarea className={input} rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder={t("notesPlaceholder")} />
        </label>
        {err && <p className="text-sm text-[var(--red-600)] sm:col-span-2">{err}</p>}
        <div className="sm:col-span-2">
          <button type="submit" disabled={busy} className="w-full rounded-xl bg-[var(--green-700)] px-6 py-3 font-bold text-white transition hover:bg-[var(--green-900)] disabled:opacity-60">
            {busy ? t("posting") : t("postBid")}
          </button>
        </div>
      </form>
    </Card>
  );
}

// --------------------------------------------------------------------------- //
// Buyer: own bid card with commitments
// --------------------------------------------------------------------------- //

function BuyerBidCard({ bid, token, onChange }: { bid: ForwardBid; token: string; onChange: () => void }) {
  const t = useTranslations("forward");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function act(id: number, action: "accept" | "decline") {
    if (action === "accept" && !window.confirm(t("confirmAccept"))) return;
    setBusyId(id);
    setErr(null);
    try {
      await actOnCommitment(id, action, token);
      onChange();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t("actionError"));
    } finally {
      setBusyId(null);
    }
  }

  async function closeBid() {
    setErr(null);
    try {
      await setForwardBidStatus(bid.id, "closed", token);
      onChange();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t("actionError"));
    }
  }

  const pending = (bid.commitments ?? []).filter((c) => c.status === "pending");
  const settled = (bid.commitments ?? []).filter((c) => c.status !== "pending");

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-heading text-lg font-bold text-[var(--ink)]">{bid.crop}</span>
            <StatusChip status={bid.status} />
          </div>
          <p className="mt-0.5 text-sm text-[var(--ink-soft)]">
            {(bid.quantity_kg / 100).toFixed(0)} qtl · ₹{bid.price_min}–{bid.price_max}/qtl · {bid.delivery_from} → {bid.delivery_to}
          </p>
        </div>
        {bid.status === "open" && (
          <button
            onClick={closeBid}
            className="rounded-lg border border-[var(--line)] px-3 py-1 text-xs font-bold text-[var(--ink-soft)] hover:bg-[var(--paper)]"
          >
            {t("closeBid")}
          </button>
        )}
      </div>

      {err && <p className="mt-2 text-xs font-semibold text-[var(--red-600)]">{err}</p>}

      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs font-semibold text-[var(--ink-soft)]">
          <span>{t("filled", { pct: bid.fill_pct })}</span>
          <span>{(bid.accepted_kg / 100).toFixed(0)} / {(bid.quantity_kg / 100).toFixed(0)} qtl</span>
        </div>
        {pctBar(bid.fill_pct)}
      </div>

      {pending.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)]">{t("pendingCommitments")}</p>
          {pending.map((c) => (
            <div key={c.id} className="rounded-xl border border-[var(--amber-500)]/25 bg-[var(--amber-100)]/30 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">
                  {c.farmer_name}
                  {c.farmer_verified && <Icon name="check" size={12} className="ml-1 inline text-[var(--green-600)]" />}
                  {" · "}{(c.quantity_kg / 100).toFixed(0)} qtl @ ₹{c.price_per_qtl}
                </span>
                <span className="text-xs text-[var(--ink-soft)]">{t("ready")}: {c.expected_ready}</span>
              </div>
              {c.calendar_warning && (
                <p className="mt-1 flex items-start gap-1 text-xs text-[var(--amber-800)]">
                  <Icon name="alert" size={12} className="mt-0.5 shrink-0" /> {c.calendar_warning}
                </p>
              )}
              {c.note && <p className="mt-1 text-xs italic text-[var(--ink-soft)]">&ldquo;{c.note}&rdquo;</p>}
              <div className="mt-2 flex gap-2">
                <button disabled={busyId === c.id} onClick={() => act(c.id, "accept")} className="flex-1 rounded-lg bg-[var(--green-700)] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">
                  {t("acceptCommitment")}
                </button>
                <button disabled={busyId === c.id} onClick={() => act(c.id, "decline")} className="flex-1 rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-bold text-[var(--ink)]">
                  {t("decline")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {settled.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5">
          {settled.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg bg-[var(--paper)] px-3 py-2 text-xs">
              <span>{c.farmer_name} · {(c.quantity_kg / 100).toFixed(0)} qtl @ ₹{c.price_per_qtl}</span>
              <span className="flex items-center gap-2">
                <StatusChip status={c.status} />
                {c.deal_id && <a href={`/deals/${c.deal_id}`} className="font-bold text-[var(--green-700)] hover:underline">{t("viewDeal")}</a>}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// --------------------------------------------------------------------------- //
// Farmer: browse + commit
// --------------------------------------------------------------------------- //

function FarmerBidCard({ bid, token, onChange }: { bid: ForwardBid; token: string; onChange: () => void }) {
  const t = useTranslations("forward");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ quantity_kg: "", price_per_qtl: "", expected_ready: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const mine = bid.my_commitment;
  const input = "rounded-xl border border-[var(--line)] px-3 py-2 text-sm focus:border-[var(--green-600)] focus:outline-none";

  async function commit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await commitToForwardBid(
        bid.id,
        {
          quantity_kg: Number(f.quantity_kg),
          price_per_qtl: Number(f.price_per_qtl),
          expected_ready: f.expected_ready,
          note: f.note || null,
        },
        token,
      );
      setOpen(false);
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("commitError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-heading text-lg font-bold text-[var(--ink)]">{bid.crop}</span>
            <StatusChip status={bid.status} />
          </div>
          <p className="mt-0.5 text-sm text-[var(--ink-soft)]">
            {bid.buyer_name}
            {bid.buyer_verified && <Icon name="check" size={12} className="ml-1 inline text-[var(--green-600)]" />}
            {bid.distance_km != null && ` · ${bid.distance_km} km`}
          </p>
        </div>
        <div className="text-right text-sm">
          <div className="font-bold text-[var(--green-800)]">₹{bid.price_min}–{bid.price_max}/qtl</div>
          <div className="text-xs text-[var(--ink-soft)]">{t("wants", { qty: (bid.remaining_kg / 100).toFixed(0) })}</div>
        </div>
      </div>

      <p className="mt-2 text-xs text-[var(--ink-soft)]">
        {t("deliver")}: {bid.delivery_from} → {bid.delivery_to}
        {bid.harvest_window && ` · ${t("harvestWindow")}: ${bid.harvest_window}`}
        {bid.quality_grade_min && ` · ${t("minGrade")} ${bid.quality_grade_min}`}
      </p>
      {bid.notes && <p className="mt-1 text-xs italic text-[var(--ink-soft)]">&ldquo;{bid.notes}&rdquo;</p>}

      <div className="mt-2">
        <div className="mb-1 text-xs font-semibold text-[var(--ink-soft)]">{t("filled", { pct: bid.fill_pct })}</div>
        {pctBar(bid.fill_pct)}
      </div>

      {mine ? (
        <div className="mt-3 rounded-xl bg-[var(--green-50)] p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-semibold">
              {t("yourCommitment")}: {(mine.quantity_kg / 100).toFixed(0)} qtl @ ₹{mine.price_per_qtl}
            </span>
            <StatusChip status={mine.status} />
          </div>
          {mine.calendar_warning && (
            <p className="mt-1 flex items-start gap-1 text-xs text-[var(--amber-800)]">
              <Icon name="alert" size={12} className="mt-0.5 shrink-0" /> {mine.calendar_warning}
            </p>
          )}
          {mine.status === "pending" && (
            <button
              onClick={async () => {
                setErr(null);
                try {
                  await actOnCommitment(mine.id, "withdraw", token);
                  onChange();
                } catch (e) {
                  setErr(e instanceof ApiError ? e.message : t("actionError"));
                }
              }}
              className="mt-2 rounded-lg border border-[var(--line)] px-3 py-1 text-xs font-bold text-[var(--ink-soft)] hover:bg-white"
            >
              {t("withdraw")}
            </button>
          )}
          {err && <p className="mt-2 text-xs font-semibold text-[var(--red-600)]">{err}</p>}
          {mine.status === "accepted" && mine.deal_id && (
            <a href={`/deals/${mine.deal_id}`} className="mt-2 inline-block text-xs font-bold text-[var(--green-700)] hover:underline">
              {t("viewDeal")} →
            </a>
          )}
        </div>
      ) : bid.status === "open" && !open ? (
        <button
          onClick={() => { setOpen(true); setF((s) => ({ ...s, price_per_qtl: String(Math.round((bid.price_min + bid.price_max) / 2)) })); }}
          className="mt-3 w-full rounded-xl bg-[var(--green-700)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--green-900)]"
        >
          {t("commit")}
        </button>
      ) : open ? (
        <form onSubmit={commit} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-semibold">
            {t("quantityKg")}
            <input className={input} type="number" min="1" required value={f.quantity_kg} onChange={(e) => setF({ ...f, quantity_kg: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            {t("pricePerQtl")} (₹{bid.price_min}–{bid.price_max})
            <input className={input} type="number" min={bid.price_min} max={bid.price_max} required value={f.price_per_qtl} onChange={(e) => setF({ ...f, price_per_qtl: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold sm:col-span-2">
            {t("expectedReady")}
            <input className={input} type="date" required value={f.expected_ready} onChange={(e) => setF({ ...f, expected_ready: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold sm:col-span-2">
            {t("note")}
            <input className={input} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          </label>
          {err && <p className="text-xs text-[var(--red-600)] sm:col-span-2">{err}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={busy} className="flex-1 rounded-xl bg-[var(--green-700)] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
              {busy ? t("committing") : t("confirmCommit")}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-[var(--line)] px-4 py-2 text-sm font-bold text-[var(--ink)]">
              {t("cancel")}
            </button>
          </div>
        </form>
      ) : null}
    </Card>
  );
}

// --------------------------------------------------------------------------- //

export default function ForwardPage() {
  const { user, token, isAuthenticated, ready } = useAuth();
  const router = useRouter();
  const t = useTranslations("forward");
  const { location } = useLocation();
  const [bids, setBids] = useState<ForwardBid[]>([]);
  const [loading, setLoading] = useState(true);

  const isBuyer = user?.role === "buyer";

  useEffect(() => {
    if (ready && !isAuthenticated) router.replace("/login");
    else if (ready && user && user.role !== "farmer" && user.role !== "buyer") router.replace("/");
  }, [ready, isAuthenticated, user, router]);

  const load = useCallback(async () => {
    if (!token || !user) return;
    setLoading(true);
    try {
      if (user.role === "buyer") {
        const own = await listForwardBids(token, { mine: true });
        const detailed = await Promise.all(own.map((b) => import("@/lib/api").then((m) => m.getForwardBid(b.id, token))));
        setBids(detailed);
      } else {
        setBids(await listForwardBids(token, { lat: location?.lat ?? undefined, lon: location?.lon ?? undefined }));
      }
    } catch {
      setBids([]);
    } finally {
      setLoading(false);
    }
  }, [token, user, location?.lat, location?.lon]);

  useEffect(() => { load(); }, [load]);

  const sorted = useMemo(
    () => [...bids].sort((a, b) => (a.status === "open" ? -1 : 1) - (b.status === "open" ? -1 : 1)),
    [bids],
  );

  if (!ready || !isAuthenticated || !user) return null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon="calendar" title={t("title")} subtitle={t("subtitle")} />

      {isBuyer && token && <BuyerCreateForm token={token} onDone={load} />}

      {loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : sorted.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--ink-soft)]">{isBuyer ? t("noOwnBids") : t("noOpenBids")}</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {sorted.map((bid) =>
            isBuyer ? (
              <BuyerBidCard key={bid.id} bid={bid} token={token!} onChange={load} />
            ) : (
              <FarmerBidCard key={bid.id} bid={bid} token={token!} onChange={load} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

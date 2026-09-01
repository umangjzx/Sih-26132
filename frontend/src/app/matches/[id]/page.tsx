"use client";

/**
 * Offer thread page for a specific match.
 *
 * OFFER-01: either party can make/counter offers
 * OFFER-02: accepting creates a deal; verified badge shown on counterparty
 * VERIFY-01: badge on counterparty based on kyc_status
 *
 * Uses useParams() to read the dynamic [id] segment — correct for client components
 * in Next.js 16 App Router (params is a Promise only for async server components).
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/AuthProvider";
import {
  acceptOffer,
  declineOffer,
  getMatchById,
  getMatchOffers,
  postOffer,
  type DealResponse,
  type MatchResponse,
  type OfferResponse,
} from "@/lib/api";

export default function MatchThreadPage() {
  const { user, token, isAuthenticated } = useAuth();
  const router = useRouter();
  const params = useParams();
  const matchId = Number(params.id);
  const t = useTranslations("matching");

  const [match, setMatch] = useState<MatchResponse | null>(null);
  const [offers, setOffers] = useState<OfferResponse[]>([]);
  const [deal, setDeal] = useState<DealResponse | null>(null);
  const [offerPrice, setOfferPrice] = useState("");
  const [offerQty, setOfferQty] = useState("");
  const [offerMsg, setOfferMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) router.replace("/login");
  }, [isAuthenticated, router]);

  const load = useCallback(async () => {
    if (!token || !matchId) return;
    const [m, o] = await Promise.allSettled([
      getMatchById(matchId, token),
      getMatchOffers(matchId, token),
    ]);
    if (m.status === "fulfilled") setMatch(m.value);
    if (o.status === "fulfilled") setOffers(o.value);
  }, [token, matchId]);

  useEffect(() => { load(); }, [load]);

  async function handleOffer(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    try {
      await postOffer(matchId, { price: parseFloat(offerPrice), quantity: parseFloat(offerQty), message: offerMsg || null }, token);
      setOfferPrice(""); setOfferQty(""); setOfferMsg("");
      load();
    } catch { /* display error in future */ }
    finally { setSubmitting(false); }
  }

  async function handleAccept(offerId: number) {
    if (!token) return;
    try {
      const d = await acceptOffer(offerId, token);
      setDeal(d);
      setToast(t("dealCreated", { price: d.agreed_price, qty: d.agreed_quantity }));
      load();
    } catch { /* non-fatal */ }
  }

  async function handleDecline(offerId: number) {
    if (!token) return;
    try {
      await declineOffer(offerId, token);
      setToast(t("offerDeclined"));
      setTimeout(() => setToast(null), 3000);
      load();
    } catch { /* non-fatal */ }
  }

  if (!isAuthenticated || !user) return null;

  const cp = match?.counterparty;
  // Determine if current user is farmer or buyer from this match
  const isFarmer = match ? match.lot.farmer_id === user.id : false;

  // Can the current user make an offer? Only if match is open and no pending offer from them
  const myPendingOffer = offers.find(
    (o) => o.from_user_id === user.id && o.status === "pending"
  );
  const matchOpen = match && ["proposed", "offered"].includes(match.status);
  const canOffer = matchOpen && !myPendingOffer && !deal;

  return (
    <div className="flex flex-col gap-6">
      {/* Match header */}
      {match && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h1 className="mb-1 text-lg font-bold">{t("offerThreadTitle")}</h1>
          <p className="text-sm opacity-70">
            {match.lot.crop} · {match.lot.quantity_kg} kg · ₹{match.lot.expected_price}/quintal
          </p>
          {cp && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm">{cp.name}</span>
              {cp.kyc_status === "verified" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-sell)] bg-opacity-10 px-2 py-0.5 text-xs font-medium text-[var(--color-sell)]">
                  ✓ {isFarmer ? t("verifiedBuyer") : t("verifiedFarmer")}
                </span>
              )}
            </div>
          )}
          <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
            match.status === "accepted"
              ? "bg-[var(--color-sell)] bg-opacity-10 text-[var(--color-sell)]"
              : "bg-[var(--color-border)] text-[var(--color-text)] opacity-70"
          }`}>
            {t(`status_${match.status}` as "status_accepted")}
          </span>
        </div>
      )}

      {/* Deal banner */}
      {(deal || match?.status === "accepted") && (
        <div className="rounded-md bg-[var(--color-sell)] bg-opacity-10 border border-[var(--color-sell)] px-4 py-3 text-sm font-medium text-[var(--color-sell)]">
          {toast ?? t("offerAccepted")}
        </div>
      )}

      {/* Toast */}
      {toast && match?.status !== "accepted" && (
        <div className="rounded-md bg-[var(--color-sell)] bg-opacity-10 border border-[var(--color-sell)] px-4 py-3 text-sm text-[var(--color-sell)]">
          {toast}
        </div>
      )}

      {/* Offer thread */}
      <section>
        <h2 className="mb-3 text-base font-semibold">{t("offerThreadTitle")}</h2>
        {offers.length === 0 ? (
          <p className="text-sm opacity-60">{t("noMatches")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {offers.map((offer) => {
              const isMe = offer.from_user_id === user.id;
              return (
                <li key={offer.id}
                  className={`flex flex-col gap-2 rounded-xl border p-4 ${
                    isMe
                      ? "border-[var(--color-brand)] bg-[var(--color-brand)] bg-opacity-5"
                      : "border-[var(--color-border)] bg-[var(--color-surface)]"
                  }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">
                      {isMe ? t("youLabel") : (cp?.name ?? "—")} · ₹{offer.price}/quintal · {offer.quantity} kg
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${
                      offer.status === "accepted" ? "bg-[var(--color-sell)] bg-opacity-10 text-[var(--color-sell)]" :
                      offer.status === "pending" ? "bg-[var(--color-accent)] bg-opacity-10 text-[var(--color-accent)]" :
                      "opacity-50"
                    }`}>
                      {t(`offer_${offer.status}` as "offer_pending")}
                    </span>
                  </div>
                  {offer.message && (
                    <p className="text-sm opacity-70">{offer.message}</p>
                  )}
                  {/* Accept/decline buttons — shown to the other party on pending offers */}
                  {offer.status === "pending" && !isMe && match?.status !== "accepted" && (
                    <div className="flex gap-2">
                      <button onClick={() => handleAccept(offer.id)}
                        className="rounded-md bg-[var(--color-sell)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity">
                        {t("accept")}
                      </button>
                      <button onClick={() => handleDecline(offer.id)}
                        className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--color-border)] transition-colors">
                        {t("decline")}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Make offer form */}
      {canOffer && (
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h2 className="mb-3 text-base font-semibold">{t("makeOffer")}</h2>
          <form onSubmit={handleOffer} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t("offerPriceLabel")}
              <input type="number" min="1" value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)}
                required className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t("offerQuantityLabel")}
              <input type="number" min="1" value={offerQty} onChange={(e) => setOfferQty(e.target.value)}
                required className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
              {t("offerMessageLabel")}
              <textarea value={offerMsg} onChange={(e) => setOfferMsg(e.target.value)} rows={2}
                className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm resize-none" />
            </label>
            <div className="sm:col-span-2">
              <button type="submit" disabled={submitting}
                className="rounded-md bg-[var(--color-brand)] px-5 py-2.5 font-semibold text-white hover:bg-[var(--color-brand-dark)] disabled:opacity-60 transition-colors">
                {submitting ? t("submittingOffer") : t("submitOffer")}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}

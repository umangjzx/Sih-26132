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

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/AuthProvider";
import { PageHeader } from "@/components/PageHeader";
import { Icon } from "@/components/ui";
import {
  acceptOffer,
  declineOffer,
  fetchNegotiationContext,
  getMatchById,
  getMatchOffers,
  postOffer,
  type DealResponse,
  type MatchResponse,
  type NegotiationContext,
  type OfferResponse,
} from "@/lib/api";

export default function MatchThreadPage() {
  const { user, token, isAuthenticated, ready } = useAuth();
  const router = useRouter();
  const params = useParams();
  const matchId = Number(params.id);
  const t = useTranslations("matching");

  const [match, setMatch] = useState<MatchResponse | null>(null);
  const [offers, setOffers] = useState<OfferResponse[]>([]);
  const [deal, setDeal] = useState<DealResponse | null>(null);
  const [nego, setNego] = useState<NegotiationContext | null>(null);
  const [offerPrice, setOfferPrice] = useState("");
  const [offerQty, setOfferQty] = useState("");
  const [offerMsg, setOfferMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ready && !isAuthenticated) router.replace("/login");
  }, [ready, isAuthenticated, router]);

  const load = useCallback(async () => {
    if (!token || !matchId) return;
    const [m, o, n] = await Promise.allSettled([
      getMatchById(matchId, token),
      getMatchOffers(matchId, token),
      fetchNegotiationContext(matchId, token),
    ]);
    if (m.status === "fulfilled") setMatch(m.value);
    if (o.status === "fulfilled") setOffers(o.value);
    setNego(n.status === "fulfilled" ? n.value : null);
  }, [token, matchId]);

  function startCounter(price: number, qty: number) {
    setOfferPrice(String(price));
    setOfferQty(String(qty));
    requestAnimationFrame(() =>
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  }

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

  if (!ready || !isAuthenticated || !user) return null;
  
  if (!match) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-24 w-full animate-pulse rounded-2xl bg-white/50" />
        <div className="h-64 w-full animate-pulse rounded-2xl bg-white/50" />
      </div>
    );
  }

  const cp = match.counterparty;
  const isFarmer = match.lot.farmer_id === user.id;

  const myPendingOffer = offers.find(
    (o) => o.from_user_id === user.id && o.status === "pending"
  );
  const matchOpen = ["proposed", "offered"].includes(match.status);
  const canOffer = matchOpen && !myPendingOffer && !deal;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon="connection"
        title={t("offerThreadTitle")}
        subtitle={t("offerThreadSubtitle")}
      />

      {/* Match header */}
      <div className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="font-heading text-lg font-bold text-[var(--ink)]">{match.lot.crop}</h1>
            <p className="text-sm font-medium text-[var(--ink-soft)]">
              <span className="text-[var(--green-700)]">{match.lot.quantity_kg} kg</span> · ₹{match.lot.expected_price}/quintal
            </p>
          </div>
          
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest ${
            match.status === "accepted"
              ? "bg-[var(--green-100)] text-[var(--green-700)]"
              : "bg-[var(--line)] text-[var(--ink-soft)]"
          }`}>
            {match.status === "accepted" && <Icon name="check" size={14} />}
            {t(`status_${match.status}` as "status_accepted")}
          </span>
        </div>
        
        {cp && (
          <div className="mt-4 flex items-center gap-3 border-t border-[var(--line)] pt-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--green-700)] text-white">
              <span className="font-bold">{cp.name.charAt(0)}</span>
            </div>
            <div>
              <span className="font-bold text-[var(--ink)]">{cp.name}</span>
              {cp.kyc_status === "verified" && (
                <div className="flex items-center gap-1 text-[10px] font-bold text-[var(--green-600)] uppercase tracking-wider">
                  <Icon name="check" size={12} /> {isFarmer ? t("verifiedBuyer") : t("verifiedFarmer")}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Deal banner */}
      {(deal || match.status === "accepted") && (
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--green-600)]/30 bg-[var(--green-100)] px-5 py-4 text-sm font-bold text-[var(--green-700)]">
          <Icon name="handshake" size={20} />
          {toast ?? t("offerAccepted")}
        </div>
      )}

      {/* Toast */}
      {toast && match.status !== "accepted" && (
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--amber-600)]/30 bg-[var(--amber-100)] px-5 py-4 text-sm font-bold text-[var(--amber-800)]">
          <Icon name="bell" size={18} />
          {toast}
        </div>
      )}

      {/* Offer thread */}
      <section className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 font-heading text-base font-bold text-[var(--ink)]">
          <Icon name="clock" size={18} className="text-[var(--ink-soft)]" /> Negotiation History
        </h2>
        
        {offers.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--paper)] py-8 text-center">
            <Icon name="handshake" size={24} className="text-[var(--ink-soft)] opacity-50" />
            <p className="text-sm font-medium text-[var(--ink-soft)]">{t("noMatches")}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {offers.map((offer) => {
              const isMe = offer.from_user_id === user.id;
              return (
                <li key={offer.id}
                  className={`flex flex-col gap-3 rounded-2xl border p-5 shadow-sm transition-all ${
                    isMe
                      ? "ml-8 border-[var(--green-200)] bg-[var(--green-50)]"
                      : "mr-8 border-[var(--line)] bg-white"
                  }`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                        {isMe ? t("youLabel") : (cp?.name ?? "—")}
                      </span>
                      <span className={`font-bold text-lg ${isMe ? "text-[var(--green-900)]" : "text-[var(--ink)]"}`}>
                        ₹{offer.price}
                        <span className="text-sm font-medium opacity-60">/quintal</span>
                      </span>
                    </div>
                    
                    <div className="flex flex-col items-end gap-1">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                        offer.status === "accepted" ? "bg-[var(--green-200)] text-[var(--green-900)]" :
                        offer.status === "pending" ? "bg-[var(--amber-200)] text-[var(--amber-900)]" :
                        "bg-[var(--line)] text-[var(--ink-soft)]"
                      }`}>
                        {t(`offer_${offer.status}` as "offer_pending")}
                      </span>
                      <span className="text-xs font-bold text-[var(--ink-soft)]">{offer.quantity} kg</span>
                    </div>
                  </div>
                  
                  {offer.message && (
                    <p className={`text-sm italic ${isMe ? "text-[var(--green-800)]" : "text-[var(--ink-soft)]"}`}>
                      "{offer.message}"
                    </p>
                  )}
                  
                  {/* Accept / counter / decline buttons */}
                  {offer.status === "pending" && !isMe && match.status !== "accepted" && (
                    <div className="mt-2 flex flex-wrap gap-3 pt-2">
                      <button onClick={() => handleAccept(offer.id)}
                        className="flex-1 rounded-xl bg-[var(--green-700)] px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-green-900/20 transition hover:bg-[var(--green-900)]">
                        {t("accept")}
                      </button>
                      <button onClick={() => startCounter(offer.price, offer.quantity)}
                        className="flex-1 rounded-xl border border-[var(--green-600)] bg-[var(--green-50)] px-4 py-2.5 text-sm font-bold text-[var(--green-800)] transition hover:bg-[var(--green-100)]">
                        {t("counter")}
                      </button>
                      <button onClick={() => handleDecline(offer.id)}
                        className="flex-1 rounded-xl border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-bold text-[var(--ink)] transition hover:bg-[var(--paper)]">
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
        <section ref={formRef} className="mt-4 rounded-2xl border border-[var(--green-200)] bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 font-heading text-base font-bold text-[var(--ink)]">
            <Icon name="handshake" size={18} className="text-[var(--green-600)]" /> {t("makeOffer")}
          </h2>

          {/* Price references — link the negotiation to the price-discovery layer */}
          {nego && (
            <div className="mb-4 rounded-xl bg-[var(--paper)] p-3 text-xs">
              <div className="mb-2 font-bold uppercase tracking-wide text-[var(--ink-soft)]">
                {t("priceRefs")}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[var(--ink)]">
                {nego.references.mandi_modal_per_qtl != null && (
                  <span>{t("refMandi")}: <b>₹{nego.references.mandi_modal_per_qtl}</b></span>
                )}
                {nego.references.msp_per_qtl != null && (
                  <span>{t("refMsp")}: <b>₹{nego.references.msp_per_qtl}</b></span>
                )}
                <span>
                  {t("refBuyerBand")}: <b>₹{nego.references.demand_price_band[0]}–{nego.references.demand_price_band[1]}</b>
                </span>
                <span>{t("refFarmerAsk")}: <b>₹{nego.references.lot_expected_price}</b></span>
                {nego.spread_per_qtl != null && (
                  <span className="text-[var(--amber-700)]">
                    · {t("spreadApart", { amount: nego.spread_per_qtl })}
                  </span>
                )}
              </div>
              {nego.suggested_midpoint_per_qtl != null && (
                <button
                  type="button"
                  onClick={() => setOfferPrice(String(nego.suggested_midpoint_per_qtl))}
                  className="mt-2 rounded-full bg-[var(--green-100)] px-2.5 py-1 font-bold text-[var(--green-700)] transition hover:bg-[var(--green-200)]"
                >
                  {t("useMidpoint", { price: nego.suggested_midpoint_per_qtl })}
                </button>
              )}
            </div>
          )}
          <form onSubmit={handleOffer} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-bold text-[var(--ink)]">
              {t("offerPriceLabel")}
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-[var(--ink-soft)]">₹</span>
                <input 
                  type="number" min="1" value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} required 
                  className="w-full rounded-xl border border-[var(--line)] py-2.5 pl-8 pr-3 text-sm font-normal focus:border-[var(--green-600)] focus:outline-none transition-colors" 
                />
              </div>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-bold text-[var(--ink)]">
              {t("offerQuantityLabel")}
              <div className="relative">
                <input 
                  type="number" min="1" value={offerQty} onChange={(e) => setOfferQty(e.target.value)} required 
                  className="w-full rounded-xl border border-[var(--line)] py-2.5 pl-3 pr-10 text-sm font-normal focus:border-[var(--green-600)] focus:outline-none transition-colors" 
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-[var(--ink-soft)]">kg</span>
              </div>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-bold text-[var(--ink)] sm:col-span-2">
              {t("offerMessageLabel")}
              <textarea 
                value={offerMsg} onChange={(e) => setOfferMsg(e.target.value)} rows={2}
                placeholder={t("offerMessagePlaceholder")}
                className="resize-none rounded-xl border border-[var(--line)] p-3 text-sm font-normal focus:border-[var(--green-600)] focus:outline-none transition-colors" 
              />
            </label>
            <div className="sm:col-span-2 pt-2">
              <button type="submit" disabled={submitting}
                className="w-full rounded-xl bg-[var(--green-700)] px-6 py-3 font-bold text-white shadow-md shadow-green-900/20 transition hover:bg-[var(--green-900)] disabled:opacity-60">
                {submitting ? t("submittingOffer") : t("submitOffer")}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}

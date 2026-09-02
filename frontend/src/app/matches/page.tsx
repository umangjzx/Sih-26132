"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/AuthProvider";
import { PageHeader } from "@/components/PageHeader";
import { Icon } from "@/components/ui";
import { listMyMatches, type MatchResponse, type ScoreDetail } from "@/lib/api";

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

export default function MatchesPage() {
  const { isAuthenticated, ready, user, token } = useAuth();
  const router = useRouter();
  const tm = useTranslations("matching");
  const tdash = useTranslations("dash");

  const [matches, setMatches] = useState<MatchResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ready && !isAuthenticated) router.replace("/login");
  }, [ready, isAuthenticated, router]);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const m = await listMyMatches(token);
      setMatches(m);
    } catch {
      // error handling
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  if (!ready || !isAuthenticated) return null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon="connection"
        title={tm("title")}
        subtitle={tdash("matchesSubtitle")}
      />

      {loading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 w-full animate-pulse rounded-2xl bg-white/50" />
          ))}
        </div>
      ) : matches.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--paper)] py-12 text-center shadow-sm">
          <Icon name="connection" size={32} className="text-[var(--green-300)]" />
          <p className="font-heading text-lg font-bold text-[var(--ink)]">{tdash("noMatchesYet")}</p>
          <p className="text-sm font-medium text-[var(--ink-soft)]">{tm("noMatches")}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {matches.map((match) => {
            const detail = parseScoreDetail(match.score_detail);
            const cp = match.counterparty;
            const isFarmer = user?.role === "farmer";
            
            return (
              <li key={match.id}
                className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm transition hover:shadow-md">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--green-100)] text-[var(--green-700)]">
                      <Icon name="leaf" size={24} />
                    </div>
                    <div>
                      <span className="font-heading text-base font-bold text-[var(--ink)]">{match.lot.crop}</span>
                      <div className="mt-1 text-xs font-medium text-[var(--ink-soft)]">
                        {match.lot.quantity_kg} kg · ₹{match.lot.expected_price}/qtl · {match.lot.location}
                      </div>
                      {cp && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-[var(--ink)]">{cp.name}</span>
                          {cp.kyc_status === "verified" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--green-100)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--green-700)]">
                              <Icon name="check" size={10} /> {isFarmer ? tm("verifiedBuyer") : tm("verifiedFarmer")}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <Link href={`/matches/${match.id}`}
                    className="shrink-0 rounded-xl bg-[var(--green-700)] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-green-900/20 transition hover:bg-[var(--green-900)]">
                    {tm("viewOffers")}
                  </Link>
                </div>
                <div className="mt-4 border-t border-[var(--line)] pt-1">
                  <ScoreBar score={match.score} detail={detail} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

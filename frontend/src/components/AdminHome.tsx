"use client";

/**
 * Admin's Home (v1.19) — every other role's Home is a one-crop market
 * snapshot, which has no personal action for an admin to take. Instead: a
 * few headline counts and quick links into the pages that actually need
 * attention today, mirroring the audit's "what needs me today, not what is
 * onion doing in Pune" framing.
 */

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/AuthProvider";
import { Icon } from "@/components/ui";
import {
  ApiError,
  getAdminDashboard,
  listAllFinancingRequests,
  type AdminDashboardResponse,
} from "@/lib/api";

function KpiTile({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--green-100)] text-[var(--green-700)]">
        <Icon name={icon} size={18} />
      </div>
      <div className="min-w-0">
        <div className="font-heading text-xl font-bold text-[var(--ink)]">{value}</div>
        <div className="truncate text-xs font-semibold text-[var(--ink-soft)]">{label}</div>
      </div>
    </div>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--green-700)] text-white">
        <Icon name={icon} size={18} />
      </div>
      <span className="font-semibold text-[var(--ink)]">{label}</span>
      <Icon name="chevronLeft" size={14} className="ml-auto rotate-180 text-[var(--ink-soft)]" />
    </Link>
  );
}

export function AdminHome() {
  const t = useTranslations("adminHome");
  const { token, user } = useAuth();
  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [pendingFinancing, setPendingFinancing] = useState<number | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) return;
    getAdminDashboard(token).then(setData).catch(() => setError(true));
    listAllFinancingRequests(token, "pending")
      .then((rows) => setPendingFinancing(rows.length))
      .catch(() => setPendingFinancing(null));
  }, [token]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-[var(--green-900)]">
          {t("greeting", { name: user?.name ?? "" })}
        </h1>
        <p className="mt-0.5 text-sm text-[var(--ink-soft)]">{t("subtitle")}</p>
      </div>

      {error ? (
        <p className="rounded-2xl bg-[var(--red-100)] px-5 py-4 text-sm text-[var(--red-700)]">
          {t("loadError")}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiTile icon="shield" label={t("openDisputes")} value={data?.open_disputes_count ?? "—"} />
          <KpiTile icon="coins" label={t("pendingFinancing")} value={pendingFinancing ?? "—"} />
          <KpiTile icon="leaf" label={t("openLots")} value={data?.open_lots ?? "—"} />
          <KpiTile icon="handshake" label={t("totalDeals")} value={data?.total_deals ?? "—"} />
        </div>
      )}

      <div>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-[var(--ink-soft)]">
          {t("quickActions")}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <QuickLink href="/admin" icon="shield" label={t("linkDashboard")} />
          <QuickLink href="/admin/disputes" icon="scale" label={t("linkDisputes")} />
          <QuickLink href="/admin/financing" icon="coins" label={t("linkFinancing")} />
          <QuickLink href="/admin/listings" icon="warehouse" label={t("linkListings")} />
          <QuickLink href="/admin/users" icon="users" label={t("linkUsers")} />
        </div>
      </div>
    </div>
  );
}

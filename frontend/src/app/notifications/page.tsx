"use client";

/**
 * Full notifications history (v1.19) — the bell dropdown only ever showed a
 * handful with no filter and no archive. Every authenticated role.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/AuthProvider";
import { PageHeader } from "@/components/PageHeader";
import { Icon } from "@/components/ui";
import {
  ApiError,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/api";

const KIND_ICON: Record<string, string> = {
  price_alert: "chart",
  deal: "handshake",
  dispute: "scale",
  digest: "bell",
  system: "shield",
};

export default function NotificationsPage() {
  const { isAuthenticated, ready, token } = useAuth();
  const router = useRouter();
  const t = useTranslations("notifications");
  const tc = useTranslations("common");

  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) router.replace("/login");
  }, [ready, isAuthenticated, router]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadErr(false);
    try {
      setItems(await listNotifications(token, unreadOnly, 100));
    } catch {
      setLoadErr(true);
    } finally {
      setLoading(false);
    }
  }, [token, unreadOnly]);

  useEffect(() => { load(); }, [load]);

  async function open(n: AppNotification) {
    if (!token || n.read) return;
    try {
      await markNotificationRead(n.id, token);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    } catch {
      /* non-fatal — the link navigation still proceeds */
    }
  }

  async function markAll() {
    if (!token) return;
    try {
      await markAllNotificationsRead(token);
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      /* ignore */
    }
  }

  if (!ready || !isAuthenticated) return null;

  const hasUnread = items.some((n) => !n.read);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon="bell" title={t("pageTitle")} subtitle={t("pageSubtitle")} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex w-fit gap-1 rounded-xl border border-[var(--line)] bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setUnreadOnly(false)}
            className={`rounded-lg px-4 py-1.5 text-sm font-bold transition ${!unreadOnly ? "bg-[var(--green-700)] text-white" : "text-[var(--ink-soft)] hover:bg-[var(--paper)]"}`}
          >
            {t("filterAll")}
          </button>
          <button
            type="button"
            onClick={() => setUnreadOnly(true)}
            className={`rounded-lg px-4 py-1.5 text-sm font-bold transition ${unreadOnly ? "bg-[var(--green-700)] text-white" : "text-[var(--ink-soft)] hover:bg-[var(--paper)]"}`}
          >
            {t("filterUnread")}
          </button>
        </div>
        {hasUnread && (
          <button
            type="button"
            onClick={markAll}
            className="text-sm font-bold text-[var(--green-700)] hover:underline"
          >
            {t("markAllRead")}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/50" />)}
        </div>
      ) : loadErr ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--red-600)]/25 bg-[var(--red-100)] py-10 text-center">
          <Icon name="close" size={26} className="text-[var(--red-600)]" />
          <p className="text-sm font-semibold text-[var(--red-700)]">{tc("error")}</p>
          <button
            type="button"
            onClick={() => { setLoading(true); load(); }}
            className="rounded-lg border border-[var(--red-500)]/40 bg-white px-4 py-1.5 text-xs font-bold text-[var(--red-700)]"
          >
            {tc("retry")}
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--paper)] py-12 text-center">
          <Icon name="bell" size={30} className="text-[var(--green-300)]" />
          <p className="text-sm font-medium text-[var(--ink-soft)]">{t("none")}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((n) => {
            const row = (
              <div
                className={`flex items-start gap-3 rounded-2xl border p-4 shadow-sm transition ${
                  n.read
                    ? "border-[var(--line)] bg-white"
                    : "border-[var(--green-600)]/30 bg-[var(--green-50)]"
                }`}
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${n.read ? "bg-[var(--paper)] text-[var(--ink-soft)]" : "bg-[var(--green-700)] text-white"}`}>
                  <Icon name={KIND_ICON[n.kind] ?? "bell"} size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--ink)]">{n.title}</span>
                    {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--green-600)]" />}
                  </div>
                  {n.body && <p className="mt-0.5 text-sm text-[var(--ink-soft)]">{n.body}</p>}
                  <p className="mt-1 text-xs text-[var(--ink-soft)]/70">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            );
            return (
              <li key={n.id}>
                {n.link ? (
                  <Link href={n.link} onClick={() => open(n)}>{row}</Link>
                ) : (
                  <button type="button" onClick={() => open(n)} className="w-full text-left">{row}</button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

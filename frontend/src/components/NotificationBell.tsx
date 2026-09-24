"use client";

/**
 * Header notification bell (v1.1). Shows an unread count; the dropdown lists
 * recent notifications and can mark them all read. Auth only.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { useAuth } from "@/components/AuthProvider";
import { Icon } from "@/components/ui";
import {
  listNotifications,
  markAllNotificationsRead,
  notificationUnreadCount,
  type AppNotification,
} from "@/lib/api";
import { formatRelativeTime } from "@/lib/formatRelativeTime";

export function NotificationBell() {
  const { token, isAuthenticated } = useAuth();
  const t = useTranslations("notifications");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listErr, setListErr] = useState(false);
  const [actionErr, setActionErr] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(async () => {
    if (!token) return;
    try {
      setUnread((await notificationUnreadCount(token)).unread);
    } catch {
      /* ignore */
    }
  }, [token]);

  useEffect(() => {
    if (!isAuthenticated) return;
    // Gate polling on tab visibility — a backgrounded tab has no reason to
    // keep hitting the network every minute, which matters on the metered
    // rural mobile connections this app targets. Refresh immediately (not
    // after waiting up to 60s) when the tab becomes visible again.
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (id) return;
      id = setInterval(refreshCount, 60_000);
    };
    const stop = () => {
      if (id) {
        clearInterval(id);
        id = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshCount();
        start();
      } else {
        stop();
      }
    };
    refreshCount();
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isAuthenticated, refreshCount]);

  const fetchItems = useCallback(async () => {
    if (!token) return;
    setListLoading(true);
    setListErr(false);
    try {
      setItems(await listNotifications(token));
    } catch {
      setListErr(true);
    } finally {
      setListLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!isAuthenticated) return null;

  async function openDropdown() {
    const next = !open;
    setOpen(next);
    if (next) fetchItems();
  }

  async function markAll() {
    if (!token) return;
    setActionErr(false);
    try {
      await markAllNotificationsRead(token);
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      setActionErr(true);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={openDropdown}
        aria-label={t("title")}
        className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)]/70 text-[var(--green-700)] transition-colors hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--green-700)]"
      >
        <Icon name="bell" size={19} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[var(--red-500)] px-1 text-center text-[11px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t("title")}
          className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-1.5rem)] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-2xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="font-heading text-sm font-bold">{t("title")}</span>
            {items.some((n) => !n.read) && (
              <button
                type="button"
                onClick={markAll}
                className="text-xs font-semibold text-[var(--color-brand)] hover:underline"
              >
                {t("markAllRead")}
              </button>
            )}
          </div>
          {actionErr && (
            <p role="alert" className="mb-2 text-xs font-semibold text-[var(--red-700)]">
              {tc("error")}
            </p>
          )}
          {listLoading ? (
            <div className="flex flex-col gap-1.5 py-1">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 w-full animate-pulse rounded-lg bg-black/5" />
              ))}
            </div>
          ) : listErr ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <p className="text-sm font-semibold text-[var(--red-700)]">{tc("error")}</p>
              <button
                type="button"
                onClick={fetchItems}
                className="rounded-lg border border-[var(--red-500)]/40 bg-[var(--color-surface)] px-3 py-1 text-xs font-bold text-[var(--red-700)]"
              >
                {tc("retry")}
              </button>
            </div>
          ) : items.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--ink-soft)]">{t("none")}</p>
          ) : (
            <ul className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
              {items.map((n) => {
                const body = (
                  <>
                    <div className="text-sm font-semibold">{n.title}</div>
                    <div className="text-xs text-[var(--ink-soft)]">{n.body}</div>
                    <div className="text-[10px] text-[var(--ink-soft)]/70">
                      {formatRelativeTime(n.created_at) ?? n.created_at}
                    </div>
                  </>
                );
                return (
                  <li
                    key={n.id}
                    className={`rounded-lg px-2 py-1.5 ${n.read ? "opacity-60" : "bg-[var(--color-brand)]/5"}`}
                  >
                    {n.link ? (
                      <Link href={n.link} onClick={() => setOpen(false)}>
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="mt-2 block rounded-lg py-1.5 text-center text-xs font-bold text-[var(--color-brand)] hover:underline"
          >
            {t("viewAll")}
          </Link>
        </div>
      )}
    </div>
  );
}

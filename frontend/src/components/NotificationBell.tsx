"use client";

/**
 * Header notification bell (v1.1). Shows an unread count; the dropdown lists
 * recent notifications and can mark them all read. Auth only.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { useAuth } from "@/components/AuthProvider";
import {
  listNotifications,
  markAllNotificationsRead,
  notificationUnreadCount,
  type AppNotification,
} from "@/lib/api";

export function NotificationBell() {
  const { token, isAuthenticated } = useAuth();
  const t = useTranslations("notifications");
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<AppNotification[]>([]);

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
    refreshCount();
    const id = setInterval(refreshCount, 60_000);
    return () => clearInterval(id);
  }, [isAuthenticated, refreshCount]);

  if (!isAuthenticated) return null;

  async function openDropdown() {
    setOpen((v) => !v);
    if (!open && token) {
      try {
        setItems(await listNotifications(token));
      } catch {
        /* ignore */
      }
    }
  }

  async function markAll() {
    if (!token) return;
    await markAllNotificationsRead(token);
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={openDropdown}
        aria-label={t("title")}
        className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-lg"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[var(--color-wait)] px-1 text-center text-[11px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-[var(--color-border)] bg-white p-3 shadow-2xl">
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
          {items.length === 0 ? (
            <p className="py-4 text-center text-sm text-stone-500">{t("none")}</p>
          ) : (
            <ul className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
              {items.map((n) => {
                const body = (
                  <>
                    <div className="text-sm font-semibold">{n.title}</div>
                    <div className="text-xs text-stone-500">{n.body}</div>
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
        </div>
      )}
    </div>
  );
}

/**
 * Human-friendly "time ago" formatting for data-freshness timestamps (price
 * quotes, advisor signals, deal/match activity, notifications). Companion to
 * `lib/format.ts` — that file owns exact ₹/date formatting, this one owns the
 * relative phrasing.
 *
 * Always uses the browser's local timezone (via plain `Date` — no manual UTC
 * offsetting), so it can't drift from `formatDate`/`formatDateTime`, which do
 * the same. Anything older than ~a week falls back to an absolute date
 * instead of vague phrasing like "3 weeks ago".
 */

import { formatDate } from "./format";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * Returns a short relative phrase ("just now", "2 hours ago", "3 days ago")
 * for anything within the last week, or an absolute `formatDate` string for
 * anything older — including future-dated values, which fall straight
 * through to the absolute date rather than printing a nonsensical
 * "-3 hours ago". Returns `null` for missing/invalid input so callers can
 * decide their own fallback (e.g. "—").
 */
export function formatRelativeTime(
  value: string | number | Date | null | undefined,
): string | null {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  const t = d.getTime();
  if (Number.isNaN(t)) return null;

  const diffMs = Date.now() - t;
  if (diffMs < 0 || diffMs >= WEEK) return formatDate(d);

  if (diffMs < 45_000) return "just now";
  if (diffMs < HOUR) {
    const min = Math.round(diffMs / MINUTE);
    return `${min} minute${min === 1 ? "" : "s"} ago`;
  }
  if (diffMs < DAY) {
    const hr = Math.round(diffMs / HOUR);
    return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  }
  const day = Math.round(diffMs / DAY);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}

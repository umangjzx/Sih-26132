/**
 * Shared ₹/date formatting — a v1.19 audit found the same rupee magnitude
 * rendering as "₹1.23 Cr" on one page and "₹1,234,000" on another, and dates
 * rendering in the browser's default locale on some pages but pinned to
 * en-IN on others. One function per concern, used everywhere.
 */

/** Abbreviated, for KPI tiles and summary headlines where magnitude matters
 * more than the exact figure (e.g. "₹1.23 Cr" GMV). */
export function formatInr(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
}

/** Exact, for amounts a person will act on — a financing request, a deal
 * price, a payment — where the precise figure matters more than brevity. */
export function formatInrExact(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

/** Date + time, pinned to en-IN so it doesn't vary with the viewer's browser
 * locale — used for audit/activity timestamps. */
export function formatDateTime(value: string | number | Date): string {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Date only, pinned to en-IN. */
export function formatDate(value: string | number | Date): string {
  return new Date(value).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

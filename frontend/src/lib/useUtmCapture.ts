"use client";

/**
 * Captures utm_* params from the URL on first landing and stashes them in
 * sessionStorage, once, so they survive the click-through to /login or
 * /register instead of being lost the moment the visitor navigates away from
 * whatever page they arrived on.
 *
 * There's no analytics/marketing integration in this app yet (no GA,
 * Segment, etc.) to consume this — this is deliberately just the capture
 * step, so attribution data isn't thrown away before anything exists to read
 * it. It does NOT rewrite internal links to propagate the params; that's a
 * separate, bigger feature this app has no consumer for yet.
 */

import { useEffect } from "react";

const STORAGE_KEY = "harvestiq-utm";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

export function useUtmCapture(): void {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const captured: Partial<Record<(typeof UTM_KEYS)[number], string>> = {};
      for (const key of UTM_KEYS) {
        const v = params.get(key);
        if (v) captured[key] = v;
      }
      // Nothing on this particular landing — don't clobber a value stored
      // from an earlier page in the same session.
      if (Object.keys(captured).length === 0) return;
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...captured, captured_at: new Date().toISOString() }),
      );
    } catch {
      /* sessionStorage unavailable (private mode, etc.) — non-fatal */
    }
  }, []);
}

import Image from "next/image";
import React from "react";

/**
 * AgriLink logo — the brand mark, from /public/logo.png.
 *
 * Three variants:
 *   "icon"    — mark only (no wordmark)
 *   "full"    — mark + "AgriLink" wordmark (light backgrounds)
 *   "sidebar" — mark + wordmark, white palette (dark sidebar background)
 */

interface LogoProps {
  className?: string;
  size?: number;
  variant?: "icon" | "full" | "sidebar";
}

export function Logo({ className = "", size = 36, variant = "full" }: LogoProps) {
  const isSidebar = variant === "sidebar";
  const wordmark   = isSidebar ? "#ffffff" : "#1E5B3A";
  const tagline    = isSidebar ? "rgba(255,255,255,0.55)" : "#4a9d6b";

  /* ── Mark — raster brand tile ─────────────────────────────────────── */
  const mark = (
    <span
      className={`inline-flex shrink-0 overflow-hidden rounded-[28%] ${variant !== "full" && variant !== "sidebar" ? className : ""}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Image src="/logo.png" alt="" width={size} height={size} className="h-full w-full object-cover" />
    </span>
  );

  /* ── Icon-only variant ─────────────────────────────────────────────── */
  if (variant === "icon") {
    return (
      <span
        className={`inline-flex shrink-0 overflow-hidden rounded-[28%] ${className}`}
        style={{ width: size, height: size }}
        role="img"
        aria-label="AgriLink"
      >
        <Image src="/logo.png" alt="" width={size} height={size} className="h-full w-full object-cover" />
      </span>
    );
  }

  /* ── Full / sidebar variant (mark + wordmark) ──────────────────────── */
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {mark}
      <div className="flex flex-col leading-none">
        <span
          className="font-heading font-bold tracking-tight"
          style={{
            fontFamily: "var(--font-poppins), sans-serif",
            fontSize: size * 0.58,
            color: wordmark,
            letterSpacing: "-0.025em",
            lineHeight: 1,
          }}
        >
          AgriLink
        </span>
        <span
          style={{
            fontFamily: "var(--font-poppins), sans-serif",
            fontSize: size * 0.22,
            color: tagline,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginTop: size * 0.06,
          }}
        >
          Markets · Insights
        </span>
      </div>
    </div>
  );
}

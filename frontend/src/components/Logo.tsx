import React from "react";

/**
 * AgriLink logo — faithful SVG recreation of the brand mark.
 *
 * Anatomy (matches the provided reference image exactly):
 *   1. Outer ring arc  — open circle in deep forest green, gap at bottom-right
 *   2. Wheat stalk     — harvest gold, right side inside the arc
 *   3. Leaf sprigs     — two leaves, medium green, left side inside the arc
 *   4. Rolling fields  — three curved horizon lines, deep green, bottom inside
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

  /* ── Palette (dark sidebar vs light surface) ────────────────────────── */
  const darkGreen   = isSidebar ? "#d6ecdd" : "#1E5B3A";  // arc + fields
  const midGreen    = isSidebar ? "#a8d5b5" : "#2E7D32";  // leaves
  const lightGreen  = isSidebar ? "#81c784" : "#4a9d6b";  // leaf highlights
  const gold        = "#F4A400";                           // wheat — always gold
  const wordmark    = isSidebar ? "#ffffff" : "#1E5B3A";
  const tagline     = isSidebar ? "rgba(255,255,255,0.55)" : "#4a9d6b";

  /* ── Mark SVG (100 × 100 viewBox) ──────────────────────────────────── */
  const mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${variant !== "full" && variant !== "sidebar" ? className : ""}`}
      aria-hidden="true"
    >
      {/* ── 1. Outer arc — open circle, gap at bottom-right ── */}
      {/*  A large-radius stroke arc from ~200° through ~70° (≈ 230° sweep) */}
      <path
        d="M 78 82
           A 38 38 0 1 0 90 28"
        stroke={darkGreen}
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
      />

      {/* ── 2. Wheat stalk — right side ── */}
      {/* Central stem */}
      <line x1="72" y1="72" x2="72" y2="28" stroke={gold} strokeWidth="2.8" strokeLinecap="round" />
      {/* Grain head — tapered ellipse grains in two columns */}
      {/* left grains */}
      <ellipse cx="67" cy="36" rx="4.5" ry="3"  fill={gold} transform="rotate(-20 67 36)" />
      <ellipse cx="66" cy="44" rx="4.5" ry="3"  fill={gold} transform="rotate(-20 66 44)" />
      <ellipse cx="66" cy="52" rx="4.5" ry="3"  fill={gold} transform="rotate(-20 66 52)" />
      <ellipse cx="67" cy="60" rx="4.5" ry="3"  fill={gold} transform="rotate(-20 67 60)" />
      {/* right grains */}
      <ellipse cx="77" cy="36" rx="4.5" ry="3"  fill={gold} transform="rotate(20 77 36)" />
      <ellipse cx="78" cy="44" rx="4.5" ry="3"  fill={gold} transform="rotate(20 78 44)" />
      <ellipse cx="78" cy="52" rx="4.5" ry="3"  fill={gold} transform="rotate(20 78 52)" />
      <ellipse cx="77" cy="60" rx="4.5" ry="3"  fill={gold} transform="rotate(20 77 60)" />
      {/* tip bristle */}
      <line x1="72" y1="28" x2="72" y2="22" stroke={gold} strokeWidth="2" strokeLinecap="round" />

      {/* ── 3. Leaf sprigs — left side ── */}
      {/* Back / lower leaf — slightly rotated right */}
      <path
        d="M 38 60
           C 25 52 22 36 30 28
           C 34 38 36 50 38 60 Z"
        fill={lightGreen}
      />
      {/* Front / upper leaf — rotated left, on top */}
      <path
        d="M 36 58
           C 28 46 30 30 42 24
           C 42 38 40 50 36 58 Z"
        fill={midGreen}
      />
      {/* Leaf mid-veins */}
      <path
        d="M 38 60 C 28 46 25 34 30 28"
        stroke={darkGreen}
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
        opacity="0.45"
      />
      <path
        d="M 36 58 C 33 44 35 32 42 24"
        stroke={darkGreen}
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
        opacity="0.45"
      />

      {/* ── 4. Rolling fields — three curved horizon lines ── */}
      {/* Bottom land curve 1 (outermost) */}
      <path
        d="M 18 80 Q 50 68 82 80"
        stroke={darkGreen}
        strokeWidth="5.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Mid land curve 2 */}
      <path
        d="M 22 72 Q 50 62 78 72"
        stroke={midGreen}
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      {/* Inner land curve 3 (topmost) */}
      <path
        d="M 27 65 Q 50 57 73 65"
        stroke={lightGreen}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        opacity="0.75"
      />
    </svg>
  );

  /* ── Icon-only variant ─────────────────────────────────────────────── */
  if (variant === "icon") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`shrink-0 ${className}`}
        aria-label="AgriLink"
        role="img"
      >
        <path d="M 78 82 A 38 38 0 1 0 90 28" stroke={darkGreen} strokeWidth="8" strokeLinecap="round" fill="none" />
        <line x1="72" y1="72" x2="72" y2="28" stroke={gold} strokeWidth="2.8" strokeLinecap="round" />
        <ellipse cx="67" cy="36" rx="4.5" ry="3" fill={gold} transform="rotate(-20 67 36)" />
        <ellipse cx="66" cy="44" rx="4.5" ry="3" fill={gold} transform="rotate(-20 66 44)" />
        <ellipse cx="66" cy="52" rx="4.5" ry="3" fill={gold} transform="rotate(-20 66 52)" />
        <ellipse cx="67" cy="60" rx="4.5" ry="3" fill={gold} transform="rotate(-20 67 60)" />
        <ellipse cx="77" cy="36" rx="4.5" ry="3" fill={gold} transform="rotate(20 77 36)" />
        <ellipse cx="78" cy="44" rx="4.5" ry="3" fill={gold} transform="rotate(20 78 44)" />
        <ellipse cx="78" cy="52" rx="4.5" ry="3" fill={gold} transform="rotate(20 78 52)" />
        <ellipse cx="77" cy="60" rx="4.5" ry="3" fill={gold} transform="rotate(20 77 60)" />
        <line x1="72" y1="28" x2="72" y2="22" stroke={gold} strokeWidth="2" strokeLinecap="round" />
        <path d="M 38 60 C 25 52 22 36 30 28 C 34 38 36 50 38 60 Z" fill={lightGreen} />
        <path d="M 36 58 C 28 46 30 30 42 24 C 42 38 40 50 36 58 Z" fill={midGreen} />
        <path d="M 18 80 Q 50 68 82 80" stroke={darkGreen} strokeWidth="5.5" strokeLinecap="round" fill="none" />
        <path d="M 22 72 Q 50 62 78 72" stroke={midGreen} strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M 27 65 Q 50 57 73 65" stroke={lightGreen} strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.75" />
      </svg>
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

import React from "react";

interface LogoProps {
  className?: string;
  size?: number;
  variant?: "icon" | "full" | "sidebar";
}

export function Logo({ className = "", size = 32, variant = "full" }: LogoProps) {
  const isSidebar = variant === "sidebar";

  const icon = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
    >
      {/* Outer Circle Ring */}
      <path
        d="M20.2 20.2C36.6 3.8 63.4 3.8 79.8 20.2C96.2 36.6 96.2 63.4 79.8 79.8"
        stroke={isSidebar ? "white" : "var(--green-700)"}
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path
        d="M20.2 20.2C3.8 36.6 3.8 63.4 20.2 79.8"
        stroke={isSidebar ? "var(--green-200)" : "var(--green-400)"}
        strokeWidth="10"
        strokeLinecap="round"
      />
      
      {/* Fields (Curved bottom lines) */}
      <path
        d="M15 65C35 85 65 85 85 65"
        stroke={isSidebar ? "white" : "var(--green-700)"}
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M25 75C40 90 60 90 75 75"
        stroke={isSidebar ? "var(--green-200)" : "var(--green-600)"}
        strokeWidth="8"
        strokeLinecap="round"
      />

      {/* Leaf (Left side) */}
      <path
        d="M30 60C30 60 15 45 20 25C20 25 40 30 45 50C45 50 35 60 30 60Z"
        fill={isSidebar ? "var(--green-200)" : "var(--green-400)"}
      />

      {/* Wheat/Crop (Right side) */}
      <path
        d="M70 60C70 60 85 45 80 25C80 25 60 30 55 50C55 50 65 60 70 60Z"
        fill="var(--amber-500)"
      />
      
      {/* Central connection dot */}
      <circle cx="50" cy="55" r="5" fill={isSidebar ? "white" : "var(--green-900)"} />
    </svg>
  );

  if (variant === "icon") {
    return icon;
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {icon}
      <div className="flex flex-col">
        <span
          className={`font-heading text-2xl font-bold leading-none tracking-tight ${isSidebar ? "text-white" : "text-[var(--green-700)]"}`}
          style={{ letterSpacing: "-0.03em" }}
        >
          AgriLink
        </span>
        <span className={`mt-0.5 text-[0.65rem] font-bold uppercase tracking-[0.15em] ${isSidebar ? "text-[var(--green-200)]" : "text-[var(--green-600)]"}`}>
          Markets. Insights.
        </span>
      </div>
    </div>
  );
}

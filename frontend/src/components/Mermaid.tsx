"use client";

/**
 * Client-only Mermaid diagram renderer, themed to match the AgriLink design
 * tokens in globals.css (mermaid needs literal color values, not CSS vars,
 * since it bakes them into the generated SVG at render time).
 */

import { useEffect, useId, useRef, useState } from "react";

let mermaidInitialized = false;

export function Mermaid({ chart, className = "" }: { chart: string; className?: string }) {
  const rawId = useId();
  const id = `mmd-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { default: mermaid } = await import("mermaid");

      if (!mermaidInitialized) {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          fontFamily: "var(--font-poppins), sans-serif",
          theme: "base",
          themeVariables: {
            primaryColor: "#EDF7F0",
            primaryBorderColor: "#2E7D32",
            primaryTextColor: "#1F2A33",
            secondaryColor: "#FEF0CD",
            secondaryBorderColor: "#F4A400",
            tertiaryColor: "#FFFFFF",
            tertiaryBorderColor: "#E5E7EB",
            lineColor: "#6B7280",
            textColor: "#1F2A33",
            mainBkg: "#EDF7F0",
            nodeBorder: "#2E7D32",
            clusterBkg: "#F5F7F5",
            clusterBorder: "#D1D5DB",
            edgeLabelBackground: "#FFFFFF",
            fontSize: "14px",
          },
        });
        mermaidInitialized = true;
      }

      try {
        const { svg: rendered } = await mermaid.render(id, chart);
        if (!cancelled && mountedRef.current) setSvg(rendered);
      } catch (e) {
        if (!cancelled && mountedRef.current) {
          setError(e instanceof Error ? e.message : "Diagram failed to render");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  if (error) {
    return (
      <div className="rounded-xl border border-[var(--red-300)] bg-[var(--red-50)] p-4 text-sm text-[var(--red-700)]">
        Diagram failed to render — {error}
      </div>
    );
  }

  if (!svg) {
    return <div className={`al-skeleton h-64 w-full rounded-xl ${className}`} />;
  }

  return (
    <div
      className={`mermaid-diagram flex w-full justify-center overflow-x-auto py-2 [&_svg]:h-auto [&_svg]:max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

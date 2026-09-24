"use client";

/**
 * Small icon button that copies a reference/ID value to the clipboard —
 * e.g. a financing request reference, a forward-bid/commitment reference,
 * a payment reference field. Feature-detects the Clipboard API (unavailable
 * on non-HTTPS origins and some older browsers) and falls back to the
 * legacy `document.execCommand("copy")` path, or a visible error state if
 * neither works.
 */

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui";

type Status = "idle" | "copied" | "error";

async function copyText(value: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      /* fall through to legacy path */
    }
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function CopyButton({
  value,
  label,
  className,
}: {
  /** The text to copy. */
  value: string;
  /** Accessible label for the value being copied, e.g. "receipt reference" — used to build the aria-label. */
  label?: string;
  className?: string;
}) {
  const t = useTranslations("common");
  const [status, setStatus] = useState<Status>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  async function handleClick() {
    if (!value) return;
    const ok = await copyText(value);
    setStatus(ok ? "copied" : "error");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setStatus("idle"), 1500);
  }

  const baseCls =
    "inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold transition-colors";
  const toneCls =
    status === "copied"
      ? "border-[var(--green-600)]/40 bg-[var(--green-100)] text-[var(--green-700)]"
      : status === "error"
        ? "border-[var(--red-500)]/40 bg-[var(--red-100)] text-[var(--red-700)]"
        : "border-[var(--line)] text-[var(--ink-soft)] hover:bg-[var(--paper)]";

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={
        status === "copied"
          ? t("copied")
          : status === "error"
            ? t("copyFailed")
            : label
              ? t("copyValue", { label })
              : t("copy")
      }
      className={className ?? `${baseCls} ${toneCls}`}
    >
      <Icon name={status === "copied" ? "check" : status === "error" ? "alert" : "fileText"} size={12} />
      {status === "copied" ? t("copied") : status === "error" ? t("copyFailed") : t("copy")}
    </button>
  );
}

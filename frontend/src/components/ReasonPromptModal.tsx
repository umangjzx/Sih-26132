"use client";

/**
 * In-page replacement for `window.prompt()` when collecting a free-text
 * reason for an admin moderation action (closing a listing, rejecting a
 * verification). `window.prompt` is disabled/throws in embedded WebViews —
 * notably the Cordova Android wrapper this repo is headed toward — so every
 * such prompt needs to live in the DOM instead of the browser chrome.
 */

import { useEffect, useId, useRef, useState } from "react";

type Props = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
};

export function ReasonPromptModal({
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: Props) {
  const [reason, setReason] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xl">
        <h2 id={titleId} className="font-heading text-base font-bold">
          {title}
        </h2>
        <p className="mt-1 text-sm opacity-70">{description}</p>
        <textarea
          ref={textareaRef}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="mt-3 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-bold opacity-80"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason.trim())}
            className="rounded-lg bg-[var(--color-brand)] px-3 py-1.5 text-sm font-bold text-white"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

/**
 * In-app camera capture for the mandi-slip scanner. Opens the device camera
 * (rear-facing where available), shows a live preview, and returns a JPEG File
 * the caller feeds to the OCR endpoint — same path as picking a file.
 *
 * The plain <input type="file" capture> on the trigger already opens the native
 * camera on phones; this modal adds an in-app preview + retake, and is the only
 * way to use a webcam on a laptop.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Icon } from "./ui";

type Props = {
  onCapture: (file: File) => void;
  onClose: () => void;
};

export function CameraCapture({ onCapture, onClose }: Props) {
  const t = useTranslations("camera");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [shot, setShot] = useState<string | null>(null); // object URL of the still

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setStarting(true);
    setShot((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("unsupported");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (e) {
      const name = e instanceof DOMException ? e.name : (e as Error).message;
      if (name === "NotAllowedError" || name === "SecurityError") setError(t("denied"));
      else if (name === "NotFoundError" || name === "OverconstrainedError") setError(t("noCamera"));
      else setError(t("unavailable"));
    } finally {
      setStarting(false);
    }
  }, [t]);

  useEffect(() => {
    start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        stop();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stop, onClose]);

  function take() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setShot(URL.createObjectURL(blob));
        stop(); // freeze on the still; camera restarts on "retake"
      },
      "image/jpeg",
      0.9,
    );
  }

  async function confirm() {
    const video = videoRef.current;
    // re-derive from the last still: fetch the object URL back into a blob
    if (!shot) return;
    const blob = await fetch(shot).then((r) => r.blob());
    URL.revokeObjectURL(shot);
    onCapture(new File([blob], `slip-${Date.now()}.jpg`, { type: "image/jpeg" }));
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/90"
      role="dialog"
      aria-modal="true"
      aria-label={t("title")}
    >
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="font-heading text-sm font-bold">{t("title")}</span>
        <button
          type="button"
          onClick={() => { stop(); onClose(); }}
          aria-label={t("cancel")}
          className="rounded-lg p-1.5 hover:bg-white/10"
        >
          <Icon name="close" size={22} />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {error ? (
          <div className="mx-6 max-w-sm rounded-2xl bg-white p-6 text-center">
            <Icon name="camera" size={28} className="mx-auto text-[var(--ink-soft)]" />
            <p className="mt-3 text-sm font-semibold text-[var(--ink)]">{error}</p>
            <div className="mt-4 flex justify-center gap-2">
              <button
                type="button"
                onClick={start}
                className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-bold"
              >
                {t("retry")}
              </button>
              <button
                type="button"
                onClick={() => { stop(); onClose(); }}
                className="rounded-lg bg-[var(--green-700)] px-4 py-2 text-sm font-bold text-white"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        ) : shot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shot} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="max-h-full max-w-full object-contain"
            />
            {starting && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
                {t("starting")}
              </div>
            )}
          </>
        )}
      </div>

      {!error && (
        <div className="flex items-center justify-center gap-4 px-4 py-6">
          {shot ? (
            <>
              <button
                type="button"
                onClick={start}
                className="rounded-xl border border-white/40 px-5 py-3 text-sm font-bold text-white"
              >
                {t("retake")}
              </button>
              <button
                type="button"
                onClick={confirm}
                className="flex items-center gap-2 rounded-xl bg-[var(--green-600)] px-6 py-3 text-sm font-bold text-white"
              >
                <Icon name="check" size={18} /> {t("usePhoto")}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={take}
              disabled={starting}
              aria-label={t("capture")}
              className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/20 backdrop-blur transition active:scale-95 disabled:opacity-40"
            >
              <span className="h-11 w-11 rounded-full bg-white" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

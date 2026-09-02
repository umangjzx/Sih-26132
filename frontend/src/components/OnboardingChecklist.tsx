"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Icon } from "@/components/ui";

type Step = { key: string; done: boolean; href: string };

/**
 * A dismissible "get started" card for a fresh farmer / buyer. Hides itself once
 * every step is done, or when the user closes it (remembered per role).
 */
export function OnboardingChecklist({
  role,
  hasLocation,
  hasListing,
  hasMatch,
}: {
  role: "farmer" | "buyer";
  hasLocation: boolean;
  hasListing: boolean;
  hasMatch: boolean;
}) {
  const t = useTranslations("onboarding");
  const storageKey = `agrilink.onboarding.${role}`;
  const [dismissed, setDismissed] = useState(true); // assume hidden until we read storage

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(storageKey) === "1");
    } catch {
      setDismissed(false);
    }
  }, [storageKey]);

  const steps: Step[] = [
    { key: "location", done: hasLocation, href: "/profile" },
    {
      key: role === "farmer" ? "listLot" : "postDemand",
      done: hasListing,
      href: role === "farmer" ? "/farmer#create-lot" : "/buyer#create-demand",
    },
    { key: "matches", done: hasMatch, href: "/matches" },
  ];
  const allDone = steps.every((s) => s.done);

  if (dismissed || allDone) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
  }

  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="rounded-2xl border border-[var(--green-600)]/25 bg-[var(--green-50)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-heading text-base font-bold text-[var(--green-700)]">
            <Icon name="spark" size={16} /> {t("title")}
          </h2>
          <p className="mt-0.5 text-xs text-[var(--ink-soft)]">
            {t("progress", { done: doneCount, total: steps.length })}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg p-1 text-[var(--ink-soft)] hover:bg-black/5"
          aria-label={t("dismiss")}
        >
          <Icon name="close" size={16} />
        </button>
      </div>

      <ol className="mt-3 flex flex-col gap-2">
        {steps.map((s, i) => (
          <li key={s.key}>
            <Link
              href={s.href}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${
                s.done
                  ? "border-transparent bg-white/50 text-[var(--ink-soft)]"
                  : "border-[var(--green-600)]/30 bg-white font-semibold text-[var(--ink)] hover:border-[var(--green-600)]"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                  s.done ? "bg-[var(--green-600)] text-white" : "border-2 border-[var(--green-600)] text-[var(--green-700)]"
                }`}
              >
                {s.done ? <Icon name="check" size={12} /> : i + 1}
              </span>
              <span className={s.done ? "line-through" : ""}>{t(`step_${s.key}` as "step_location")}</span>
              {!s.done && <Icon name="chevronDown" size={14} className="ml-auto -rotate-90 text-[var(--green-600)]" />}
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

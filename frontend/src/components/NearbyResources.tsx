"use client";

/**
 * "Storage near you" + "FPOs near you" (v1.1). Given a district (and optionally a
 * crop) it surfaces cold-storage / warehouse options and FPOs to aggregate with.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import {
  fetchFpoNearby,
  fetchStorageNearby,
  type ColdStorage,
  type FpoInfo,
} from "@/lib/api";

const card =
  "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] backdrop-blur-xl p-5 shadow-lg";

export function NearbyResources({ district, crop }: { district?: string; crop?: string }) {
  const ts = useTranslations("storage");
  const tf = useTranslations("fpo");
  const [storage, setStorage] = useState<ColdStorage[]>([]);
  const [fpos, setFpos] = useState<FpoInfo[]>([]);

  useEffect(() => {
    if (!district) return;
    fetchStorageNearby(district).then(setStorage).catch(() => setStorage([]));
    fetchFpoNearby(district, crop).then(setFpos).catch(() => setFpos([]));
  }, [district, crop]);

  if (!district) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <section className={card}>
        <h2 className="font-heading text-sm font-bold">{ts("title")}</h2>
        <p className="mb-2 text-xs text-stone-500">{ts("subtitle")}</p>
        {storage.length === 0 ? (
          <p className="text-sm opacity-60">{ts("none")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {storage.slice(0, 5).map((s) => (
              <li key={s.name} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{s.name}</span>
                  {s.distance_km != null && (
                    <span className="text-xs text-stone-500">{s.distance_km} km</span>
                  )}
                </div>
                <div className="text-xs text-stone-500">
                  {ts(s.type === "cold_storage" ? "type_cold_storage" : "type_warehouse")} ·{" "}
                  {ts("capacity")}: {s.capacity_tonnes.toLocaleString()} t · {s.crops}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <h2 className="font-heading text-sm font-bold">{tf("title")}</h2>
        <p className="mb-2 text-xs text-stone-500">{tf("subtitle")}</p>
        {fpos.length === 0 ? (
          <p className="text-sm opacity-60">{tf("none")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {fpos.slice(0, 5).map((f) => (
              <li key={f.name} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{f.name}</span>
                  {f.distance_km != null && (
                    <span className="text-xs text-stone-500">{f.distance_km} km</span>
                  )}
                </div>
                <div className="text-xs text-stone-500">
                  {f.members.toLocaleString()} {tf("members")} · {tf("focus")}: {f.crops}
                </div>
                <div className="text-xs text-[var(--color-brand)]">{tf("contact")}: {f.contact}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

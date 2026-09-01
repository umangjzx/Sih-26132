"use client";

/**
 * "Storage near you" + "FPOs near you" (v1.1), styled on the AgriLink UI kit.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import {
  fetchFpoNearby,
  fetchStorageNearby,
  type ColdStorage,
  type FpoInfo,
} from "@/lib/api";
import { Card, EmptyState, Icon, SectionHeader } from "./ui";

export function NearbyResources({
  district,
  crop,
  state,
  lat,
  lon,
}: {
  district?: string;
  crop?: string;
  state?: string;
  lat?: number | null;
  lon?: number | null;
}) {
  const ts = useTranslations("storage");
  const tf = useTranslations("fpo");
  const [storage, setStorage] = useState<ColdStorage[]>([]);
  const [fpos, setFpos] = useState<FpoInfo[]>([]);

  const hasPoint = typeof lat === "number" && typeof lon === "number";

  useEffect(() => {
    if (!district && !state && !hasPoint) return;
    const coords = hasPoint ? { lat: lat as number, lon: lon as number } : undefined;
    fetchStorageNearby(district ?? "", state, coords).then(setStorage).catch(() => setStorage([]));
    fetchFpoNearby(district ?? "", crop, state, coords).then(setFpos).catch(() => setFpos([]));
  }, [district, crop, state, lat, lon, hasPoint]);

  if (!district && !state && !hasPoint) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <SectionHeader icon="warehouse" title={ts("title")} />
        <p className="-mt-2 mb-2 text-xs text-[var(--ink-soft)]">{ts("subtitle")}</p>
        {storage.length === 0 ? (
          <EmptyState icon="warehouse">{ts("none")}</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {storage.slice(0, 5).map((s) => (
              <li key={s.name} className="al-card-plain px-3 py-2.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{s.name}</span>
                  {s.distance_km != null && (
                    <span className="flex items-center gap-1 text-xs text-[var(--ink-soft)]">
                      <Icon name="pin" size={12} /> {s.distance_km} km
                    </span>
                  )}
                </div>
                <div className="text-xs text-[var(--ink-soft)]">
                  {ts(s.type === "cold_storage" ? "type_cold_storage" : "type_warehouse")} ·{" "}
                  {ts("capacity")}: {s.capacity_tonnes.toLocaleString()} t · {s.crops}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionHeader icon="users" title={tf("title")} />
        <p className="-mt-2 mb-2 text-xs text-[var(--ink-soft)]">{tf("subtitle")}</p>
        {fpos.length === 0 ? (
          <EmptyState icon="users">{tf("none")}</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {fpos.slice(0, 5).map((f) => (
              <li key={f.name} className="al-card-plain px-3 py-2.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{f.name}</span>
                  {f.distance_km != null && (
                    <span className="flex items-center gap-1 text-xs text-[var(--ink-soft)]">
                      <Icon name="pin" size={12} /> {f.distance_km} km
                    </span>
                  )}
                </div>
                <div className="text-xs text-[var(--ink-soft)]">
                  {f.members.toLocaleString()} {tf("members")} · {tf("focus")}: {f.crops}
                </div>
                <div className="text-xs font-medium text-[var(--green-700)]">
                  {tf("contact")}: {f.contact}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

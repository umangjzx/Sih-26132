"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/AuthProvider";
import { NearbyResources } from "@/components/NearbyResources";
import { Icon } from "@/components/ui";
import { listDistricts } from "@/lib/api";
import { useLocation } from "@/lib/useLocation";

export default function DirectoryPage() {
  const ts = useTranslations("storage");
  const { location } = useLocation();
  const { user } = useAuth();

  const state = location?.state || "Maharashtra";
  const [districts, setDistricts] = useState<string[]>([]);
  const [district, setDistrict] = useState<string>("");

  // load the district list for whichever state the user is in
  useEffect(() => {
    let live = true;
    listDistricts(state)
      .then((ds) => {
        if (!live) return;
        setDistricts(ds);
        setDistrict((cur) => (cur && ds.includes(cur) ? cur : ds[0] ?? ""));
      })
      .catch(() => {
        if (live) setDistricts([]);
      });
    return () => {
      live = false;
    };
  }, [state]);

  // prefer the user's own district when it's in the list
  useEffect(() => {
    if (location?.district && districts.includes(location.district)) {
      setDistrict(location.district);
    }
  }, [location?.district, districts]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">{ts("title")}</h1>
        <p className="mt-1 text-stone-600">{ts("subtitle")}</p>
        <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--green-700)]">
          <Icon name="pin" size={14} /> {location?.label ?? state}
        </p>
      </div>

      {districts.length > 0 ? (
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {ts("districtLabel")}
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="min-w-56 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-base font-semibold shadow-sm"
          >
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="text-sm text-[var(--ink-soft)]">{ts("noDistricts", { state })}</p>
      )}

      <NearbyResources
        district={district || location?.district}
        state={state}
        lat={location?.lat}
        lon={location?.lon}
      />

      <p className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3 text-xs text-[var(--ink-soft)]">
        <Icon name="alert" size={12} className="mr-1 inline" />
        {ts("indicativeNote")}
      </p>

      {user?.role === "farmer" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/financing"
            className="flex items-center gap-3 rounded-2xl border border-dashed border-[var(--line)] bg-white px-5 py-3.5 text-sm font-semibold text-[var(--green-700)] transition hover:border-[var(--green-600)] hover:bg-[var(--green-50)]"
          >
            <Icon name="coins" size={16} className="shrink-0" />
            {ts("ctaFinancing")}
            <Icon name="chevronLeft" size={14} className="ml-auto rotate-180" />
          </Link>
          <Link
            href="/pools"
            className="flex items-center gap-3 rounded-2xl border border-dashed border-[var(--line)] bg-white px-5 py-3.5 text-sm font-semibold text-[var(--green-700)] transition hover:border-[var(--green-600)] hover:bg-[var(--green-50)]"
          >
            <Icon name="handshake" size={16} className="shrink-0" />
            {ts("ctaPools")}
            <Icon name="chevronLeft" size={14} className="ml-auto rotate-180" />
          </Link>
        </div>
      )}
    </div>
  );
}

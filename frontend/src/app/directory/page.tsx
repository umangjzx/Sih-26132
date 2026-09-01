"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { NearbyResources } from "@/components/NearbyResources";
import { Icon } from "@/components/ui";
import { useLocation } from "@/lib/useLocation";

const MH_DISTRICTS = [
  "Pune", "Nashik", "Ahmednagar", "Solapur", "Sangli", "Kolhapur", "Satara",
  "Jalgaon", "Dhule", "Nandurbar", "Chhatrapati Sambhajinagar", "Jalna", "Beed",
  "Latur", "Nanded", "Parbhani", "Hingoli", "Osmanabad", "Akola", "Amravati",
  "Buldhana", "Washim", "Yavatmal", "Wardha", "Nagpur", "Chandrapur", "Gondia",
  "Bhandara", "Ratnagiri", "Sindhudurg", "Raigad", "Thane", "Palghar",
];

export default function DirectoryPage() {
  const ts = useTranslations("storage");
  const tl = useTranslations("location");
  const { location } = useLocation();

  const state = location?.state ?? "Maharashtra";
  const isMh = state === "Maharashtra";
  const [district, setDistrict] = useState("Pune");

  useEffect(() => {
    if (location?.district && MH_DISTRICTS.includes(location.district)) {
      setDistrict(location.district);
    }
  }, [location?.district]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">{ts("title")}</h1>
        <p className="mt-1 text-stone-600">{ts("subtitle")}</p>
        <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--green-700)]">
          <Icon name="pin" size={14} /> {location?.label ?? state}
        </p>
      </div>

      {isMh ? (
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {ts("distance")}
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="min-w-56 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-base font-semibold shadow-sm"
          >
            {MH_DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="text-sm text-[var(--ink-soft)]">
          {tl("directoryScope", { state })}
        </p>
      )}

      <NearbyResources
        district={isMh ? district : location?.district}
        state={state}
        lat={location?.lat}
        lon={location?.lon}
      />
    </div>
  );
}

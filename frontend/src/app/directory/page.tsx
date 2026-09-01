"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { NearbyResources } from "@/components/NearbyResources";
import { useLocation } from "@/lib/useLocation";

const DISTRICTS = [
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
  const [district, setDistrict] = useState("Pune");

  useEffect(() => {
    if (location?.district && DISTRICTS.includes(location.district)) {
      setDistrict(location.district);
    }
  }, [location?.district]);

  const outsideMh = Boolean(location?.state && location.state !== "Maharashtra");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">{ts("title")}</h1>
        <p className="mt-1 text-stone-600">{ts("subtitle")}</p>
        {outsideMh && (
          <p className="mt-2 rounded-xl border border-[var(--amber-500)]/40 bg-[var(--amber-100)]/60 px-3 py-2 text-sm text-[var(--amber-700)]">
            {tl("mhOnlyNote")}
          </p>
        )}
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        {ts("distance")}
        <select
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          className="min-w-56 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-base font-semibold shadow-sm"
        >
          {DISTRICTS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>

      <NearbyResources district={district} state="Maharashtra" />
    </div>
  );
}

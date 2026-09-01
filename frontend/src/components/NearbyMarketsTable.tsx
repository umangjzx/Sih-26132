"use client";

import { useTranslations } from "next-intl";

import type { NearestMarketComparison } from "@/lib/api";

export function NearbyMarketsTable({ markets }: { markets: NearestMarketComparison[] }) {
  const t = useTranslations("nearby");

  return (
    <section className="rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <h2 className="text-base font-semibold">{t("title")}</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-stone-600">
              <th className="py-2 pr-3 font-medium">{t("market")}</th>
              <th className="py-2 pr-3 font-medium">{t("district")}</th>
              <th className="py-2 pr-3 font-medium">{t("distance")}</th>
              <th className="py-2 font-medium">{t("price")}</th>
            </tr>
          </thead>
          <tbody>
            {markets.map((m) => (
              <tr key={`${m.market}-${m.district}`} className="border-b border-[var(--color-border)] last:border-0">
                <td className="py-2 pr-3 font-medium">{m.market}</td>
                <td className="py-2 pr-3 text-stone-600">{m.district}</td>
                <td className="py-2 pr-3 text-stone-600">
                  {m.distance_km === null ? "—" : `${m.distance_km} ${t("km")}`}
                </td>
                <td className="py-2 font-semibold text-[var(--color-brand)]">₹{m.modal_price.toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

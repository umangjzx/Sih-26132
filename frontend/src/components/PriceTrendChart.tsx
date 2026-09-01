"use client";

import { useTranslations } from "next-intl";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { PricePoint } from "@/lib/api";

export function PriceTrendChart({ points }: { points: PricePoint[] }) {
  const t = useTranslations("dashboard");

  const data = points.map((p) => ({
    date: p.date.slice(5),
    modal: p.modal_price,
  }));

  return (
    <div className="h-64 w-full" role="img" aria-label={t("modalPrice")}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} minTickGap={24} />
          <YAxis tick={{ fontSize: 12 }} width={56} />
          <Tooltip
            formatter={(value) => [`₹${Number(value).toFixed(0)}`, t("modalPrice")]}
            contentStyle={{ fontSize: 14, borderRadius: 8 }}
          />
          <Line
            type="monotone"
            dataKey="modal"
            stroke="var(--color-brand)"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

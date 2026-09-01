"use client";

import { useTranslations } from "next-intl";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorModal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--green-600)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--green-600)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
          <XAxis dataKey="date" tick={{ fontSize: 12, fill: "var(--ink-soft)" }} axisLine={false} minTickGap={24} />
          <YAxis tick={{ fontSize: 12, fill: "var(--ink-soft)" }} axisLine={false} width={48} />
          <Tooltip
            formatter={(value) => [`₹${Number(value).toFixed(0)}`, t("modalPrice")]}
            contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "var(--shadow-md)" }}
          />
          <Area
            type="monotone"
            dataKey="modal"
            stroke="var(--green-600)"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorModal)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

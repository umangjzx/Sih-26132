"use client";

import { useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";

import type { NearestMarketComparison } from "@/lib/api";

export function MarketComparisonChart({
  markets,
  currentMarket,
  currentPrice,
}: {
  markets: NearestMarketComparison[];
  currentMarket: string;
  currentPrice: number;
}) {
  const t = useTranslations("nearby");

  const data = [
    { market: currentMarket, price: currentPrice, isCurrent: true },
    ...markets.map((m) => ({
      market: m.market,
      price: m.modal_price,
      isCurrent: false,
    })),
  ];

  return (
    <div className="h-64 w-full" role="img" aria-label={t("title")}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--line)" />
          <XAxis type="number" hide />
          <YAxis
            dataKey="market"
            type="category"
            axisLine={false}
            tickLine={false}
            width={90}
            tick={{ fontSize: 13, fill: "var(--ink-soft)" }}
          />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.02)" }}
            formatter={(value) => [`₹${Number(value).toFixed(0)}`, t("price") || "Price"]}
            contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "var(--shadow-md)" }}
          />
          <Bar dataKey="price" radius={[0, 6, 6, 0]} barSize={24} isAnimationActive={false}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.isCurrent ? "var(--green-600)" : "var(--green-200)"} />
            ))}
          </Bar>
          <ReferenceLine x={currentPrice} stroke="var(--green-600)" strokeDasharray="3 3" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

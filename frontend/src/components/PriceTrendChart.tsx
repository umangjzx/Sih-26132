"use client";

import { useTranslations } from "next-intl";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ForecastPoint, PricePoint } from "@/lib/api";

export function PriceTrendChart({
  points,
  forecast,
}: {
  points: PricePoint[];
  forecast?: ForecastPoint[];
}) {
  const t = useTranslations("dashboard");
  const tf = useTranslations("forecast");

  const rows: Record<string, { date: string; modal?: number; yhat?: number; band?: [number, number] }> = {};
  for (const p of points) {
    rows[p.date] = { date: p.date.slice(5), modal: p.modal_price };
  }
  // bridge: the forecast line starts from the last actual point
  const last = points[points.length - 1];
  if (last && forecast?.length) {
    rows[last.date] = { ...rows[last.date], yhat: last.modal_price, band: [last.modal_price, last.modal_price] };
  }
  for (const f of forecast ?? []) {
    rows[f.date] = { date: f.date.slice(5), yhat: f.yhat, band: [f.lo, f.hi] };
  }
  const data = Object.keys(rows).sort().map((k) => rows[k]);

  return (
    <div className="h-64 w-full" role="img" aria-label={t("modalPrice")}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorModal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--green-600)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--green-600)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
          <XAxis dataKey="date" tick={{ fontSize: 12, fill: "var(--ink-soft)" }} axisLine={false} minTickGap={24} />
          <YAxis tick={{ fontSize: 12, fill: "var(--ink-soft)" }} axisLine={false} width={48} domain={["auto", "auto"]} />
          <Tooltip
            formatter={(value, name) => [
              `₹${Number(value).toFixed(0)}`,
              name === "yhat" ? tf("label") : t("modalPrice"),
            ]}
            contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "var(--shadow-md)" }}
          />
          {forecast?.length ? (
            <Area
              type="monotone"
              dataKey="band"
              stroke="none"
              fill="var(--amber-500)"
              fillOpacity={0.12}
              isAnimationActive={false}
            />
          ) : null}
          <Area
            type="monotone"
            dataKey="modal"
            stroke="var(--green-600)"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorModal)"
            connectNulls
            isAnimationActive={false}
          />
          {forecast?.length ? (
            <Line
              type="monotone"
              dataKey="yhat"
              stroke="var(--amber-600)"
              strokeWidth={2.5}
              strokeDasharray="5 4"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

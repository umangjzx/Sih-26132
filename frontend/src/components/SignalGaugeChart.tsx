"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import type { SellWaitSignalResponse } from "@/lib/api";
import { useTranslations } from "next-intl";

type Recommendation = SellWaitSignalResponse["recommendation"];

const DATA = [
  { name: "sell_now", value: 33, color: "var(--green-600)" },
  { name: "hold", value: 34, color: "var(--amber-500)" },
  { name: "wait", value: 33, color: "var(--red-500)" },
];

export function SignalGaugeChart({ recommendation }: { recommendation: Recommendation }) {
  const t = useTranslations("signal");

  // Determine needle angle based on recommendation
  const needleValue =
    recommendation === "sell_now" ? 16.5 : recommendation === "hold" ? 50 : 83.5;

  return (
    <div className="relative h-40 w-full" role="img" aria-label={t("title")}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={DATA}
            cx="50%"
            cy="100%"
            startAngle={180}
            endAngle={0}
            innerRadius={70}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            isAnimationActive={true}
          >
            {DATA.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name, props) => [t(props.payload.name as Recommendation), "Status"]}
            contentStyle={{ borderRadius: "8px", fontWeight: "bold" }}
          />
        </PieChart>
      </ResponsiveContainer>
      
      {/* Custom Needle */}
      <div 
        className="absolute bottom-2 left-1/2 h-16 w-1 origin-bottom bg-stone-800 transition-transform duration-1000 ease-out z-10"
        style={{
          transform: `translateX(-50%) rotate(${(needleValue / 100) * 180 - 90}deg)`,
        }}
      >
        <div className="absolute -top-1 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-stone-800" />
      </div>
      <div className="absolute bottom-1 left-1/2 h-5 w-5 -translate-x-1/2 rounded-full bg-stone-800 z-20" />
      
      {/* Label */}
      <div className="absolute -bottom-8 w-full text-center font-heading text-2xl font-extrabold" style={{ color: DATA.find(d => d.name === recommendation)?.color }}>
        {t(recommendation)}
      </div>
    </div>
  );
}

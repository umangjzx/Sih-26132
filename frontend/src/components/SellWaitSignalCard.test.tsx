import { describe, expect, it, vi } from "vitest";

import type { SellWaitSignalResponse } from "@/lib/api";
import { renderWithIntl, screen } from "@/test/render";

// The gauge renders the recommendation label a second time (as an SVG-adjacent
// caption); stub it so assertions target the card's own heading unambiguously.
vi.mock("./SignalGaugeChart", () => ({ SignalGaugeChart: () => null }));

import { SellWaitSignalCard } from "./SellWaitSignalCard";

const base = {
  reasons: ["Reason A", "Reason B"],
  current_price: 1500,
  ma_7: 1490,
  ma_30: null,
  volume_trend_pct: null,
  days_of_data: 10,
};

describe.each([
  ["sell_now", "Sell Now"],
  ["wait", "Wait"],
  ["hold", "Hold / Watch"],
] as const)("SellWaitSignalCard (%s)", (recommendation, label) => {
  it(`renders the ${recommendation} label and every reason`, () => {
    const signal: SellWaitSignalResponse = { recommendation, ...base };
    renderWithIntl(<SellWaitSignalCard signal={signal} />);

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText("Reason A")).toBeInTheDocument();
    expect(screen.getByText("Reason B")).toBeInTheDocument();
  });
});

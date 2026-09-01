import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import { renderWithIntl, screen } from "@/test/render";

vi.mock("@/lib/api", () => ({
  fetchOptions: vi.fn(),
  fetchTrend: vi.fn(),
  fetchSignal: vi.fn(),
  fetchNearby: vi.fn(),
}));

import * as api from "@/lib/api";

import { PriceDashboard } from "./PriceDashboard";

const trend = {
  crop: "Onion",
  market: "Pune",
  district: "Pune",
  points: [
    { date: "2026-09-01", min_price: 1000, max_price: 2000, modal_price: 1500, arrival_volume: null },
  ],
};

const signal = {
  recommendation: "hold" as const,
  reasons: ["Not enough movement to act"],
  current_price: 1500,
  ma_7: 1490,
  ma_30: null,
  volume_trend_pct: null,
  days_of_data: 10,
};

beforeEach(() => {
  vi.mocked(api.fetchOptions).mockReset().mockResolvedValue([
    { crop: "Onion", market: "Pune", district: "Pune" },
  ]);
  vi.mocked(api.fetchTrend).mockReset().mockResolvedValue(trend);
  vi.mocked(api.fetchSignal).mockReset().mockResolvedValue(signal);
  vi.mocked(api.fetchNearby).mockReset().mockResolvedValue([]);
});

it("shows skeletons first, then the fetched data", async () => {
  renderWithIntl(<PriceDashboard />);

  expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
  const skeleton = screen.getAllByTestId("skeleton")[0];
  expect(skeleton).toHaveAttribute("role", "status");
  expect(skeleton).toHaveAttribute("aria-label");

  expect(await screen.findByRole("heading", { name: /Onion/i })).toBeInTheDocument();
});

it("recovers from an error via the Retry button", async () => {
  vi.mocked(api.fetchTrend).mockRejectedValueOnce(new Error("boom"));

  renderWithIntl(<PriceDashboard />);

  expect(await screen.findByText(/Something went wrong/i)).toBeInTheDocument();
  const retry = screen.getByRole("button", { name: /retry/i });
  expect(retry).toBeInTheDocument();

  await userEvent.click(retry);

  expect(await screen.findByRole("heading", { name: /Onion/i })).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import { renderWithIntl, screen } from "@/test/render";
import type { CropMarketState } from "@/lib/useCropMarket";

vi.mock("@/lib/api", () => ({
  fetchTrend: vi.fn(),
  fetchNearby: vi.fn(),
  fetchBestMarkets: vi.fn(),
}));
vi.mock("recharts", () => {
  const Wrap = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const Nil = () => null;
  return {
    ResponsiveContainer: Wrap,
    LineChart: Wrap, AreaChart: Wrap, BarChart: Wrap, PieChart: Wrap,
    Line: Nil, Area: Nil, Bar: Nil, Pie: Nil, Cell: Nil,
    CartesianGrid: Nil, XAxis: Nil, YAxis: Nil, Tooltip: Nil, Legend: Nil, ReferenceLine: Nil,
  };
});

import * as api from "@/lib/api";
import { PriceDetail } from "./PriceDetail";

const cm: CropMarketState = {
  options: [],
  crops: ["Onion"],
  marketsForCrop: ["Pune"],
  crop: "Onion",
  market: "Pune",
  district: "Pune",
  ready: true,
  error: false,
  setCrop: vi.fn(),
  setMarket: vi.fn(),
  retry: vi.fn(),
};

const trend = {
  crop: "Onion",
  market: "Pune",
  district: "Pune",
  points: [{ date: "2026-09-01", min_price: 1000, max_price: 2000, modal_price: 1500, arrival_volume: null }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.fetchTrend).mockResolvedValue(trend);
  vi.mocked(api.fetchNearby).mockResolvedValue([]);
  vi.mocked(api.fetchBestMarkets).mockRejectedValue(new Error("skip"));
});

it("shows a skeleton then the trend + prices", async () => {
  renderWithIntl(<PriceDetail cm={cm} />);
  expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
  expect(await screen.findByRole("heading", { name: /Onion/i })).toBeInTheDocument();
  expect(screen.getByText("₹1500")).toBeInTheDocument();
});

it("recovers from an error via Retry", async () => {
  vi.mocked(api.fetchTrend).mockRejectedValueOnce(new Error("boom"));
  renderWithIntl(<PriceDetail cm={cm} />);
  expect(await screen.findByText(/Something went wrong/i)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /retry/i }));
  expect(await screen.findByRole("heading", { name: /Onion/i })).toBeInTheDocument();
});

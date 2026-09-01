import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({ fetchPublicOverview: vi.fn() }));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => null,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));

import * as api from "@/lib/api";
import { renderWithIntl, screen } from "@/test/render";
import ExplorePage from "./page";

const overview = {
  as_of: "2026-09-01",
  crops: [{ crop: "Onion", avg_modal_price: 1900, change_7d_pct: 4.2 }],
  gainers: [{ crop: "Onion", avg_modal_price: 1900, change_7d_pct: 4.2 }],
  losers: [{ crop: "Tomato", avg_modal_price: 1400, change_7d_pct: -6.1 }],
  price_trend: [
    { date: "2026-08-30", avg_modal_price: 3000 },
    { date: "2026-09-01", avg_modal_price: 3100 },
  ],
  activity: { markets_reporting: 25, crops_tracked: 5, open_lots: 3, open_demands: 2, total_deals: 1, open_disputes: 0 },
};

beforeEach(() => vi.clearAllMocks());

it("renders statewide stats and the crop table", async () => {
  vi.mocked(api.fetchPublicOverview).mockResolvedValue(overview);
  renderWithIntl(<ExplorePage />);
  expect(await screen.findByText(/Statewide Price Transparency/i)).toBeInTheDocument();
  expect(await screen.findByText("25")).toBeInTheDocument(); // markets reporting
  expect(screen.getAllByText("Onion").length).toBeGreaterThan(0);
  expect(screen.getByText(/Top gainers/i)).toBeInTheDocument();
  expect(screen.getByText(/Top fallers/i)).toBeInTheDocument();
});

it("shows an error message when the fetch fails", async () => {
  vi.mocked(api.fetchPublicOverview).mockRejectedValue(new Error("boom"));
  renderWithIntl(<ExplorePage />);
  expect(await screen.findByText(/No statewide data yet/i)).toBeInTheDocument();
});

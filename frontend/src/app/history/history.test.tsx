import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  getMyHistory: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: 2, phone: "+910000000002", name: "Anil Traders", role: "buyer", district: "Nashik", taluka: "Nashik", kyc_status: "verified", is_active: true },
    token: "mock-token",
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import * as api from "@/lib/api";
import { renderWithIntl, screen } from "@/test/render";
import HistoryPage from "./page";

const emptyHistory = { lots: [], demands: [], deals: [] };

const dealHistory = {
  lots: [],
  demands: [
    { id: 20, buyer_id: 2, crop: "Onion", quantity_kg: 600, quality_spec: "A", price_band_min: 2000, price_band_max: 2800, delivery_window: "7 days", status: "matched" },
  ],
  deals: [
    {
      id: 1, match_id: 1, agreed_price: 2500, agreed_quantity: 500,
      logistics_mode: "self_pickup", payment_status: "pending", pipeline_status: "delivered",
      created_at: "2026-09-01T00:00:00Z",
      lot: { id: 10, farmer_id: 1, crop: "Onion", quantity_kg: 500, quality_grade: "A", expected_price: 2400, location: "Pune", status: "matched" },
      demand: { id: 20, crop: "Onion", quantity_kg: 600, price_band_min: 2000, price_band_max: 2800, delivery_window: "7 days", status: "matched" },
      counterparty: { id: 1, name: "Ravi Patil", district: "Pune", kyc_status: "unverified" },
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

it("renders all three history sections", async () => {
  vi.mocked(api.getMyHistory).mockResolvedValue(emptyHistory);
  renderWithIntl(<HistoryPage />);

  expect(await screen.findByText(/my lots/i)).toBeInTheDocument();
  expect(screen.getByText(/my demands/i)).toBeInTheDocument();
  expect(screen.getByText(/my deals/i)).toBeInTheDocument();
});

it("shows a deal's crop and a View Deal link", async () => {
  vi.mocked(api.getMyHistory).mockResolvedValue(dealHistory);
  renderWithIntl(<HistoryPage />);

  expect(await screen.findByRole("link", { name: /view deal/i })).toHaveAttribute("href", "/deals/1");
});

it("shows empty-state messages when every list is empty", async () => {
  vi.mocked(api.getMyHistory).mockResolvedValue(emptyHistory);
  renderWithIntl(<HistoryPage />);

  expect(await screen.findByText(/no lots yet/i)).toBeInTheDocument();
  expect(screen.getByText(/no demands yet/i)).toBeInTheDocument();
  expect(screen.getByText(/no deals yet/i)).toBeInTheDocument();
});

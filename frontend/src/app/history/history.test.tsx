import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  getMyHistory: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

// `mock`-prefixed so vitest's hoisting allows referencing it inside the
// factory below; mutated per-test to check both role's rendering.
const mockUser = {
  id: 2, phone: "+910000000002", name: "Anil Traders", role: "buyer" as "buyer" | "farmer",
  district: "Nashik", taluka: "Nashik", kyc_status: "verified", is_active: true,
};

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({
    user: mockUser,
    token: "mock-token",
    isAuthenticated: true,
    ready: true,
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
      counterparty: { id: 1, name: "Ravi Patil", district: "Pune", kyc_status: "unverified", completed_deals: 0, member_since: "2025-01-01" },
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUser.role = "buyer";
});

// A farmer can never have a demand, and a buyer can never have a lot — each
// role only sees the section(s) relevant to them, not a permanently empty
// "No lots yet" / "No demands yet" section for something that isn't
// applicable to their role at all.

it("a buyer sees the Demands and Deals sections, not Lots", async () => {
  vi.mocked(api.getMyHistory).mockResolvedValue(emptyHistory);
  renderWithIntl(<HistoryPage />);

  expect(await screen.findByText(/my demands/i)).toBeInTheDocument();
  expect(screen.getByText(/my deals/i)).toBeInTheDocument();
  expect(screen.queryByText(/my lots/i)).not.toBeInTheDocument();
});

it("a farmer sees the Lots and Deals sections, not Demands", async () => {
  mockUser.role = "farmer";
  vi.mocked(api.getMyHistory).mockResolvedValue(emptyHistory);
  renderWithIntl(<HistoryPage />);

  expect(await screen.findByText(/my lots/i)).toBeInTheDocument();
  expect(screen.getByText(/my deals/i)).toBeInTheDocument();
  expect(screen.queryByText(/my demands/i)).not.toBeInTheDocument();
});

it("shows a deal's crop and a View Deal link", async () => {
  vi.mocked(api.getMyHistory).mockResolvedValue(dealHistory);
  renderWithIntl(<HistoryPage />);

  expect(await screen.findByRole("link", { name: /view deal/i })).toHaveAttribute("href", "/deals/1");
});

it("shows empty-state messages for the sections a buyer sees", async () => {
  vi.mocked(api.getMyHistory).mockResolvedValue(emptyHistory);
  renderWithIntl(<HistoryPage />);

  expect(await screen.findByText(/no demands yet/i)).toBeInTheDocument();
  expect(screen.getByText(/no deals yet/i)).toBeInTheDocument();
});

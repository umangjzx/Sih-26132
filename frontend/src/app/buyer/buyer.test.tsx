import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  listMyDemands: vi.fn().mockResolvedValue([]),
  listMyMatches: vi.fn().mockResolvedValue([]),
  createDemand: vi.fn().mockResolvedValue({ id: 1, crop: "Onion", quantity_kg: 700, quality_spec: "Grade A", price_band_min: 2000, price_band_max: 2800, delivery_window: "7 days", status: "open", buyer_id: 2 }),
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
import BuyerPage from "./page";

const verifiedMatch = {
  id: 1,
  lot: { id: 10, farmer_id: 1, crop: "Onion", quantity_kg: 500, quality_grade: "A", expected_price: 2400, location: "Pune", status: "open" },
  demand: { id: 20, crop: "Onion", quantity_kg: 700, price_band_min: 2000, price_band_max: 2800, delivery_window: "7 days", status: "open" },
  score: 85,
  score_detail: JSON.stringify({ quantity: 25, price: 40, distance: 20, total: 85, max: 100 }),
  status: "proposed",
  counterparty: { id: 1, name: "Ravi Patil", district: "Pune", kyc_status: "verified" },
};

const unverifiedMatch = {
  ...verifiedMatch,
  id: 2,
  counterparty: { id: 3, name: "Suresh", district: "Nashik", kyc_status: "unverified" },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.listMyMatches).mockResolvedValue([]);
});

it("renders the demand creation form", () => {
  renderWithIntl(<BuyerPage />);
  expect(screen.getByPlaceholderText(/e\.g\. Tomato/i)).toBeInTheDocument();
});

it("shows the verified badge for a farmer with kyc_status=verified", async () => {
  vi.mocked(api.listMyMatches).mockResolvedValue([verifiedMatch]);

  renderWithIntl(<BuyerPage />);

  expect(await screen.findByText(/Verified Farmer/i)).toBeInTheDocument();
});

it("does not show the verified badge for an unverified farmer", async () => {
  vi.mocked(api.listMyMatches).mockResolvedValue([unverifiedMatch]);

  renderWithIntl(<BuyerPage />);

  // Wait for the match list to render (crop name appears)
  expect(await screen.findByText("Onion")).toBeInTheDocument();
  expect(screen.queryByText(/Verified Farmer/i)).not.toBeInTheDocument();
});

it("shows score breakdown for each match", async () => {
  vi.mocked(api.listMyMatches).mockResolvedValue([verifiedMatch]);

  renderWithIntl(<BuyerPage />);

  expect(await screen.findByText(/85\/100/)).toBeInTheDocument();
});

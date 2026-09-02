import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  getDealById: vi.fn(),
  getDealDisputes: vi.fn().mockResolvedValue([]),
  advanceDeal: vi.fn(),
  raiseDisputeOnDeal: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "1" }),
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: 1, phone: "+910000000001", name: "Ravi Patil", role: "farmer", district: "Pune", taluka: "Haveli", kyc_status: "unverified", is_active: true },
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
import DealDetailPage from "./[id]/page";

const baseDeal = {
  id: 1,
  match_id: 1,
  agreed_price: 2500,
  agreed_quantity: 500,
  logistics_mode: "self_pickup",
  payment_status: "pending",
  pipeline_status: "matched",
  created_at: "2026-09-01T00:00:00Z",
  lot: { id: 10, farmer_id: 1, crop: "Onion", quantity_kg: 500, quality_grade: "A", expected_price: 2400, location: "Pune", status: "matched" },
  demand: { id: 20, crop: "Onion", quantity_kg: 600, price_band_min: 2000, price_band_max: 2800, delivery_window: "7 days", status: "matched" },
  counterparty: { id: 2, name: "Anil Traders", district: "Nashik", kyc_status: "verified" },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getDealDisputes).mockResolvedValue([]);
});

it("renders the 6-stage pipeline stepper with the current stage highlighted", async () => {
  vi.mocked(api.getDealById).mockResolvedValue(baseDeal);
  renderWithIntl(<DealDetailPage />);

  const stepper = await screen.findByRole("list", { name: /pipeline status/i });
  const chips = stepper.querySelectorAll("li");
  expect(chips).toHaveLength(6);
  const current = stepper.querySelector('li[aria-current="step"]');
  expect(current?.textContent).toMatch(/matched/i);
});

it("calls advanceDeal when the Advance button is clicked", async () => {
  vi.mocked(api.getDealById).mockResolvedValue(baseDeal);
  vi.mocked(api.advanceDeal).mockResolvedValue({ ...baseDeal, pipeline_status: "offer_accepted" });
  const { default: userEvent } = await import("@testing-library/user-event");
  const user = userEvent.setup();
  renderWithIntl(<DealDetailPage />);

  const btn = await screen.findByRole("button", { name: /advance to next stage/i });
  await user.click(btn);
  expect(api.advanceDeal).toHaveBeenCalledWith("1", "mock-token", {});
});

it("disables the Advance button for a closed deal", async () => {
  vi.mocked(api.getDealById).mockResolvedValue({ ...baseDeal, pipeline_status: "closed" });
  renderWithIntl(<DealDetailPage />);

  const btn = await screen.findByRole("button", { name: /already closed/i });
  expect(btn).toBeDisabled();
});

it("shows the raise-dispute form when there is no open dispute", async () => {
  vi.mocked(api.getDealById).mockResolvedValue(baseDeal);
  renderWithIntl(<DealDetailPage />);

  expect(await screen.findByPlaceholderText(/describe the issue/i)).toBeInTheDocument();
});

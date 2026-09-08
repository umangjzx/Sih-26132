import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error {},
  listAdminLots: vi.fn(),
  listAdminDemands: vi.fn(),
  closeAdminLot: vi.fn(),
  closeAdminDemand: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: 1, phone: "+910000000001", name: "Admin", role: "admin", is_active: true },
    token: "mock-token",
    isAuthenticated: true,
    ready: true,
    login: vi.fn(),
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "@/lib/api";
import { renderWithIntl, screen } from "@/test/render";
import AdminListingsPage from "./page";

const lot = {
  id: 10,
  farmer_id: 1,
  farmer_name: "Ravi Patil",
  crop: "Onion",
  quantity_kg: 500,
  quality_grade: "A",
  expected_price: 2400,
  available_from: "2026-09-01",
  location: "Pune",
  status: "open",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.listAdminLots).mockResolvedValue([lot]);
  vi.mocked(api.listAdminDemands).mockResolvedValue([]);
});

describe("AdminListingsPage close-lot reason modal", () => {
  it("opens an in-page modal instead of window.prompt when closing a lot", async () => {
    const user = userEvent.setup();
    renderWithIntl(<AdminListingsPage />);

    const closeBtn = await screen.findByRole("button", { name: /close listing/i });
    await user.click(closeBtn);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("submits the typed reason unchanged to closeAdminLot on confirm", async () => {
    const user = userEvent.setup();
    vi.mocked(api.closeAdminLot).mockResolvedValue({ ...lot, status: "closed" });
    renderWithIntl(<AdminListingsPage />);

    await user.click(await screen.findByRole("button", { name: /close listing/i }));
    const dialog = within(screen.getByRole("dialog"));
    await user.type(dialog.getByRole("textbox"), "Duplicate listing");
    await user.click(dialog.getByRole("button", { name: /close listing/i }));

    expect(api.closeAdminLot).toHaveBeenCalledWith(10, "Duplicate listing", "mock-token");
  });

  it("cancels without calling the API", async () => {
    const user = userEvent.setup();
    renderWithIntl(<AdminListingsPage />);

    await user.click(await screen.findByRole("button", { name: /close listing/i }));
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.closeAdminLot).not.toHaveBeenCalled();
  });
});

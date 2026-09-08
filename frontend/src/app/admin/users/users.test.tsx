import { within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error {},
  getAdminUsers: vi.fn(),
  verifyUser: vi.fn(),
  setUserActive: vi.fn(),
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

import * as api from "@/lib/api";
import { renderWithIntl, screen } from "@/test/render";
import AdminUsersPage from "./page";

const pendingUser = {
  id: 2,
  name: "Suresh",
  phone: "+910000000002",
  role: "farmer",
  district: "Nashik",
  state: "Maharashtra",
  kyc_status: "pending",
  verification_status: "pending" as const,
  verification_note: null,
  verification_ref: null,
  is_active: true,
  created_at: "2026-09-01T00:00:00Z",
  lots: 0,
  demands: 0,
  deals: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getAdminUsers).mockResolvedValue([pendingUser]);
});

describe("AdminUsersPage reject reason modal", () => {
  it("opens an in-page modal instead of window.prompt when rejecting", async () => {
    const user = userEvent.setup();
    renderWithIntl(<AdminUsersPage />);

    await user.click(await screen.findByRole("button", { name: /reject/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("submits the typed reason unchanged to verifyUser on confirm", async () => {
    const user = userEvent.setup();
    vi.mocked(api.verifyUser).mockResolvedValue({ ...pendingUser, verification_status: "rejected" });
    renderWithIntl(<AdminUsersPage />);

    await user.click(await screen.findByRole("button", { name: /reject/i }));
    const dialog = within(screen.getByRole("dialog"));
    await user.type(dialog.getByRole("textbox"), "Documents unreadable");
    await user.click(dialog.getByRole("button", { name: /reject/i }));

    expect(api.verifyUser).toHaveBeenCalledWith(2, "rejected", "Documents unreadable", "mock-token");
  });

  it("cancels without calling the API", async () => {
    const user = userEvent.setup();
    renderWithIntl(<AdminUsersPage />);

    await user.click(await screen.findByRole("button", { name: /reject/i }));
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.verifyUser).not.toHaveBeenCalled();
  });
});

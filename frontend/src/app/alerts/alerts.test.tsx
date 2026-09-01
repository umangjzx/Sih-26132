import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  listAlerts: vi.fn(),
  createAlert: vi.fn(),
  toggleAlert: vi.fn(),
  deleteAlert: vi.fn(),
}));

let authed = true;
vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: 1, name: "Ravi", role: "farmer", district: "Pune" },
    token: "tok",
    isAuthenticated: authed,
    login: vi.fn(),
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import * as api from "@/lib/api";
import { renderWithIntl, screen } from "@/test/render";
import AlertsPage from "./page";

beforeEach(() => {
  authed = true;
  vi.clearAllMocks();
  vi.mocked(api.listAlerts).mockResolvedValue([]);
});

it("shows the create form and an empty state", async () => {
  renderWithIntl(<AlertsPage />);
  expect(await screen.findByRole("button", { name: /add alert/i })).toBeInTheDocument();
  expect(await screen.findByText(/No alerts yet/i)).toBeInTheDocument();
});

it("lists an existing alert", async () => {
  vi.mocked(api.listAlerts).mockResolvedValue([
    { id: 1, user_id: 1, crop: "Onion", market: "Pune", direction: "above", threshold: 2000, active: true, last_triggered_at: null, created_at: "2026-09-01T00:00:00Z" },
  ]);
  renderWithIntl(<AlertsPage />);
  expect(await screen.findByText("Onion")).toBeInTheDocument();
  expect(screen.getByText(/Pause/i)).toBeInTheDocument();
});

it("prompts to log in when unauthenticated", async () => {
  authed = false;
  renderWithIntl(<AlertsPage />);
  expect(await screen.findByText(/Log in to manage price alerts/i)).toBeInTheDocument();
});

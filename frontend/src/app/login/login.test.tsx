import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

// Mocks must be declared before any imports that use the mocked modules.
vi.mock("@/lib/api", () => ({
  login: vi.fn(),
}));

const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockLogin = vi.fn();
vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({
    user: null,
    token: null,
    isAuthenticated: false,
    login: mockLogin,
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import * as api from "@/lib/api";
import { renderWithIntl, screen } from "@/test/render";
import LoginPage from "./page";

const USER = {
  id: 1,
  phone: "+910000000001",
  name: "Ravi",
  role: "farmer" as const,
  district: "Pune",
  taluka: "Haveli",
  kyc_status: "unverified",
  is_active: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

it("renders a single-step login form", () => {
  renderWithIntl(<LoginPage />);
  expect(screen.getByPlaceholderText("+91XXXXXXXXXX")).toBeInTheDocument();
  expect(screen.getByPlaceholderText(/Enter your name/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Continue/i })).toBeInTheDocument();
});

it("submitting calls login() with phone, name, role", async () => {
  vi.mocked(api.login).mockResolvedValue({
    access_token: "tok", refresh_token: "ref", token_type: "bearer", user: USER,
  });
  renderWithIntl(<LoginPage />);

  await userEvent.type(screen.getByPlaceholderText("+91XXXXXXXXXX"), "+910000000001");
  await userEvent.type(screen.getByPlaceholderText(/Enter your name/i), "Ravi");
  await userEvent.click(screen.getByRole("button", { name: /Continue/i }));

  expect(api.login).toHaveBeenCalledWith("+910000000001", "Ravi", "farmer");
});

it("successful login calls login() with tokens and user, then redirects", async () => {
  vi.mocked(api.login).mockResolvedValue({
    access_token: "tok", refresh_token: "ref", token_type: "bearer", user: USER,
  });
  renderWithIntl(<LoginPage />);

  await userEvent.type(screen.getByPlaceholderText("+91XXXXXXXXXX"), "+910000000001");
  await userEvent.type(screen.getByPlaceholderText(/Enter your name/i), "Ravi");
  await userEvent.click(screen.getByRole("button", { name: /Continue/i }));

  expect(mockLogin).toHaveBeenCalledWith("tok", "ref", expect.objectContaining({ role: "farmer" }));
  expect(mockReplace).toHaveBeenCalledWith("/farmer");
});

it("a failed login shows the error message", async () => {
  vi.mocked(api.login).mockRejectedValue(new Error("Request failed: 500"));
  renderWithIntl(<LoginPage />);

  await userEvent.type(screen.getByPlaceholderText("+91XXXXXXXXXX"), "+910000000001");
  await userEvent.type(screen.getByPlaceholderText(/Enter your name/i), "Ravi");
  await userEvent.click(screen.getByRole("button", { name: /Continue/i }));

  expect(await screen.findByText(/Could not sign in/i)).toBeInTheDocument();
});

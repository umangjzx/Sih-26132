import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

// Mocks must be declared before any imports that use the mocked modules.
vi.mock("@/lib/api", () => ({
  requestOtp: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

// Provide a minimal AuthProvider mock so useAuth() resolves without real context.
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

beforeEach(() => {
  vi.clearAllMocks();
});

it("renders the phone step on first load", () => {
  renderWithIntl(<LoginPage />);
  expect(screen.getByPlaceholderText("+91XXXXXXXXXX")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Send OTP/i })).toBeInTheDocument();
});

it("submitting phone step calls requestOtp with correct args", async () => {
  vi.mocked(api.requestOtp).mockResolvedValue({ detail: "OTP sent" });
  renderWithIntl(<LoginPage />);

  await userEvent.type(screen.getByPlaceholderText("+91XXXXXXXXXX"), "+910000000001");
  await userEvent.type(screen.getByPlaceholderText(/Enter your name/i), "Ravi");
  await userEvent.click(screen.getByRole("button", { name: /Send OTP/i }));

  expect(api.requestOtp).toHaveBeenCalledWith("+910000000001", "Ravi", "farmer");
});

it("transitions to OTP step after requestOtp resolves", async () => {
  vi.mocked(api.requestOtp).mockResolvedValue({ detail: "OTP sent" });
  renderWithIntl(<LoginPage />);

  await userEvent.type(screen.getByPlaceholderText("+91XXXXXXXXXX"), "+910000000001");
  await userEvent.type(screen.getByPlaceholderText(/Enter your name/i), "Ravi");
  await userEvent.click(screen.getByRole("button", { name: /Send OTP/i }));

  // OTP step shows OTP input; phone input is gone
  expect(await screen.findByPlaceholderText(/6-digit code/i)).toBeInTheDocument();
  expect(screen.queryByPlaceholderText("+91XXXXXXXXXX")).not.toBeInTheDocument();
});

it("OTP step: submitting calls verifyOtp", async () => {
  vi.mocked(api.requestOtp).mockResolvedValue({ detail: "OTP sent" });
  vi.mocked(api.verifyOtp).mockResolvedValue({
    access_token: "tok",
    refresh_token: "ref",
    token_type: "bearer",
    user: { id: 1, phone: "+910000000001", name: "Ravi", role: "farmer", district: "Pune", taluka: "Haveli", kyc_status: "unverified", is_active: true },
  });
  renderWithIntl(<LoginPage />);

  // Complete phone step
  await userEvent.type(screen.getByPlaceholderText("+91XXXXXXXXXX"), "+910000000001");
  await userEvent.type(screen.getByPlaceholderText(/Enter your name/i), "Ravi");
  await userEvent.click(screen.getByRole("button", { name: /Send OTP/i }));

  // OTP step
  await userEvent.type(await screen.findByPlaceholderText(/6-digit code/i), "123456");
  await userEvent.click(screen.getByRole("button", { name: /Verify/i }));

  expect(api.verifyOtp).toHaveBeenCalledWith("+910000000001", "123456");
});

it("successful verify calls login() with the user data", async () => {
  vi.mocked(api.requestOtp).mockResolvedValue({ detail: "OTP sent" });
  vi.mocked(api.verifyOtp).mockResolvedValue({
    access_token: "tok",
    refresh_token: "ref",
    token_type: "bearer",
    user: { id: 1, phone: "+910000000001", name: "Ravi", role: "farmer", district: "Pune", taluka: "Haveli", kyc_status: "unverified", is_active: true },
  });

  renderWithIntl(<LoginPage />);

  await userEvent.type(screen.getByPlaceholderText("+91XXXXXXXXXX"), "+910000000001");
  await userEvent.type(screen.getByPlaceholderText(/Enter your name/i), "Ravi");
  await userEvent.click(screen.getByRole("button", { name: /Send OTP/i }));
  await userEvent.type(await screen.findByPlaceholderText(/6-digit code/i), "123456");
  await userEvent.click(screen.getByRole("button", { name: /Verify/i }));

  // login() called with correct tokens and user
  expect(mockLogin).toHaveBeenCalledWith("tok", "ref", expect.objectContaining({ role: "farmer" }));
});

it("failed OTP verify shows the invalidOtp error message", async () => {
  vi.mocked(api.requestOtp).mockResolvedValue({ detail: "OTP sent" });
  vi.mocked(api.verifyOtp).mockRejectedValue(new Error("Request failed: 401"));

  renderWithIntl(<LoginPage />);

  await userEvent.type(screen.getByPlaceholderText("+91XXXXXXXXXX"), "+910000000001");
  await userEvent.type(screen.getByPlaceholderText(/Enter your name/i), "Ravi");
  await userEvent.click(screen.getByRole("button", { name: /Send OTP/i }));
  await userEvent.type(await screen.findByPlaceholderText(/6-digit code/i), "000000");
  await userEvent.click(screen.getByRole("button", { name: /Verify/i }));

  expect(await screen.findByText(/Invalid or expired OTP/i)).toBeInTheDocument();
});

it("Back button returns to the phone step", async () => {
  vi.mocked(api.requestOtp).mockResolvedValue({ detail: "OTP sent" });
  renderWithIntl(<LoginPage />);

  await userEvent.type(screen.getByPlaceholderText("+91XXXXXXXXXX"), "+910000000001");
  await userEvent.type(screen.getByPlaceholderText(/Enter your name/i), "Ravi");
  await userEvent.click(screen.getByRole("button", { name: /Send OTP/i }));

  await userEvent.click(await screen.findByRole("button", { name: /Back/i }));

  expect(screen.getByPlaceholderText("+91XXXXXXXXXX")).toBeInTheDocument();
});

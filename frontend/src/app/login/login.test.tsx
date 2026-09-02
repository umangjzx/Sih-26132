import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  login: vi.fn(),
  register: vi.fn(),
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
const AUTH = { access_token: "tok", refresh_token: "ref", token_type: "bearer", user: USER };

beforeEach(() => {
  vi.clearAllMocks();
});

it("defaults to the sign-in form (phone + password, no name field)", () => {
  renderWithIntl(<LoginPage />);
  expect(screen.getByPlaceholderText("+91XXXXXXXXXX")).toBeInTheDocument();
  expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
  expect(screen.queryByPlaceholderText(/Enter your name/i)).not.toBeInTheDocument();
});

it("sign in calls login() with phone + password, then redirects", async () => {
  vi.mocked(api.login).mockResolvedValue(AUTH);
  renderWithIntl(<LoginPage />);

  await userEvent.type(screen.getByPlaceholderText("+91XXXXXXXXXX"), "+910000000001");
  await userEvent.type(screen.getByLabelText(/Password/i), "s3cret!!");
  await userEvent.click(screen.getByRole("button", { name: /^Continue$/i }));

  expect(api.login).toHaveBeenCalledWith("+910000000001", "s3cret!!");
  expect(mockLogin).toHaveBeenCalledWith("tok", "ref", expect.objectContaining({ role: "farmer" }));
  expect(mockReplace).toHaveBeenCalledWith("/farmer");
});

it("wrong credentials show the badCredentials error", async () => {
  vi.mocked(api.login).mockRejectedValue(new Error("Request failed: 401"));
  renderWithIntl(<LoginPage />);

  await userEvent.type(screen.getByPlaceholderText("+91XXXXXXXXXX"), "+910000000001");
  await userEvent.type(screen.getByLabelText(/Password/i), "nope");
  await userEvent.click(screen.getByRole("button", { name: /^Continue$/i }));

  expect(await screen.findByText(/Wrong phone number or password/i)).toBeInTheDocument();
});

it("register tab reveals name + role and calls register()", async () => {
  vi.mocked(api.register).mockResolvedValue(AUTH);
  renderWithIntl(<LoginPage />);

  await userEvent.click(screen.getByRole("button", { name: /Create account/i }));
  await userEvent.type(screen.getByPlaceholderText("+91XXXXXXXXXX"), "+910000000001");
  await userEvent.type(screen.getByPlaceholderText(/Enter your name/i), "Ravi");
  await userEvent.type(screen.getByLabelText(/Password/i), "s3cret!!");
  await userEvent.click(screen.getByRole("button", { name: /^Continue$/i }));

  expect(api.register).toHaveBeenCalledWith("+910000000001", "Ravi", "farmer", "s3cret!!");
  expect(mockLogin).toHaveBeenCalledWith("tok", "ref", expect.objectContaining({ role: "farmer" }));
});

it("a demo-account button signs in with that account's credentials", async () => {
  vi.mocked(api.login).mockResolvedValue(AUTH);
  renderWithIntl(<LoginPage />);

  await userEvent.click(screen.getByRole("button", { name: /Anita Traders/i }));

  expect(api.login).toHaveBeenCalledWith("+919000000003", "buyer123");
  expect(mockLogin).toHaveBeenCalledWith("tok", "ref", expect.anything());
});

it("registering a taken phone flips back to sign in with a hint", async () => {
  vi.mocked(api.register).mockRejectedValue(new Error("Request failed: 409"));
  renderWithIntl(<LoginPage />);

  await userEvent.click(screen.getByRole("button", { name: /Create account/i }));
  await userEvent.type(screen.getByPlaceholderText("+91XXXXXXXXXX"), "+910000000001");
  await userEvent.type(screen.getByPlaceholderText(/Enter your name/i), "Ravi");
  await userEvent.type(screen.getByLabelText(/Password/i), "s3cret!!");
  await userEvent.click(screen.getByRole("button", { name: /^Continue$/i }));

  expect(await screen.findByText(/already has an account/i)).toBeInTheDocument();
  // back on the sign-in form: name field gone
  expect(screen.queryByPlaceholderText(/Enter your name/i)).not.toBeInTheDocument();
});

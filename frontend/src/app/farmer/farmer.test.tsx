import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  listMyLots: vi.fn().mockResolvedValue([]),
  createLot: vi.fn().mockResolvedValue({ id: 1, crop: "Onion", quantity_kg: 500, quality_grade: "A", expected_price: 2400, available_from: "2026-10-01", location: "Pune", status: "open", farmer_id: 1, photo_url: null }),
  fetchStorageNearby: vi.fn().mockResolvedValue([]),
  fetchFpoNearby: vi.fn().mockResolvedValue([]),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: 1, phone: "+910000000001", name: "Ravi", role: "farmer", district: "Pune", taluka: "Haveli", kyc_status: "unverified", is_active: true },
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
import FarmerPage from "./page";

const QUEUE_KEY = "agrilink.lot_queue";
const DRAFT_KEY = "agrilink.lot_draft";

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  // Default: online
  Object.defineProperty(navigator, "onLine", { value: true, writable: true, configurable: true });
});

afterEach(() => {
  localStorage.clear();
});

it("renders the create lot form", () => {
  renderWithIntl(<FarmerPage />);
  expect(screen.getByPlaceholderText(/e\.g\. Onion/i)).toBeInTheDocument();
});

it("saves draft to localStorage on every keystroke", async () => {
  renderWithIntl(<FarmerPage />);
  const cropInput = screen.getByPlaceholderText(/e\.g\. Onion/i);
  await userEvent.type(cropInput, "T");
  const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}");
  expect(draft.crop).toContain("T");
});

it("submits to API when online", async () => {
  vi.mocked(api.createLot).mockResolvedValue({
    id: 1, crop: "Onion", quantity_kg: 500, quality_grade: "A",
    expected_price: 2400, available_from: "2026-10-01", location: "Pune",
    status: "open", farmer_id: 1, photo_url: null,
  });

  const { container } = renderWithIntl(<FarmerPage />);
  const { fireEvent } = await import("@testing-library/react");

  // Fill all required fields via fireEvent to bypass jsdom date input quirks
  const form = container.querySelector("form") as HTMLFormElement;
  const inputs = form.querySelectorAll("input, select");
  // crop, quantity_kg, quality_grade (select), expected_price, available_from, location
  fireEvent.change(inputs[0], { target: { value: "Onion" } });       // crop
  fireEvent.change(inputs[1], { target: { value: "500" } });         // quantity_kg
  // inputs[2] is quality_grade select — already defaulted to "A"
  fireEvent.change(inputs[3], { target: { value: "2400" } });        // expected_price
  fireEvent.change(inputs[4], { target: { value: "2026-10-01" } });  // available_from
  fireEvent.change(inputs[5], { target: { value: "Pune" } });        // location
  fireEvent.submit(form);

  // createLot should be called (async — wait for it)
  await vi.waitFor(() => {
    expect(api.createLot).toHaveBeenCalled();
  });
});

it("queues to localStorage when offline instead of calling API", async () => {
  Object.defineProperty(navigator, "onLine", { value: false, writable: true, configurable: true });

  const { container } = renderWithIntl(<FarmerPage />);
  const { fireEvent } = await import("@testing-library/react");

  const form = container.querySelector("form") as HTMLFormElement;
  const inputs = form.querySelectorAll("input, select");
  fireEvent.change(inputs[0], { target: { value: "Tomato" } });
  fireEvent.change(inputs[1], { target: { value: "300" } });
  fireEvent.change(inputs[3], { target: { value: "1800" } });
  fireEvent.change(inputs[4], { target: { value: "2026-10-01" } });
  fireEvent.change(inputs[5], { target: { value: "Nashik" } });
  fireEvent.submit(form);

  expect(api.createLot).not.toHaveBeenCalled();
  await vi.waitFor(() => {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
    expect(queue.length).toBeGreaterThan(0);
  });
  const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
  expect(queue[0].crop).toBe("Tomato");
});

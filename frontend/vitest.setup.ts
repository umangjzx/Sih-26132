import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { vi } from "vitest";

// recharts' ResponsiveContainer measures its parent; jsdom reports 0x0 so the
// chart never draws (and floods the console with width/height warnings). Replace
// it with a passthrough so PriceTrendChart mounts without rendering an SVG.
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactNode }) => children,
  };
});

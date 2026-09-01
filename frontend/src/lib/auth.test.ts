/**
 * Unit tests for auth.ts localStorage helpers.
 * Pure unit — no React, no DOM render.
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  clearAuth,
  getRefreshToken,
  getStoredUser,
  getToken,
  saveAuth,
  type StoredUser,
} from "@/lib/auth";

const MOCK_USER: StoredUser = {
  id: 1,
  phone: "+910000000001",
  name: "Ravi Patil",
  role: "farmer",
  district: "Pune",
  taluka: "Haveli",
  kyc_status: "unverified",
  is_active: true,
};

afterEach(() => {
  // Clean localStorage between tests
  localStorage.clear();
});

describe("saveAuth / getToken", () => {
  it("saves and retrieves the access token", () => {
    saveAuth("tok-abc", "ref-xyz", MOCK_USER);
    expect(getToken()).toBe("tok-abc");
  });

  it("saves and retrieves the refresh token", () => {
    saveAuth("tok-abc", "ref-xyz", MOCK_USER);
    expect(getRefreshToken()).toBe("ref-xyz");
  });

  it("saves and retrieves the stored user with all fields intact", () => {
    saveAuth("tok-abc", "ref-xyz", MOCK_USER);
    const user = getStoredUser();
    expect(user).not.toBeNull();
    expect(user?.id).toBe(1);
    expect(user?.role).toBe("farmer");
    expect(user?.phone).toBe("+910000000001");
    expect(user?.name).toBe("Ravi Patil");
    expect(user?.district).toBe("Pune");
    expect(user?.kyc_status).toBe("unverified");
  });
});

describe("clearAuth", () => {
  it("removes all three keys from localStorage", () => {
    saveAuth("tok-abc", "ref-xyz", MOCK_USER);
    clearAuth();
    expect(getToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
  });
});

describe("getStoredUser", () => {
  it("returns null when nothing is stored", () => {
    expect(getStoredUser()).toBeNull();
  });

  it("returns null without throwing on invalid JSON", () => {
    localStorage.setItem("agrilink.user", "not-valid-json{{{");
    expect(() => getStoredUser()).not.toThrow();
    expect(getStoredUser()).toBeNull();
  });
});

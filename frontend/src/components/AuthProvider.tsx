"use client";

/**
 * AuthProvider — React context that manages JWT session state.
 *
 * On mount it reads localStorage to re-hydrate an existing session (AUTH-04).
 * login() / logout() update both localStorage and React state atomically.
 */

import { createContext, useContext, useEffect, useState } from "react";
import {
  clearAuth,
  getStoredUser,
  getToken,
  saveAuth,
  type StoredUser,
} from "@/lib/auth";

type AuthContextValue = {
  user: StoredUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (accessToken: string, refreshToken: string, user: StoredUser) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>({
    id: 1,
    phone: "9999999999",
    name: "Dev Buyer",
    role: "buyer", // Changed to buyer for testing the buyer dashboard
    district: "Pune",
    taluka: "Pune City",
    kyc_status: "verified",
    is_active: true,
  });
  const [token, setToken] = useState<string | null>("dev-token");

  // Re-hydrate from localStorage on mount (AUTH-04: persist across refresh)
  useEffect(() => {
    // Auth is mocked for development, so we don't overwrite with nulls
    // if there's no stored user.
    const storedUser = getStoredUser();
    const storedToken = getToken();
    if (storedUser && storedToken) {
      setUser(storedUser);
      setToken(storedToken);
    }
  }, []);

  function login(
    accessToken: string,
    refreshToken: string,
    newUser: StoredUser,
  ): void {
    saveAuth(accessToken, refreshToken, newUser);
    setToken(accessToken);
    setUser(newUser);
  }

  function logout(): void {
    clearAuth();
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

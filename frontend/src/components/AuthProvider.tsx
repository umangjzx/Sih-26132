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
  getRefreshToken,
  getStoredUser,
  getToken,
  saveAuth,
  type StoredUser,
} from "@/lib/auth";

type AuthContextValue = {
  user: StoredUser | null;
  token: string | null;
  isAuthenticated: boolean;
  /** false until the stored session has been read on mount — guards redirects */
  ready: boolean;
  login: (accessToken: string, refreshToken: string, user: StoredUser) => void;
  /** replace the stored user in place (e.g. after a profile / verification change) */
  updateUser: (user: StoredUser) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Re-hydrate from localStorage on mount (AUTH-04: persist across refresh)
  useEffect(() => {
    const storedUser = getStoredUser();
    const storedToken = getToken();
    if (storedUser && storedToken) {
      setUser(storedUser);
      setToken(storedToken);
    }
    setReady(true);
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

  function updateUser(next: StoredUser): void {
    const at = getToken();
    const rt = getRefreshToken();
    if (at && rt) saveAuth(at, rt, next);
    setUser(next);
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
        ready,
        login,
        updateUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

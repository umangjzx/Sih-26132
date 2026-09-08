"use client";

/**
 * AuthProvider — React context that manages JWT session state.
 *
 * On mount it reads localStorage to re-hydrate an existing session (AUTH-04).
 * login() / logout() update both localStorage and React state atomically.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  clearAuth,
  getRefreshToken,
  getStoredUser,
  getToken,
  saveAuth,
  setAuthListeners,
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

  // React to background token changes from the fetch layer: a successful
  // silent refresh swaps in a new access token; a failed one logs us out.
  useEffect(() => {
    setAuthListeners({
      onRefreshed: (t) => setToken(t),
      onCleared: () => {
        setToken(null);
        setUser(null);
      },
    });
    return () => setAuthListeners({});
  }, []);

  const login = useCallback((accessToken: string, refreshToken: string, newUser: StoredUser): void => {
    saveAuth(accessToken, refreshToken, newUser);
    setToken(accessToken);
    setUser(newUser);
  }, []);

  const updateUser = useCallback((next: StoredUser): void => {
    const at = getToken();
    const rt = getRefreshToken();
    if (at && rt) saveAuth(at, rt, next);
    setUser(next);
  }, []);

  const logout = useCallback((): void => {
    clearAuth();
    setToken(null);
    setUser(null);
  }, []);

  // Every page in the app calls useAuth() for its own auth-guard/redirect
  // logic, so an unmemoized value object here re-rendered the entire tree
  // on every token refresh (token changes fairly often via silent refresh)
  // and on every AuthProvider render otherwise, regardless of whether a
  // given consumer cared about anything but e.g. `ready`.
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: !!token && !!user,
      ready,
      login,
      updateUser,
      logout,
    }),
    [user, token, ready, login, updateUser, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * JWT storage helpers and StoredUser type.
 *
 * All auth state is kept in localStorage under three keys.
 * AuthProvider reads these on mount to re-hydrate the session (AUTH-04).
 */

const TOKEN_KEY = "agrilink.token";
const REFRESH_KEY = "agrilink.refresh_token";
const USER_KEY = "agrilink.user";

export type StoredUser = {
  id: number;
  phone: string;
  name: string;
  role: "farmer" | "buyer" | "admin";
  district: string;
  taluka: string;
  kyc_status: string;
  is_active: boolean;
};

export function saveAuth(
  accessToken: string,
  refreshToken: string,
  user: StoredUser,
): void {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function getStoredUser(): StoredUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

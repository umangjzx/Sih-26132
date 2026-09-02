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
  state?: string;
  latitude?: number | null;
  longitude?: number | null;
  kyc_status: string;
  verification_status?: "unverified" | "pending" | "verified" | "rejected";
  verification_note?: string | null;
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

// ---------------------------------------------------------------------------
// Transparent access-token refresh
// ---------------------------------------------------------------------------

const API_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) ||
  "http://localhost:8000";

let _onCleared: (() => void) | null = null;
let _onRefreshed: ((token: string) => void) | null = null;
let _inFlight: Promise<string | null> | null = null;

/** AuthProvider registers these so the React tree reacts to background
 *  token changes (refresh success) and forced logout (refresh failure). */
export function setAuthListeners(opts: {
  onCleared?: () => void;
  onRefreshed?: (token: string) => void;
}): void {
  _onCleared = opts.onCleared ?? null;
  _onRefreshed = opts.onRefreshed ?? null;
}

function forceLogout(): void {
  clearAuth();
  _onCleared?.();
}

/** Exchange the stored refresh token for a new access token. De-duplicates
 *  concurrent callers. Returns the new access token, or null (and clears the
 *  session) if the refresh token is missing / rejected. */
export function refreshAccessToken(): Promise<string | null> {
  if (_inFlight) return _inFlight;
  _inFlight = (async () => {
    const rt = getRefreshToken();
    const user = getStoredUser();
    if (!rt || !user) {
      forceLogout();
      return null;
    }
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: rt }),
      });
      if (!res.ok) {
        forceLogout();
        return null;
      }
      const j = (await res.json()) as { access_token: string; refresh_token: string };
      saveAuth(j.access_token, j.refresh_token, user);
      _onRefreshed?.(j.access_token);
      return j.access_token;
    } catch {
      // network blip — don't nuke the session, just fail this attempt
      return null;
    } finally {
      _inFlight = null;
    }
  })();
  return _inFlight;
}

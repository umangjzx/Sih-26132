"use client";

/**
 * v1.2 — location awareness. AgriLink works anywhere in India; Maharashtra
 * stays the rich default. The chosen location is persisted in localStorage and
 * used to scope price options, the public overview, and the storage/FPO
 * directory. When nothing is set, `location` is null and callers fall back to
 * the national feed (or the Maharashtra default the backend ships with).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { resolveLocation, type ResolvedLocation } from "@/lib/api";

const STORAGE_KEY = "agrilink.location";

export type AppLocation = {
  state: string;
  district: string;
  label: string;
  lat: number | null;
  lon: number | null;
  source: string;
};

export type LocationError = "denied" | "unsupported" | "resolve" | null;

type LocationContextValue = {
  location: AppLocation | null;
  loading: boolean;
  error: LocationError;
  detect: () => void;
  setPlace: (place: string) => Promise<void>;
  setStateName: (state: string) => Promise<void>;
  clear: () => void;
};

const FALLBACK: LocationContextValue = {
  location: null,
  loading: false,
  error: null,
  detect: () => {},
  setPlace: async () => {},
  setStateName: async () => {},
  clear: () => {},
};

const LocationContext = createContext<LocationContextValue | null>(null);

/** Safe to call outside a provider (tests, SSR) — returns an inert fallback. */
export function useLocation(): LocationContextValue {
  return useContext(LocationContext) ?? FALLBACK;
}

function toAppLocation(r: ResolvedLocation): AppLocation {
  return {
    state: r.state,
    district: r.district,
    label: r.district ? `${r.district}, ${r.state}` : r.state,
    lat: r.latitude,
    lon: r.longitude,
    source: r.source,
  };
}

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useState<AppLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LocationError>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setLocation(JSON.parse(raw) as AppLocation);
    } catch {
      /* corrupt or unavailable storage — ignore */
    }
  }, []);

  const persist = useCallback((next: AppLocation | null) => {
    setLocation(next);
    try {
      if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  /**
   * Resolve fast (no server-side ingest), persist immediately, then warm that
   * state's prices in the background so a dropdown pick never blocks the UI.
   */
  const resolveAndWarm = useCallback(
    async (args: { lat?: number; lon?: number; place?: string }) => {
      setLoading(true);
      setError(null);
      try {
        const r = await resolveLocation({ ...args, ensurePrices: false });
        persist(toAppLocation(r));
        if (r.state && r.has_prices === false) {
          // fire-and-forget: pull this state's live data, refresh label on success
          void resolveLocation({ ...args, ensurePrices: true })
            .then((warm) => {
              if (warm.has_prices) persist(toAppLocation(warm));
            })
            .catch(() => {});
        }
      } catch {
        if (args.place) {
          persist({ state: args.place, district: "", label: args.place,
                    lat: null, lon: null, source: "manual" });
        } else {
          setError("resolve");
        }
      } finally {
        setLoading(false);
      }
    },
    [persist],
  );

  const detect = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("unsupported");
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolveAndWarm({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {
        setError("denied");
        setLoading(false);
      },
      { timeout: 10000, maximumAge: 600000 },
    );
  }, [resolveAndWarm]);

  const setPlace = useCallback(
    (place: string) => resolveAndWarm({ place }),
    [resolveAndWarm],
  );

  const setStateName = useCallback(
    (state: string) => resolveAndWarm({ place: state }),
    [resolveAndWarm],
  );

  const clear = useCallback(() => persist(null), [persist]);

  const value = useMemo(
    () => ({ location, loading, error, detect, setPlace, setStateName, clear }),
    [location, loading, error, detect, setPlace, setStateName, clear],
  );

  return (
    <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
  );
}

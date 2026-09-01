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

  const detect = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("unsupported");
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const r = await resolveLocation({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            ensurePrices: true,
          });
          persist(toAppLocation(r));
        } catch {
          setError("resolve");
        } finally {
          setLoading(false);
        }
      },
      () => {
        setError("denied");
        setLoading(false);
      },
      { timeout: 10000, maximumAge: 600000 },
    );
  }, [persist]);

  const setPlace = useCallback(
    async (place: string) => {
      setLoading(true);
      setError(null);
      try {
        const r = await resolveLocation({ place, ensurePrices: true });
        persist(toAppLocation(r));
      } catch {
        setError("resolve");
      } finally {
        setLoading(false);
      }
    },
    [persist],
  );

  const setStateName = useCallback(
    async (state: string) => {
      setLoading(true);
      setError(null);
      try {
        const r = await resolveLocation({ place: state, ensurePrices: true });
        persist(toAppLocation(r));
      } catch {
        persist({
          state,
          district: "",
          label: state,
          lat: null,
          lon: null,
          source: "manual",
        });
      } finally {
        setLoading(false);
      }
    },
    [persist],
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

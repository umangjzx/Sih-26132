"use client";

/**
 * Shared crop + market selection, persisted in the URL query string so links
 * are shareable and the state survives navigation between /prices and /advisor.
 * Falls back to the first entry from /api/options.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchOptions, type CropMarketOption } from "@/lib/api";
import { useLocation } from "@/lib/useLocation";

export type CropMarketState = {
  options: CropMarketOption[];
  crops: string[];
  marketsForCrop: string[];
  crop: string;
  market: string;
  district: string;
  ready: boolean;
  error: boolean;
  /** loaded, but the active state has no price data (e.g. a just-picked state) */
  noDataForState: boolean;
  /** the scoping state, if any (for a "reset to Maharashtra" affordance) */
  scopeState?: string;
  setCrop: (crop: string) => void;
  setMarket: (market: string) => void;
  retry: () => void;
};

export function useCropMarket(): CropMarketState {
  const router = useRouter();
  const params = useSearchParams();
  const urlCrop = params.get("crop") ?? "";
  const urlMarket = params.get("market") ?? "";
  const { location, warmTick } = useLocation();
  const stateScope = location?.state;
  const lat = location?.lat ?? null;
  const lon = location?.lon ?? null;

  const [options, setOptions] = useState<CropMarketOption[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  const loadOptions = useCallback(async () => {
    setError(false);
    try {
      // coords -> markets sorted nearest-first (a big state's picker is huge)
      const opts = await fetchOptions(stateScope, { lat, lon });
      setOptions(opts);
      setReady(true);
    } catch {
      setError(true);
    }
    // warmTick: refetch once a background per-state price warm completes
  }, [stateScope, lat, lon, warmTick]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  // Preserve the server order (nearest-first when coords were sent) so the most
  // relevant crops surface; the picker adds a type-to-filter box on top.
  const crops = useMemo(
    () => [...new Set(options.map((o) => o.crop))],
    [options],
  );

  // Once options for the (new) state are in, a lingering ?crop= from a previous
  // state may not exist here — fall back to the first available crop.
  const crop =
    urlCrop && (crops.length === 0 || crops.includes(urlCrop))
      ? urlCrop
      : options[0]?.crop || "";
  const marketsForCrop = useMemo(
    () => options.filter((o) => o.crop === crop).map((o) => o.market),
    [options, crop],
  );
  const market =
    urlMarket && marketsForCrop.includes(urlMarket)
      ? urlMarket
      : marketsForCrop[0] || "";
  const district =
    options.find((o) => o.crop === crop && o.market === market)?.district ?? "";

  // Keep the URL honest after a location switch so shared links stay valid.
  useEffect(() => {
    if (!ready || options.length === 0) return;
    if ((urlCrop && urlCrop !== crop) || (urlMarket && urlMarket !== market)) {
      const sp = new URLSearchParams(params.toString());
      sp.set("crop", crop);
      sp.set("market", market);
      router.replace(`?${sp.toString()}`, { scroll: false });
    }
  }, [ready, options.length, urlCrop, urlMarket, crop, market, params, router]);

  const write = useCallback(
    (next: { crop?: string; market?: string }) => {
      const sp = new URLSearchParams(params.toString());
      if (next.crop !== undefined) sp.set("crop", next.crop);
      if (next.market !== undefined) sp.set("market", next.market);
      router.replace(`?${sp.toString()}`, { scroll: false });
    },
    [params, router],
  );

  const setCrop = useCallback(
    (c: string) => {
      const firstMarket = options.find((o) => o.crop === c)?.market ?? "";
      write({ crop: c, market: firstMarket });
    },
    [options, write],
  );
  const setMarket = useCallback((m: string) => write({ market: m }), [write]);

  return {
    options,
    crops,
    marketsForCrop,
    crop,
    market,
    district,
    ready,
    error,
    noDataForState:
      ready && options.length === 0 && !!stateScope && stateScope !== "Maharashtra",
    scopeState: stateScope,
    setCrop,
    setMarket,
    retry: loadOptions,
  };
}

"use client";

/**
 * Shared crop + market selection, persisted in the URL query string so links
 * are shareable and the state survives navigation between /prices and /advisor.
 * Falls back to the first entry from /api/options.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchOptions, type CropMarketOption } from "@/lib/api";

export type CropMarketState = {
  options: CropMarketOption[];
  crops: string[];
  marketsForCrop: string[];
  crop: string;
  market: string;
  district: string;
  ready: boolean;
  error: boolean;
  setCrop: (crop: string) => void;
  setMarket: (market: string) => void;
  retry: () => void;
};

export function useCropMarket(): CropMarketState {
  const router = useRouter();
  const params = useSearchParams();
  const urlCrop = params.get("crop") ?? "";
  const urlMarket = params.get("market") ?? "";

  const [options, setOptions] = useState<CropMarketOption[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  const loadOptions = useCallback(async () => {
    setError(false);
    try {
      const opts = await fetchOptions();
      setOptions(opts);
      setReady(true);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const crops = useMemo(
    () => [...new Set(options.map((o) => o.crop))].sort(),
    [options],
  );

  const crop = urlCrop || options[0]?.crop || "";
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
    setCrop,
    setMarket,
    retry: loadOptions,
  };
}

import { storeConfig, type StoreConfig } from "@ovira/core";
import { useEffect, useState } from "react";

/**
 * Store settings, fetched once per app run.
 *
 * Currency, tax profile and single-vs-multi-vendor mode change about as often as
 * the company does, but several screens need them — a product page discloses the
 * tax, the cart totals depend on it. Without this cache every screen would
 * re-ask on mount, and the answer would arrive after the price had already been
 * drawn without it.
 */
let cached: StoreConfig | null = null;
let inflight: Promise<StoreConfig> | null = null;

export async function getStoreConfig(): Promise<StoreConfig> {
  if (cached) return cached;
  inflight ??= storeConfig().then((cfg) => {
    cached = cfg;
    inflight = null;
    return cfg;
  });
  return inflight;
}

/** Discard the cache — after a pull-to-refresh, or when settings may have moved. */
export function forgetStoreConfig(): void {
  cached = null;
}

export function useStoreConfig(): StoreConfig | null {
  const [config, setConfig] = useState<StoreConfig | null>(cached);

  useEffect(() => {
    if (cached) return;
    let alive = true;
    void getStoreConfig().then((cfg) => {
      if (alive) setConfig(cfg);
    });
    return () => {
      alive = false;
    };
  }, []);

  return config;
}

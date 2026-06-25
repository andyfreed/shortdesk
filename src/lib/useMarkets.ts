"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchMarkets, type Market, type Network } from "./hyperliquid";

/** Polls Hyperliquid for live market data every `intervalMs`. */
export function useMarkets(network: Network, intervalMs = 8000) {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const m = await fetchMarkets(network);
      setMarkets(m);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load markets");
    } finally {
      setLoading(false);
    }
  }, [network]);

  useEffect(() => {
    setLoading(true);
    load();
    const id = setInterval(load, intervalMs);
    return () => clearInterval(id);
  }, [load, intervalMs]);

  return { markets, loading, error, refresh: load };
}

export function useMarket(network: Network, name: string, intervalMs = 5000) {
  const { markets, loading, error } = useMarkets(network, intervalMs);
  const market = markets.find(
    (m) => m.name.toLowerCase() === name.toLowerCase(),
  );
  return { market, loading, error, markets };
}

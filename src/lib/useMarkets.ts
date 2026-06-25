"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchMarkets, type Market, type Network } from "./hyperliquid";

/**
 * Polls Hyperliquid for live market data every `intervalMs`.
 *
 * Results are tagged with the network they came from. The returned `markets`
 * is empty whenever the stored data belongs to a different network than the
 * one currently selected — so a leftover mainnet BTC can never be tradeable
 * while testnet data is still loading (asset IDs are per-network indices, so a
 * stale entry could otherwise route an order to the wrong asset). This is
 * derived at read time, avoiding a synchronous state-clear inside the effect.
 */
export function useMarkets(network: Network, intervalMs = 8000) {
  const [data, setData] = useState<{ net: Network; markets: Market[] }>({
    net: network,
    markets: [],
  });
  const [loadedNet, setLoadedNet] = useState<Network | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const m = await fetchMarkets(network);
    setData({ net: network, markets: m });
    setError(null);
  }, [network]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const m = await fetchMarkets(network);
        if (!active) return;
        setData({ net: network, markets: m });
        setLoadedNet(network);
        setError(null);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load markets");
        setLoadedNet(network);
      }
    };
    run();
    const id = setInterval(run, intervalMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [network, intervalMs]);

  const markets = data.net === network ? data.markets : [];
  const loading = loadedNet !== network && markets.length === 0;

  return { markets, loading, error, refresh };
}

export function useMarket(network: Network, name: string, intervalMs = 5000) {
  const { markets, loading, error } = useMarkets(network, intervalMs);
  const market = markets.find(
    (m) => m.name.toLowerCase() === name.toLowerCase(),
  );
  return { market, loading, error, markets };
}

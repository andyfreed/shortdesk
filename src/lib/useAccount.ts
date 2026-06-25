"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchAccount, type AccountSummary, type Network } from "./hyperliquid";

/**
 * Polls account state (Perps + Spot balances, open positions) for an address.
 *
 * Data is tagged with the (network, address) it belongs to and only surfaced
 * when that matches the current selection, so switching account/network never
 * shows another account's balances. The last good value is kept on a transient
 * fetch error (flagged `stale`) so a funded account never briefly looks empty
 * right before a trade.
 */
export function useAccountState(
  network: Network,
  address: `0x${string}` | null,
  intervalMs = 6000,
) {
  const [data, setData] = useState<{
    net: Network;
    addr: string | null;
    account: AccountSummary;
  } | null>(null);
  const [stale, setStale] = useState(false);

  const refresh = useCallback(async () => {
    if (!address) return;
    try {
      const a = await fetchAccount(network, address);
      setData({ net: network, addr: address, account: a });
      setStale(false);
    } catch {
      setStale(true);
    }
  }, [network, address]);

  useEffect(() => {
    if (!address) return;
    let active = true;
    const load = async () => {
      try {
        const a = await fetchAccount(network, address);
        if (!active) return;
        setData({ net: network, addr: address, account: a });
        setStale(false);
      } catch {
        if (active) setStale(true);
      }
    };
    load();
    const id = setInterval(load, intervalMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [network, address, intervalMs]);

  const account =
    data && data.net === network && data.addr === address
      ? data.account
      : null;

  return { account, stale, refresh };
}

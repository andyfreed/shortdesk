"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Network } from "./hyperliquid";

interface NetworkCtx {
  network: Network;
  setNetwork: (n: Network) => void;
}

const Ctx = createContext<NetworkCtx>({
  network: "mainnet",
  setNetwork: () => {},
});

const KEY = "shortdesk.network";

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [network, setNetworkState] = useState<Network>("mainnet");

  useEffect(() => {
    const saved = localStorage.getItem(KEY);
    if (saved === "mainnet" || saved === "testnet") setNetworkState(saved);
  }, []);

  function setNetwork(n: Network) {
    setNetworkState(n);
    localStorage.setItem(KEY, n);
  }

  return <Ctx.Provider value={{ network, setNetwork }}>{children}</Ctx.Provider>;
}

export function useNetwork() {
  return useContext(Ctx);
}

export function NetworkToggle() {
  const { network, setNetwork } = useNetwork();
  return (
    <div className="inline-flex rounded-lg border border-border p-0.5 text-xs">
      {(["mainnet", "testnet"] as const).map((n) => (
        <button
          key={n}
          onClick={() => setNetwork(n)}
          className={`rounded-md px-2.5 py-1 capitalize transition-colors ${
            network === n
              ? n === "mainnet"
                ? "bg-short text-white"
                : "bg-accent text-white"
              : "text-muted hover:text-foreground"
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

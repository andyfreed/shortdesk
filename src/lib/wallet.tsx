"use client";

/**
 * Wallet connection for live trading.
 *
 * SECURITY MODEL
 * --------------
 * Two ways to connect, both keep secrets in the browser only:
 *
 *  1. "browser"  — an injected wallet (MetaMask / Rabby). Each order pops a
 *                  signature request; the private key never leaves the wallet.
 *  2. "agent"    — a Hyperliquid API/agent private key pasted by the user. It
 *                  is held in React memory ONLY (never written to disk, never
 *                  sent to any server) and is forgotten on reload. Agent keys
 *                  can place orders but CANNOT withdraw funds, so even a leak
 *                  cannot move money out.
 *
 * Nothing here ever transmits a key anywhere except directly to Hyperliquid's
 * API as a signature. That is why the app is safe to host on Vercel.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  createWalletClient,
  custom,
  type WalletClient,
  isAddress,
  getAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum } from "viem/chains";

export type WalletMode = "browser" | "agent";

// The SDK accepts either a viem LocalAccount or a viem WalletClient.
type Signer = WalletClient | ReturnType<typeof privateKeyToAccount>;

interface WalletState {
  mode: WalletMode | null;
  signer: Signer | null;
  /** The master account address whose balance & positions we read/trade. */
  address: `0x${string}` | null;
  connecting: boolean;
  error: string | null;
}

interface WalletCtx extends WalletState {
  connectBrowser: () => Promise<void>;
  connectAgent: (privateKey: string, masterAddress: string) => void;
  disconnect: () => void;
}

const Ctx = createContext<WalletCtx | null>(null);

const ADDR_KEY = "shortdesk.master"; // address only — never the key

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>({
    mode: null,
    signer: null,
    address: null,
    connecting: false,
    error: null,
  });

  // Restore only the (non-sensitive) master address for display convenience.
  useEffect(() => {
    const saved = localStorage.getItem(ADDR_KEY);
    if (saved && isAddress(saved)) {
      setState((s) => ({ ...s, address: getAddress(saved) }));
    }
  }, []);

  const connectBrowser = useCallback(async () => {
    setState((s) => ({ ...s, connecting: true, error: null }));
    try {
      const eth = (globalThis as unknown as { ethereum?: unknown }).ethereum;
      if (!eth)
        throw new Error(
          "No browser wallet found. Install MetaMask or Rabby, or use an agent key.",
        );
      const accounts = (await (
        eth as { request: (a: unknown) => Promise<string[]> }
      ).request({ method: "eth_requestAccounts" })) as `0x${string}`[];
      const address = getAddress(accounts[0]);
      const client = createWalletClient({
        account: address,
        chain: arbitrum,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        transport: custom(eth as any),
      });
      localStorage.setItem(ADDR_KEY, address);
      setState({
        mode: "browser",
        signer: client,
        address,
        connecting: false,
        error: null,
      });
    } catch (e) {
      setState((s) => ({
        ...s,
        connecting: false,
        error: e instanceof Error ? e.message : "Failed to connect wallet",
      }));
    }
  }, []);

  const connectAgent = useCallback(
    (privateKey: string, masterAddress: string) => {
      try {
        const key = privateKey.trim();
        const normalized = (key.startsWith("0x") ? key : `0x${key}`) as `0x${string}`;
        if (!/^0x[0-9a-fA-F]{64}$/.test(normalized))
          throw new Error("That doesn't look like a 32-byte private key.");
        if (!isAddress(masterAddress.trim()))
          throw new Error("Enter the main account address you deposited to.");
        const account = privateKeyToAccount(normalized);
        localStorage.setItem(ADDR_KEY, getAddress(masterAddress.trim()));
        setState({
          mode: "agent",
          signer: account,
          address: getAddress(masterAddress.trim()),
          connecting: false,
          error: null,
        });
      } catch (e) {
        setState((s) => ({
          ...s,
          error: e instanceof Error ? e.message : "Invalid agent key",
        }));
      }
    },
    [],
  );

  const disconnect = useCallback(() => {
    localStorage.removeItem(ADDR_KEY);
    setState({
      mode: null,
      signer: null,
      address: null,
      connecting: false,
      error: null,
    });
  }, []);

  return (
    <Ctx.Provider
      value={{ ...state, connectBrowser, connectAgent, disconnect }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}

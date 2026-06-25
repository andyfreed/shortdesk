import { BotView } from "@/components/BotView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Short bot (paper) — ShortDesk",
  description:
    "A paper-trading bot that scans live Hyperliquid markets for overbought shorts and simulates a take-tiny-profit strategy, net of fees. No real orders.",
};

export default function BotPage() {
  return <BotView />;
}

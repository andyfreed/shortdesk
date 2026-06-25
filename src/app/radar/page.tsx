import { RadarView } from "@/components/RadarView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Short Radar — crowd positioning by funding | ShortDesk",
  description:
    "Live ranking of Hyperliquid perps by funding rate: where the crowd is shorting and where a short earns funding, with open interest, 24h change and volume.",
};

export default function RadarPage() {
  return <RadarView />;
}

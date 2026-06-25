import { MarketsDashboard } from "@/components/MarketsDashboard";
import { ShortRadar } from "@/components/ShortRadar";
import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <section className="mb-8">
        <h1 className="text-2xl font-semibold sm:text-3xl">
          Learn to short crypto with leverage
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          ShortDesk is a hands-on terminal for understanding how shorting works
          on{" "}
          <a
            href="https://hyperliquid.xyz"
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            Hyperliquid
          </a>
          . Live market data below is real. Every setting on the trade screen is
          explained in plain English, and a calculator shows your liquidation
          price before you risk anything.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/trade"
            className="rounded-lg bg-short px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Open the short terminal →
          </Link>
          <Link
            href="/learn"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface-2"
          >
            Read the beginner guide
          </Link>
        </div>
      </section>

      <ShortRadar />

      <MarketsDashboard />
    </div>
  );
}

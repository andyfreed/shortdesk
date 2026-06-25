import Link from "next/link";
import { EXPLAINERS, SHORTING_STEPS, RISKS } from "@/lib/content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Learn — How to short crypto with leverage | ShortDesk",
  description:
    "A plain-English guide to shorting cryptocurrency with leverage on Hyperliquid: leverage, margin modes, liquidation, funding, order types, fees and risk management.",
};

const TOPICS = [
  "short",
  "leverage",
  "marginMode",
  "liquidation",
  "funding",
  "orderType",
  "size",
  "reduceOnly",
] as const;

export default function LearnPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs font-medium uppercase tracking-wide text-accent">
        Beginner guide
      </p>
      <h1 className="mt-1 text-3xl font-semibold">
        How to short crypto with leverage
      </h1>
      <p className="mt-3 text-muted">
        Shorting lets you profit when a price falls. Leverage amplifies both the
        profit and the risk. This guide explains every concept you’ll meet on
        the{" "}
        <Link href="/trade" className="text-accent hover:underline">
          short terminal
        </Link>
        , in order. Read it once before you place a real trade.
      </p>

      <div className="mt-8 rounded-xl border border-warn/40 bg-warn/10 p-4">
        <h2 className="text-sm font-semibold text-warn">Read this first</h2>
        <ul className="mt-2 space-y-1.5 text-sm text-foreground/90">
          {RISKS.map((r) => (
            <li key={r} className="flex gap-2">
              <span className="text-warn">•</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Step-by-step */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold">The short, step by step</h2>
        <ol className="mt-4 space-y-3">
          {SHORTING_STEPS.map((s) => (
            <li
              key={s.n}
              className="flex gap-3 rounded-lg border border-border bg-surface p-4"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-short/20 text-sm font-semibold text-short">
                {s.n}
              </span>
              <div>
                <h3 className="font-medium">{s.title}</h3>
                <p className="mt-0.5 text-sm text-muted">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Concept deep-dives */}
      <section className="mt-10 space-y-8">
        <h2 className="text-xl font-semibold">Every setting, explained</h2>
        {TOPICS.map((k) => {
          const ex = EXPLAINERS[k];
          return (
            <article key={k} id={k} className="scroll-mt-20">
              <h3 className="text-lg font-semibold">{ex.title}</h3>
              <p className="mt-1 text-sm font-medium text-accent">{ex.short}</p>
              <div className="mt-2 space-y-2 text-sm leading-relaxed text-foreground/90">
                {ex.body.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </article>
          );
        })}
      </section>

      {/* Worked example */}
      <section className="mt-10 rounded-xl border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">A worked example</h2>
        <p className="mt-2 text-sm leading-relaxed text-foreground/90">
          You short <strong>0.1 BTC at $60,000</strong> using{" "}
          <strong>10x leverage</strong> in <strong>isolated</strong> margin.
        </p>
        <ul className="mt-3 space-y-1.5 text-sm text-foreground/90">
          <li>
            • Notional = 0.1 × $60,000 ={" "}
            <span className="tabular">$6,000</span>
          </li>
          <li>
            • Margin posted = $6,000 ÷ 10 ={" "}
            <span className="tabular">$600</span>
          </li>
          <li>
            • Liquidation ≈ <span className="tabular">$65,700</span> (about{" "}
            <span className="text-short">+9.5%</span> — roughly 1/leverage above
            entry, a touch lower because of maintenance margin)
          </li>
          <li>
            • If BTC falls 5% to $57,000 → profit ≈{" "}
            <span className="text-long tabular">+$300 (+50% on margin)</span>
          </li>
          <li>
            • If BTC rises 5% to $63,000 → loss ≈{" "}
            <span className="text-short tabular">−$300 (−50% on margin)</span>
          </li>
        </ul>
        <p className="mt-3 text-sm text-muted">
          Notice the leverage works both ways: a 5% move becomes a 50% swing on
          your margin. The{" "}
          <Link href="/trade" className="text-accent hover:underline">
            calculator on the trade screen
          </Link>{" "}
          does this math live for any market.
        </p>
      </section>

      <div className="mt-10 flex justify-center">
        <Link
          href="/trade"
          className="rounded-lg bg-short px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          Try it on the short terminal →
        </Link>
      </div>
    </div>
  );
}

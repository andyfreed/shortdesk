import { Suspense } from "react";
import { TradeTerminal } from "@/components/TradeTerminal";

export default function TradePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 py-16 text-center text-muted">
          Loading terminal…
        </div>
      }
    >
      <TradeTerminal />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { NetworkProvider } from "@/lib/network";
import { WalletProvider } from "@/lib/wallet";
import { SectionProvider } from "@/lib/section";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ShortDesk — Learn to short crypto on Hyperliquid",
  description:
    "An educational trading terminal for learning how to short cryptocurrencies with leverage on Hyperliquid. Live market data, a liquidation calculator, and plain-English explanations of every setting.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SectionProvider>
          <NetworkProvider>
            <WalletProvider>
              <Nav />
              <main className="flex-1">{children}</main>
              <footer className="border-t border-border px-4 py-6 text-center text-xs text-muted">
                ShortDesk is an educational tool. It is not financial advice.
                Leveraged shorting can lose more than your initial margin. You
                are solely responsible for any trades you place.
              </footer>
            </WalletProvider>
          </NetworkProvider>
        </SectionProvider>
      </body>
    </html>
  );
}

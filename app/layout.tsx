import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AGAPE Cooperative Ledger",
  description: "FRSC cooperative deductions, savings, and member ledger",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

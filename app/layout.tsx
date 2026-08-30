import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LotSize Pro",
  description: "Professional position size calculator for Forex and XAUUSD traders",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

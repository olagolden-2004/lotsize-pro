import { NextResponse } from "next/server";

const allowedSymbols = new Set([
  // Forex trading pairs
  "GBP/USD",
  "EUR/USD",
  "USD/JPY",
  "AUD/USD",
  "USD/CAD",
  "USD/CHF",
  "NZD/USD",
  "EUR/GBP",
  "EUR/JPY",
  "GBP/JPY",

  // Gold
  "XAU/USD",

  // Currency conversion pairs
  "USD/EUR",
  "USD/GBP",
  "USD/JPY",
  "USD/AUD",
  "USD/CAD",
  "USD/CHF",
  "USD/NZD",

  "EUR/USD",
  "GBP/USD",
  "JPY/USD",
  "AUD/USD",
  "CAD/USD",
  "CHF/USD",
  "NZD/USD",

  "EUR/GBP",
  "GBP/EUR",
  "EUR/JPY",
  "JPY/EUR",
  "GBP/JPY",
  "JPY/GBP",

  "EUR/AUD",
  "AUD/EUR",
  "EUR/CAD",
  "CAD/EUR",
  "EUR/CHF",
  "CHF/EUR",
  "EUR/NZD",
  "NZD/EUR",

  "GBP/AUD",
  "AUD/GBP",
  "GBP/CAD",
  "CAD/GBP",
  "GBP/CHF",
  "CHF/GBP",
  "GBP/NZD",
  "NZD/GBP",

  "AUD/CAD",
  "CAD/AUD",
  "AUD/CHF",
  "CHF/AUD",
  "AUD/NZD",
  "NZD/AUD",

  "CAD/CHF",
  "CHF/CAD",
  "CAD/NZD",
  "NZD/CAD",

  "CHF/JPY",
  "JPY/CHF",

  "NZD/CHF",
  "CHF/NZD",

  "NZD/JPY",
  "JPY/NZD",
]);

export async function GET(req: Request) {
  const key = process.env.TWELVE_DATA_API_KEY;

  if (!key) {
    return NextResponse.json(
      { error: "Market-data API key is not configured." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") || "";

  if (!allowedSymbols.has(symbol)) {
    return NextResponse.json(
      { error: "Unsupported symbol." },
      { status: 400 }
    );
  }

  const url = new URL("https://api.twelvedata.com/price");

  url.searchParams.set("symbol", symbol);
  url.searchParams.set("apikey", key);

  try {
    const response = await fetch(url.toString(), {
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok || data.status === "error" || !data.price) {
      return NextResponse.json(
        { error: data.message || "Market price unavailable." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      symbol,
      price: Number(data.price),
      updatedAt: new Date().toISOString(),
      source: "Twelve Data",
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to reach market-data provider." },
      { status: 502 }
    );
  }
}

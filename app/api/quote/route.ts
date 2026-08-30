import { NextResponse } from "next/server";

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

  const allowed = new Set([
    "GBP/USD",
    "EUR/USD",
    "USD/JPY",
    "USD/CHF",
    "AUD/USD",
    "NZD/USD",
    "USD/CAD",
    "EUR/GBP",
    "EUR/JPY",
    "GBP/JPY",
    "XAU/USD",
  ]);

  if (!allowed.has(symbol)) {
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

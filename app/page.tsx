"use client";

import { useEffect, useState } from "react";

type Mode = "forex" | "gold";
type Direction = "BUY" | "SELL";

const forexPairs = [
  "GBP/USD",
  "EUR/USD",
  "USD/JPY",
  "AUD/USD",
  "USD/CAD",
  "USD/CHF",
  "NZD/USD",
  "EUR/GBP",
  "GBP/JPY",
];

const currencies = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD"];

export default function Home() {
  const [mode, setMode] = useState<Mode>("forex");
  const [pair, setPair] = useState("GBP/USD");
  const [accountCurrency, setAccountCurrency] = useState("USD");
  const [balance, setBalance] = useState("1000");
  const [risk, setRisk] = useState("1");
  const [direction, setDirection] = useState<Direction>("BUY");
  const [entry, setEntry] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [rewardRisk, setRewardRisk] = useState("");
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [updated, setUpdated] = useState("");
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [priceError, setPriceError] = useState("");
  const [lotSize, setLotSize] = useState<number | null>(null);
  const [riskMoney, setRiskMoney] = useState<number | null>(null);
  const [potentialProfit, setPotentialProfit] = useState<number | null>(null);
  const [error, setError] = useState("");

  const symbol = mode === "gold" ? "XAU/USD" : pair;

  async function getLivePrice() {
    setLoadingPrice(true);
    setPriceError("");

    try {
      const response = await fetch(
        `/api/quote?symbol=${encodeURIComponent(symbol)}`
      );

      const data = await response.json();

      if (!response.ok || !data.price) {
        throw new Error(data.error || "Unable to get live price.");
      }

      setLivePrice(Number(data.price));
      setUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      setPriceError(
        err instanceof Error ? err.message : "Unable to get live price."
      );
    } finally {
      setLoadingPrice(false);
    }
  }

  useEffect(() => {
    setLivePrice(null);
    setUpdated("");
    setPriceError("");
    setLotSize(null);
    setRiskMoney(null);
    setPotentialProfit(null);
    setError("");

    getLivePrice();
  }, [symbol]);

  function calculate() {
    setError("");
    setLotSize(null);
    setRiskMoney(null);
    setPotentialProfit(null);

    const balanceNumber = Number(balance);
    const riskNumber = Number(risk);
    const entryNumber = Number(entry);
    const stopNumber = Number(stopLoss);
    const tpNumber = Number(takeProfit);

    if (
      !Number.isFinite(balanceNumber) ||
      balanceNumber <= 0 ||
      !Number.isFinite(riskNumber) ||
      riskNumber <= 0 ||
      riskNumber > 100
    ) {
      setError("Enter a valid account balance and risk percentage.");
      return;
    }

    if (!Number.isFinite(entryNumber) || entryNumber <= 0) {
      setError("Enter a valid entry price.");
      return;
    }

    if (!Number.isFinite(stopNumber) || stopNumber <= 0) {
      setError("Enter a valid stop-loss price.");
      return;
    }

    if (direction === "BUY" && stopNumber >= entryNumber) {
      setError("For a BUY trade, Stop Loss must be below Entry.");
      return;
    }

    if (direction === "SELL" && stopNumber <= entryNumber) {
      setError("For a SELL trade, Stop Loss must be above Entry.");
      return;
    }

    const moneyAtRisk = balanceNumber * (riskNumber / 100);
    const distance = Math.abs(entryNumber - stopNumber);

    let lots = 0;

    if (mode === "gold") {
      // XAUUSD: 1 standard lot = 100 troy ounces.
      const riskPerLot = distance * 100;
      lots = moneyAtRisk / riskPerLot;
    } else {
      const [base, quote] = pair.split("/");

      // Pip size.
      const pipSize = quote === "JPY" ? 0.01 : 0.0001;

      const pips = distance / pipSize;

      // Standard Forex contract: 100,000 base units.
      // Pip value in quote currency for one standard lot.
      const pipValueQuote = 100000 * pipSize;

      let conversion = 1;

      if (accountCurrency !== quote) {
        // The API route can supply a conversion rate.
        // For now, the calculator requests it from the server.
        // USD accounts on common USD-quoted pairs need no conversion.
        if (quote === "USD" && accountCurrency === "USD") {
          conversion = 1;
        } else {
          setError(
            "This account currency requires a currency conversion rate. Use USD for this calculation for now."
          );
          return;
        }
      }

      const riskPerLot = pips * pipValueQuote * conversion;
      lots = moneyAtRisk / riskPerLot;
    }

    if (!Number.isFinite(lots) || lots <= 0) {
      setError("Unable to calculate lot size from these values.");
      return;
    }

    // Standard broker lot-step rounding.
    const roundedLots = Math.floor(lots / 0.01) * 0.01;

    if (roundedLots < 0.01) {
      setError(
        "The calculated lot size is below 0.01 lots. The position may be too large for the selected risk."
      );
      return;
    }

    setRiskMoney(moneyAtRisk);
    setLotSize(roundedLots);

    if (Number.isFinite(tpNumber) && tpNumber > 0) {
      const tpDistance = Math.abs(tpNumber - entryNumber);

      let profit = 0;

      if (mode === "gold") {
        profit = tpDistance * 100 * roundedLots;
      } else {
        const quote = pair.split("/")[1];
        const pipSize = quote === "JPY" ? 0.01 : 0.0001;
        const tpPips = tpDistance / pipSize;
        const pipValue = 100000 * pipSize;
        profit = tpPips * pipValue * roundedLots;
      }

      setPotentialProfit(profit);
    }
  }

  function reset() {
    setBalance("1000");
    setRisk("1");
    setDirection("BUY");
    setEntry("");
    setStopLoss("");
    setTakeProfit("");
    setRewardRisk("");
    setLotSize(null);
    setRiskMoney(null);
    setPotentialProfit(null);
    setError("");
  }

  return (
    <main className="page">
      <section className="card">
        <header className="header">
          <div>
            <div className="brand">LotSize Pro</div>
            <div className="subtitle">
              Professional position-size calculator
            </div>
          </div>
          <div className="liveBadge">LIVE</div>
        </header>

        <div className="tabs">
          <button
            className={mode === "forex" ? "tab active" : "tab"}
            onClick={() => setMode("forex")}
          >
            Forex
          </button>
          <button
            className={mode === "gold" ? "tab active" : "tab"}
            onClick={() => setMode("gold")}
          >
            Gold · XAUUSD
          </button>
        </div>

        <div className="liveBox">
          <div>
            <span className="label">CURRENT MARKET PRICE</span>
            <strong>
              {loadingPrice
                ? "Loading..."
                : livePrice !== null
                  ? livePrice.toFixed(mode === "gold" ? 2 : 5)
                  : "—"}
            </strong>
          </div>

          <button className="refresh" onClick={getLivePrice}>
            Refresh
          </button>

          {updated && <small>Updated {updated}</small>}
        </div>

        {priceError && <div className="warning">{priceError}</div>}

        <div className="grid">
          {mode === "forex" ? (
            <Field label="Currency Pair">
              <select value={pair} onChange={(e) => setPair(e.target.value)}>
                {forexPairs.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </Field>
          ) : (
            <div className="goldInfo">
              <span>XAU/USD · Spot Gold</span>
              <small>1.00 standard lot = 100 troy ounces</small>
            </div>
          )}

          <Field label="Account Balance">
            <input
              inputMode="decimal"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder="1000"
            />
          </Field>

          <Field label="Account Currency">
            <select
              value={accountCurrency}
              onChange={(e) => setAccountCurrency(e.target.value)}
            >
              {currencies.map((currency) => (
                <option key={currency}>{currency}</option>
              ))}
            </select>
          </Field>

          <Field label="Risk Percentage">
            <input
              inputMode="decimal"
              value={risk}
              onChange={(e) => setRisk(e.target.value)}
              placeholder="1"
            />
            <span className="suffix">%</span>
          </Field>
        </div>

        <div className="direction">
          <button
            className={direction === "BUY" ? "buy selected" : "buy"}
            onClick={() => setDirection("BUY")}
          >
            ↗ BUY
          </button>
          <button
            className={direction === "SELL" ? "sell selected" : "sell"}
            onClick={() => setDirection("SELL")}
          >
            ↘ SELL
          </button>
        </div>

        <div className="grid">
          <Field label="Entry Price">
            <input
              inputMode="decimal"
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              placeholder={mode === "gold" ? "3400.00" : "1.35000"}
            />
          </Field>

          <Field label="Stop Loss Price">
            <input
              inputMode="decimal"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              placeholder={mode === "gold" ? "3390.00" : "1.34500"}
            />
          </Field>

          <Field label="Take Profit" optional>
            <input
              inputMode="decimal"
              value={takeProfit}
              onChange={(e) => setTakeProfit(e.target.value)}
              placeholder="Optional"
            />
          </Field>

          <Field label="Reward : Risk" optional>
            <input
              inputMode="decimal"
              value={rewardRisk}
              onChange={(e) => setRewardRisk(e.target.value)}
              placeholder="Optional"
            />
          </Field>
        </div>

        <div className="buttons">
          <button className="calculate" onClick={calculate}>
            CALCULATE LOT SIZE
          </button>
          <button className="reset" onClick={reset}>
            RESET
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        {lotSize !== null && (
          <section className="result">
            <span className="resultLabel">RECOMMENDED LOT SIZE</span>
            <div className="lot">{lotSize.toFixed(2)}</div>
            <div className="metrics">
              <div>
                <span>Amount at risk</span>
                <strong>
                  {riskMoney?.toFixed(2)} {accountCurrency}
                </strong>
              </div>

              {potentialProfit !== null && (
                <div>
                  <span>Potential profit</span>
                  <strong>
                    {potentialProfit.toFixed(2)} {accountCurrency}
                  </strong>
                </div>
              )}
            </div>
          </section>
        )}

        <p className="disclaimer">
          LotSize Pro calculates position size from the information entered by
          the trader. Always verify contract specifications, pip value, spread,
          and broker lot limits before placing a trade.
        </p>
      </section>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #071016;
        }

        .page {
          min-height: 100vh;
          padding: 20px 12px 40px;
          background: #071016;
          color: #e8f0f4;
          font-family: Arial, sans-serif;
        }

        .card {
          max-width: 720px;
          margin: auto;
          padding: 18px;
          border: 1px solid #26343d;
          border-radius: 20px;
          background: #101a20;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 18px;
        }

        .brand {
          font-size: 25px;
          font-weight: 800;
        }

        .subtitle {
          margin-top: 5px;
          color: #8d9ca5;
          font-size: 13px;
        }

        .liveBadge {
          padding: 7px 10px;
          border-radius: 999px;
          background: #123b40;
          color: #26d3d0;
          font-size: 11px;
          font-weight: 800;
        }

        .tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 14px;
        }

        .tab {
          border: 1px solid #304049;
          border-radius: 12px;
          padding: 13px;
          background: #162229;
          color: #aebbc2;
          font-weight: 700;
        }

        .tab.active {
          background: #123b40;
          color: #28d5d1;
          border-color: #1e7778;
        }

        .liveBox {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 5px 12px;
          margin-bottom: 18px;
          padding: 15px;
          border: 1px solid #27434a;
          border-radius: 14px;
          background: #0c151a;
        }

        .label,
        .resultLabel {
          display: block;
          color: #7e929c;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
        }

        .liveBox strong {
          display: block;
          margin-top: 5px;
          font-size: 23px;
        }

        .liveBox small {
          color: #78909b;
          font-size: 11px;
        }

        .refresh {
          align-self: center;
          padding: 9px 12px;
          border: 0;
          border-radius: 9px;
          background: #19323a;
          color: #27d1ce;
          font-weight: 700;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 13px;
        }

        .field {
          position: relative;
          margin-bottom: 4px;
        }

        .field label {
          display: block;
          margin-bottom: 7px;
          color: #d6e0e5;
          font-size: 13px;
          font-weight: 700;
        }

        input,
        select {
          width: 100%;
          min-height: 52px;
          padding: 12px;
          border: 1px solid #34454e;
          border-radius: 12px;
          outline: none;
          background: #141f25;
          color: #f0f5f7;
          font-size: 16px;
        }

        input:focus,
        select:focus {
          border-color: #27c9c7;
        }

        .suffix {
          position: absolute;
          right: 14px;
          bottom: 16px;
          color: #9baab1;
        }

        .direction {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin: 16px 0;
          padding: 5px;
          border-radius: 14px;
          background: #0b1419;
        }

        .direction button {
          min-height: 50px;
          border: 0;
          border-radius: 10px;
          background: transparent;
          color: #8d9ca5;
          font-size: 16px;
          font-weight: 800;
        }

        .direction .buy.selected {
          background: #2fc578;
          color: #06130c;
        }

        .direction .sell.selected {
          background: #d95858;
          color: white;
        }

        .buttons {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px;
          margin-top: 18px;
        }

        .calculate {
          min-height: 54px;
          border: 0;
          border-radius: 12px;
          background: #22c9c8;
          color: #041113;
          font-weight: 900;
          font-size: 15px;
        }

        .reset {
          padding: 0 18px;
          border: 1px solid #35464f;
          border-radius: 12px;
          background: #17232a;
          color: #d3dde1;
          font-weight: 700;
        }

        .result {
          margin-top: 18px;
          padding: 20px;
          border: 1px solid #2a555b;
          border-radius: 16px;
          background: #0b181d;
          text-align: center;
        }

        .lot {
          margin: 5px 0 14px;
          font-size: 48px;
          font-weight: 900;
        }

        .metrics {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .metrics div {
          padding: 11px;
          border-radius: 10px;
          background: #14242a;
        }

        .metrics span {
          display: block;
          color: #84959e;
          font-size: 11px;
        }

        .metrics strong {
          display: block;
          margin-top: 4px;
        }

        .warning,
        .error {
          margin-bottom: 14px;
          padding: 11px;
          border-radius: 10px;
          font-size: 13px;
        }

        .warning {
          background: #332b14;
          color: #e8c76b;
        }

        .error {
          margin-top: 14px;
          background: #351b20;
          color: #ff9b9b;
        }

        .goldInfo {
          grid-column: 1 / -1;
          padding: 14px;
          border-radius: 12px;
          background: #17252b;
          font-weight: 800;
        }

        .goldInfo small {
          display: block;
          margin-top: 5px;
          color: #84959e;
          font-weight: 400;
        }

        .disclaimer {
          margin: 18px 3px 0;
          color: #74858e;
          font-size: 11px;
          line-height: 1.5;
          text-align: center;
        }

        @media (max-width: 560px) {
          .grid {
            grid-template-columns: 1fr;
          }

          .goldInfo {
            grid-column: auto;
          }

          .buttons {
            grid-template-columns: 1fr;
          }

          .reset {
            min-height: 48px;
          }
        }
      `}</style>
    </main>
  );
}

function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label>
        {label} {optional && <span style={{ color: "#74858e" }}>optional</span>}
      </label>
      {children}
    </div>
  );
}

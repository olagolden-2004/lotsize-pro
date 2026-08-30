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
  "EUR/JPY",
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

  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [updated, setUpdated] = useState("");
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [priceError, setPriceError] = useState("");

  const [lotSize, setLotSize] = useState<number | null>(null);
  const [targetRisk, setTargetRisk] = useState<number | null>(null);
  const [actualRisk, setActualRisk] = useState<number | null>(null);
  const [slDistance, setSlDistance] = useState<number | null>(null);
  const [tpDistance, setTpDistance] = useState<number | null>(null);
  const [riskReward, setRiskReward] = useState<number | null>(null);
  const [potentialProfit, setPotentialProfit] = useState<number | null>(null);

  const [error, setError] = useState("");
  const [calculating, setCalculating] = useState(false);

  const symbol = mode === "gold" ? "XAU/USD" : pair;

  async function getLivePrice() {
    setLoadingPrice(true);
    setPriceError("");

    try {
      const response = await fetch(
        `/api/quote?symbol=${encodeURIComponent(symbol)}`,
        { cache: "no-store" }
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
    setTargetRisk(null);
    setActualRisk(null);
    setSlDistance(null);
    setTpDistance(null);
    setRiskReward(null);
    setPotentialProfit(null);
    setError("");

    getLivePrice();
  }, [symbol]);

  function clearResults() {
    setLotSize(null);
    setTargetRisk(null);
    setActualRisk(null);
    setSlDistance(null);
    setTpDistance(null);
    setRiskReward(null);
    setPotentialProfit(null);
  }

  async function getConversionRate(
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> {
    if (fromCurrency === toCurrency) return 1;

    const directSymbol = `${fromCurrency}/${toCurrency}`;

    const directResponse = await fetch(
      `/api/quote?symbol=${encodeURIComponent(directSymbol)}`,
      { cache: "no-store" }
    );

    if (directResponse.ok) {
      const directData = await directResponse.json();

      if (directData.price && Number(directData.price) > 0) {
        return Number(directData.price);
      }
    }

    const inverseSymbol = `${toCurrency}/${fromCurrency}`;

    const inverseResponse = await fetch(
      `/api/quote?symbol=${encodeURIComponent(inverseSymbol)}`,
      { cache: "no-store" }
    );

    if (inverseResponse.ok) {
      const inverseData = await inverseResponse.json();

      if (inverseData.price && Number(inverseData.price) > 0) {
        return 1 / Number(inverseData.price);
      }
    }

    throw new Error(
      `Unable to obtain ${fromCurrency}/${toCurrency} conversion rate.`
    );
  }

  async function calculate() {
    setError("");
    clearResults();
    setCalculating(true);

    try {
      const balanceNumber = Number(balance);
      const riskNumber = Number(risk);
      const entryNumber = Number(entry);
      const stopNumber = Number(stopLoss);
      const tpNumber = Number(takeProfit);

      if (!Number.isFinite(balanceNumber) || balanceNumber <= 0) {
        throw new Error("Enter a valid account balance.");
      }

      if (
        !Number.isFinite(riskNumber) ||
        riskNumber <= 0 ||
        riskNumber > 100
      ) {
        throw new Error("Risk percentage must be between 0.01% and 100%.");
      }

      if (!Number.isFinite(entryNumber) || entryNumber <= 0) {
        throw new Error("Enter a valid entry price.");
      }

      if (!Number.isFinite(stopNumber) || stopNumber <= 0) {
        throw new Error("Enter a valid stop-loss price.");
      }

      if (direction === "BUY" && stopNumber >= entryNumber) {
        throw new Error("For a BUY trade, Stop Loss must be below Entry.");
      }

      if (direction === "SELL" && stopNumber <= entryNumber) {
        throw new Error("For a SELL trade, Stop Loss must be above Entry.");
      }

      const moneyAtRisk = balanceNumber * (riskNumber / 100);
      const priceDistance = Math.abs(entryNumber - stopNumber);

      if (priceDistance <= 0) {
        throw new Error("Entry and Stop Loss cannot be the same price.");
      }

      let rawLots = 0;
      let riskPerStandardLotInAccountCurrency = 0;

      if (mode === "gold") {
        /*
          XAUUSD standard contract assumption:
          1 standard lot = 100 troy ounces.

          Profit/loss in USD:
          price movement × 100 × lots
        */

        let usdToAccount = 1;

        if (accountCurrency !== "USD") {
          usdToAccount = await getConversionRate(
            "USD",
            accountCurrency
          );
        }

        riskPerStandardLotInAccountCurrency =
          priceDistance * 100 * usdToAccount;

        rawLots = moneyAtRisk / riskPerStandardLotInAccountCurrency;
      } else {
        const [baseCurrency, quoteCurrency] = pair.split("/");

        const pipSize = quoteCurrency === "JPY" ? 0.01 : 0.0001;

        const pips = priceDistance / pipSize;

        /*
          Standard Forex contract:
          1 standard lot = 100,000 base units.

          Pip value in quote currency:
          100,000 × pip size
        */

        const pipValueInQuoteCurrency = 100000 * pipSize;

        let quoteToAccount = 1;

        if (quoteCurrency !== accountCurrency) {
          quoteToAccount = await getConversionRate(
            quoteCurrency,
            accountCurrency
          );
        }

        riskPerStandardLotInAccountCurrency =
          pips *
          pipValueInQuoteCurrency *
          quoteToAccount;

        rawLots = moneyAtRisk / riskPerStandardLotInAccountCurrency;
      }

      if (!Number.isFinite(rawLots) || rawLots <= 0) {
        throw new Error("Unable to calculate a valid lot size.");
      }

      /*
        Round DOWN to the nearest 0.01 lot.

        This prevents the calculator from recommending a position
        that exceeds the trader's selected maximum risk.
      */
      const roundedLots =
        Math.floor((rawLots + Number.EPSILON) * 100) / 100;

      if (roundedLots < 0.01) {
        throw new Error(
          "The calculated lot size is below 0.01 lots. Your stop loss may be too large for the selected risk."
        );
      }

      const actualRisk =
        roundedLots * riskPerStandardLotInAccountCurrency;

      const slPipsOrPoints =
        mode === "gold"
          ? priceDistance
          : priceDistance /
            (pair.split("/")[1] === "JPY" ? 0.01 : 0.0001);

      let calculatedTpDistance: number | null = null;
      let calculatedRR: number | null = null;
      let profit: number | null = null;

      if (Number.isFinite(tpNumber) && tpNumber > 0) {
        if (direction === "BUY" && tpNumber <= entryNumber) {
          throw new Error("For a BUY trade, Take Profit must be above Entry.");
        }

        if (direction === "SELL" && tpNumber >= entryNumber) {
          throw new Error("For a SELL trade, Take Profit must be below Entry.");
        }

        calculatedTpDistance = Math.abs(tpNumber - entryNumber);

        calculatedRR = calculatedTpDistance / priceDistance;

        if (mode === "gold") {
          let usdToAccount = 1;

          if (accountCurrency !== "USD") {
            usdToAccount = await getConversionRate(
              "USD",
              accountCurrency
            );
          }

          profit =
            calculatedTpDistance *
            100 *
            roundedLots *
            usdToAccount;
        } else {
          const [, quoteCurrency] = pair.split("/");

          const pipSize = quoteCurrency === "JPY" ? 0.01 : 0.0001;

          const tpPips = calculatedTpDistance / pipSize;

          const pipValueInQuoteCurrency = 100000 * pipSize;

          let quoteToAccount = 1;

          if (quoteCurrency !== accountCurrency) {
            quoteToAccount = await getConversionRate(
              quoteCurrency,
              accountCurrency
            );
          }

          profit =
            tpPips *
            pipValueInQuoteCurrency *
            roundedLots *
            quoteToAccount;
        }
      }

      setLotSize(roundedLots);
      setTargetRisk(moneyAtRisk);
      setActualRisk(actualRisk);
      setSlDistance(slPipsOrPoints);
      setTpDistance(calculatedTpDistance);
      setRiskReward(calculatedRR);
      setPotentialProfit(profit);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while calculating."
      );
    } finally {
      setCalculating(false);
    }
  }

  function reset() {
    setBalance("1000");
    setAccountCurrency("USD");
    setRisk("1");
    setDirection("BUY");
    setEntry("");
    setStopLoss("");
    setTakeProfit("");
    clearResults();
    setError("");
  }

  const priceDecimals = mode === "gold" ? 2 : 5;

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

          <div className="liveBadge">● LIVE</div>
        </header>

        <div className="tabs">
          <button
            type="button"
            className={mode === "forex" ? "tab active" : "tab"}
            onClick={() => setMode("forex")}
          >
            Forex
          </button>

          <button
            type="button"
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
                  ? livePrice.toFixed(priceDecimals)
                  : "—"}
            </strong>

            {updated && <small>Updated {updated}</small>}
          </div>

          <button
            type="button"
            className="refresh"
            onClick={getLivePrice}
            disabled={loadingPrice}
          >
            {loadingPrice ? "Loading" : "Refresh"}
          </button>
        </div>

        {priceError && <div className="warning">{priceError}</div>}

        <div className="sectionTitle">TRADE INFORMATION</div>

        <div className="grid">
          {mode === "forex" ? (
            <Field label="Currency Pair">
              <select
                value={pair}
                onChange={(e) => setPair(e.target.value)}
              >
                {forexPairs.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </Field>
          ) : (
            <div className="goldInfo">
              <strong>XAU/USD · Spot Gold</strong>
              <small>
                Standard contract assumption: 1.00 lot = 100 troy ounces
              </small>
            </div>
          )}

          <Field label="Account Balance">
            <input
              type="number"
              inputMode="decimal"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder="1000"
              min="0"
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
            <div className="inputWithSuffix">
              <input
                type="number"
                inputMode="decimal"
                value={risk}
                onChange={(e) => setRisk(e.target.value)}
                placeholder="1"
                min="0.01"
                max="100"
                step="0.01"
              />
              <span>%</span>
            </div>
          </Field>
          <div className="riskPresets">
  <button type="button" onClick={() => setRisk("0.5")}>
    0.5%
  </button>

  <button type="button" onClick={() => setRisk("1")}>
    1%
  </button>

  <button type="button" onClick={() => setRisk("1.5")}>
    1.5%
  </button>

  <button type="button" onClick={() => setRisk("2")}>
    2%
  </button>
</div>
        </div>

        <div className="sectionTitle">TRADE DIRECTION</div>

        <div className="direction">
          <button
            type="button"
            className={direction === "BUY" ? "buy selected" : "buy"}
            onClick={() => setDirection("BUY")}
          >
            ↗ BUY
          </button>

          <button
            type="button"
            className={direction === "SELL" ? "sell selected" : "sell"}
            onClick={() => setDirection("SELL")}
          >
            ↘ SELL
          </button>
        </div>

        <div className="sectionTitle">PRICE LEVELS</div>

        <div className="grid">
          <Field label="Entry Price">
            <input
              type="number"
              inputMode="decimal"
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              placeholder={mode === "gold" ? "3400.00" : "1.35000"}
              min="0"
            />
          </Field>

          <Field label="Stop Loss Price">
            <input
              type="number"
              inputMode="decimal"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              placeholder={mode === "gold" ? "3390.00" : "1.34500"}
              min="0"
            />
          </Field>

          <Field label="Take Profit" optional>
            <input
              type="number"
              inputMode="decimal"
              value={takeProfit}
              onChange={(e) => setTakeProfit(e.target.value)}
              placeholder="Optional"
              min="0"
            />
          </Field>
        </div>

        <div className="buttons">
          <button
            type="button"
            className="calculate"
            onClick={calculate}
            disabled={calculating}
          >
            {calculating ? "CALCULATING..." : "CALCULATE LOT SIZE"}
          </button>

          <button type="button" className="reset" onClick={reset}>
            RESET
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        {lotSize !== null && (
          <section className="result">
            <span className="resultLabel">RECOMMENDED LOT SIZE</span>

            <div className="lot">{lotSize.toFixed(2)}</div>

            <div className="resultGrid">
              <ResultItem
                label="Target Risk"
                value={`${targetRisk?.toFixed(2)} ${accountCurrency}`}
              />

              <ResultItem
                label="Actual Risk"
                value={`${actualRisk?.toFixed(2)} ${accountCurrency}`}
              />

              <ResultItem
                label={
                  mode === "gold"
                    ? "SL Distance"
                    : "SL Distance (pips)"
                }
                value={
                  mode === "gold"
                    ? `${slDistance?.toFixed(2)}`
                    : `${slDistance?.toFixed(1)} pips`
                }
              />

              {tpDistance !== null && (
                <ResultItem
                  label={
                    mode === "gold"
                      ? "TP Distance"
                      : "TP Distance (pips)"
                  }
                  value={
  mode === "gold"
    ? `${tpDistance.toFixed(2)}`
    : `${(tpDistance / (pair.split("/")[1] === "JPY" ? 0.01 : 0.0001)).toFixed(1)} pips`
}
                />
              )}

              {riskReward !== null && (
                <ResultItem
                  label="Risk : Reward"
                  value={`1 : ${riskReward.toFixed(2)}`}
                />
              )}

              {potentialProfit !== null && (
                <ResultItem
                  label="Potential Profit"
                  value={`${potentialProfit.toFixed(2)} ${accountCurrency}`}
                />
              )}
            </div>

            <div className="riskNote">
              The lot size is rounded DOWN to the nearest 0.01 lot so the
              recommended position does not intentionally exceed your selected
              risk.
            </div>
          </section>
        )}

        <div className="infoBox">
          <strong>How LotSize Pro works</strong>
          <p>
            Enter your account balance, risk percentage, entry price and stop
            loss. LotSize Pro calculates a position size based on the selected
            instrument and risk.
          </p>
        </div>

        <p className="disclaimer">
          This calculator is for educational and informational purposes.
          Broker contract specifications, spreads, commissions, leverage,
          minimum lot size and lot-step rules can vary. Always verify the
          result with your broker before placing a trade.
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
          display: block;
          margin-top: 4px;
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

        .refresh:disabled,
        .calculate:disabled {
          opacity: 0.6;
        }

        .sectionTitle {
          margin: 18px 0 10px;
          color: #78909b;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.09em;
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

        .inputWithSuffix {
          position: relative;
        }

        .inputWithSuffix span {
          position: absolute;
          right: 14px;
          top: 16px;
          color: #9baab1;
        }

        .direction {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
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
          margin-top: 20px;
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
          margin: 5px 0 18px;
          font-size: 48px;
          font-weight: 900;
        }

        .resultGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .resultItem {
          padding: 12px;
          border-radius: 10px;
          background: #14242a;
          text-align: left;
        }

        .resultItem span {
          display: block;
          color: #84959e;
          font-size: 10px;
        }

        .resultItem strong {
          display: block;
          margin-top: 5px;
          color: #edf5f7;
          font-size: 14px;
        }

        .riskNote {
          margin-top: 12px;
          color: #82939c;
          font-size: 11px;
          line-height: 1.5;
        }

        .warning,
        .error {
          margin-bottom: 14px;
          padding: 11px;
          border-radius: 10px;
          font-size: 13px;
          line-height: 1.4;
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
        }

        .goldInfo strong {
          display: block;
        }

        .goldInfo small {
          display: block;
          margin-top: 5px;
          color: #84959e;
        }

        .infoBox {
          margin-top: 18px;
          padding: 14px;
          border: 1px solid #263b43;
          border-radius: 12px;
          background: #0d181d;
        }

        .infoBox strong {
          font-size: 13px;
        }

        .infoBox p {
          margin: 7px 0 0;
          color: #82939c;
          font-size: 12px;
          line-height: 1.5;
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

          .resultGrid {
            grid-template-columns: 1fr 1fr;
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
        {label}{" "}
        {optional && (
          <span style={{ color: "#74858e", fontWeight: 400 }}>
            optional
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

function ResultItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="resultItem">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

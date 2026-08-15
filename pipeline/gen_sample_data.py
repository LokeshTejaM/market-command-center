"""Generate a REALISTIC-looking sample data/ bundle for frontend development.

Runs the full pipeline against synthetic prices but with S&P 500-style
ticker symbols and real GICS sector names. The output is committed to the
repo so the frontend has something to render until the first real GH Actions
run happens (or when internet-restricted).

Run: `uv run gen_sample_data.py`

Once the real GH Actions cron runs, it overwrites every file here with
actual market data.
"""

from __future__ import annotations

import logging
import sys

import numpy as np
import pandas as pd

import build_rs_data as pipeline
from compute import aggregate_by_sector, build_rs_frame
from etfs import BENCHMARKS, INTERMARKET, VOLATILITY

log = logging.getLogger(__name__)

# 55 realistic S&P 500 tickers across all 11 GICS sectors -- enough for a
# convincing frontend demo without shipping a full 500-ticker snapshot.
SAMPLE_STOCKS = [
    ("AAPL", "Apple Inc.", "Information Technology", "Consumer Electronics"),
    ("MSFT", "Microsoft Corporation", "Information Technology", "Systems Software"),
    ("NVDA", "NVIDIA Corporation", "Information Technology", "Semiconductors"),
    ("AVGO", "Broadcom Inc.", "Information Technology", "Semiconductors"),
    ("ORCL", "Oracle Corporation", "Information Technology", "Systems Software"),
    ("CRM", "Salesforce Inc.", "Information Technology", "Application Software"),
    ("ADBE", "Adobe Inc.", "Information Technology", "Application Software"),
    ("CSCO", "Cisco Systems", "Information Technology", "Comm Equipment"),
    ("AMZN", "Amazon.com Inc.", "Consumer Discretionary", "Broadline Retail"),
    ("TSLA", "Tesla Inc.", "Consumer Discretionary", "Automobile Manufacturers"),
    ("HD", "Home Depot", "Consumer Discretionary", "Home Improvement Retail"),
    ("MCD", "McDonald's", "Consumer Discretionary", "Restaurants"),
    ("NKE", "Nike Inc.", "Consumer Discretionary", "Footwear"),
    ("SBUX", "Starbucks", "Consumer Discretionary", "Restaurants"),
    ("GOOGL", "Alphabet Class A", "Communication Services", "Interactive Media"),
    ("META", "Meta Platforms", "Communication Services", "Interactive Media"),
    ("NFLX", "Netflix Inc.", "Communication Services", "Movies & Entertainment"),
    ("DIS", "Walt Disney", "Communication Services", "Movies & Entertainment"),
    ("VZ", "Verizon", "Communication Services", "Integrated Telecom"),
    ("JPM", "JPMorgan Chase", "Financials", "Diversified Banks"),
    ("BAC", "Bank of America", "Financials", "Diversified Banks"),
    ("WFC", "Wells Fargo", "Financials", "Diversified Banks"),
    ("GS", "Goldman Sachs", "Financials", "Investment Banking"),
    ("MS", "Morgan Stanley", "Financials", "Investment Banking"),
    ("V", "Visa Inc.", "Financials", "Transaction Processing"),
    ("MA", "Mastercard", "Financials", "Transaction Processing"),
    ("WMT", "Walmart Inc.", "Consumer Staples", "Consumer Staples Merchandise"),
    ("PG", "Procter & Gamble", "Consumer Staples", "Household Products"),
    ("KO", "Coca-Cola", "Consumer Staples", "Soft Drinks"),
    ("PEP", "PepsiCo", "Consumer Staples", "Soft Drinks"),
    ("COST", "Costco", "Consumer Staples", "Consumer Staples Merchandise"),
    ("UNH", "UnitedHealth Group", "Health Care", "Managed Health Care"),
    ("JNJ", "Johnson & Johnson", "Health Care", "Pharmaceuticals"),
    ("LLY", "Eli Lilly", "Health Care", "Pharmaceuticals"),
    ("PFE", "Pfizer", "Health Care", "Pharmaceuticals"),
    ("ABBV", "AbbVie", "Health Care", "Biotechnology"),
    ("MRK", "Merck & Co", "Health Care", "Pharmaceuticals"),
    ("BA", "Boeing", "Industrials", "Aerospace & Defense"),
    ("CAT", "Caterpillar", "Industrials", "Construction Machinery"),
    ("HON", "Honeywell", "Industrials", "Industrial Conglomerates"),
    ("UPS", "United Parcel Service", "Industrials", "Air Freight & Logistics"),
    ("GE", "General Electric", "Industrials", "Aerospace & Defense"),
    ("XOM", "Exxon Mobil", "Energy", "Integrated Oil & Gas"),
    ("CVX", "Chevron", "Energy", "Integrated Oil & Gas"),
    ("COP", "ConocoPhillips", "Energy", "Oil & Gas E&P"),
    ("SLB", "Schlumberger", "Energy", "Oil & Gas Equipment"),
    ("NEE", "NextEra Energy", "Utilities", "Electric Utilities"),
    ("DUK", "Duke Energy", "Utilities", "Electric Utilities"),
    ("SO", "Southern Company", "Utilities", "Electric Utilities"),
    ("LIN", "Linde plc", "Materials", "Industrial Gases"),
    ("APD", "Air Products", "Materials", "Industrial Gases"),
    ("FCX", "Freeport-McMoRan", "Materials", "Copper"),
    ("PLD", "Prologis", "Real Estate", "Industrial REITs"),
    ("AMT", "American Tower", "Real Estate", "Telecom Tower REITs"),
    ("SPG", "Simon Property", "Real Estate", "Retail REITs"),
]


def make_realistic_prices(tickers, sectors, n_days=400, seed=42):
    """Generate synthetic prices with sector-correlated drifts.

    Same sector -> similar drift -> realistic sector rotation stories.
    Ensures the frontend visualization looks meaningful, not random.
    """
    rng = np.random.default_rng(seed)
    dates = pd.bdate_range(end=pd.Timestamp.today().normalize(), periods=n_days)
    unique_sectors = list(dict.fromkeys(sectors))
    sector_drifts = {s: rng.normal(0.0005, 0.0015) for s in unique_sectors}

    prices = np.zeros((n_days, len(tickers)))
    prices[0] = 100

    for i, sec in enumerate(sectors):
        base = sector_drifts[sec]
        idio = rng.normal(0, 0.0003)
        vol = rng.uniform(0.010, 0.028)
        for t in range(1, n_days):
            prices[t, i] = prices[t - 1, i] * (1 + rng.normal(base + idio, vol))

    return pd.DataFrame(prices, index=dates, columns=tickers)


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")

    stock_symbols = [t for t, *_ in SAMPLE_STOCKS]
    stock_names = [n for _, n, *_ in SAMPLE_STOCKS]
    stock_sectors = [s for _, _, s, _ in SAMPLE_STOCKS]
    stock_inds = [ind for *_, ind in SAMPLE_STOCKS]

    sp500 = pd.DataFrame({
        "symbol": stock_symbols,
        "name": stock_names,
        "sector": stock_sectors,
        "industry": stock_inds,
    })

    ref_symbols = [t for t, _, _ in pipeline.all_reference_tickers()]
    ref_sectors = ["Reference"] * len(ref_symbols)

    all_symbols = stock_symbols + ref_symbols
    all_sectors = stock_sectors + ref_sectors

    log.info("Generating synthetic prices for %d tickers over 400 days...", len(all_symbols))
    prices = make_realistic_prices(all_symbols, all_sectors)

    stock_prices = prices[stock_symbols]
    stock_frame = build_rs_frame(stock_prices)
    ticker_to_sector = dict(zip(sp500["symbol"], sp500["sector"]))
    sector_agg = {
        w: aggregate_by_sector(stock_frame, ticker_to_sector, window=w)
        for w in pipeline.DEFAULT_WINDOWS
    }

    ref_frame = pipeline._rank_reference_against_stocks(prices, stock_symbols, ref_symbols)

    as_of = pd.Timestamp(prices.index[-1])
    log.info("Writing sample data to %s", pipeline.DATA_DIR)

    meta = pipeline.build_meta(as_of, len(stock_symbols), [], [])
    meta["sources"]["prices"] = "SAMPLE (synthetic data from gen_sample_data.py)"
    pipeline.write_json(pipeline.DATA_DIR / "meta.json", meta)
    pipeline.write_json(pipeline.DATA_DIR / "rs_ranks.json",
                        pipeline.build_rs_ranks_json(stock_frame, sp500))
    pipeline.write_json(pipeline.DATA_DIR / "sectors.json",
                        pipeline.build_sectors_json(sector_agg))
    pipeline.write_json(pipeline.DATA_DIR / "rrg.json",
                        pipeline.build_rrg_json(ref_frame))
    pipeline.write_json(pipeline.DATA_DIR / "benchmarks.json",
                        pipeline.build_snapshot_json(ref_frame, BENCHMARKS + VOLATILITY))
    pipeline.write_json(pipeline.DATA_DIR / "intermarket.json",
                        pipeline.build_snapshot_json(ref_frame, INTERMARKET))

    (pipeline.DATA_DIR / "README.md").write_text(
        "# Data Directory\n\n"
        "Auto-populated by the pipeline (`pipeline/build_rs_data.py`).\n\n"
        "* Production: GitHub Actions cron (`.github/workflows/refresh-data.yml`) rebuilds "
        "every JSON file here each weekday morning.\n"
        "* On first repo clone, the files may contain SAMPLE/synthetic data generated by "
        "`pipeline/gen_sample_data.py` -- overwritten by the first real cron run.\n\n"
        "Check `meta.json` -> `sources.prices` to see which source produced the current data.\n"
    )
    log.info("Sample data generation complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

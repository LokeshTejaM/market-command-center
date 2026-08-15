"""Build all static JSON files consumed by the frontend.

Runs daily via GitHub Actions (see .github/workflows/refresh-data.yml).
Can also be run locally: `uv run build_rs_data.py`.

Outputs (under repo-root/data/):
    meta.json           -- build timestamp, universe stats, pipeline health
    rs_ranks.json       -- per-ticker RS ranks + trends across timeframes
    sectors.json        -- per-sector aggregates + top-5 leaders
    rrg.json            -- (rs_rank, rs_trend) coords for the RRG chart, per sector ETF
    benchmarks.json     -- SPY, RSP, QQQ, IWM, VIX snapshot
    intermarket.json    -- TLT, HYG, DXY, GLD, USO snapshot

Each JSON file is versioned (`schema_version` field) so the frontend can
detect breaking changes without silently rendering garbage.
"""

from __future__ import annotations

import datetime as dt
import json
import logging
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import yfinance as yf

from compute import (
    DEFAULT_TREND_LOOKBACK,
    DEFAULT_WINDOWS,
    aggregate_by_sector,
    build_rs_frame,
    rrg_quadrant,
)
from etfs import (
    BENCHMARKS,
    INTERMARKET,
    SECTOR_ETFS,
    VOLATILITY,
    all_reference_tickers,
)
from sp500 import load_sp500

log = logging.getLogger(__name__)

SCHEMA_VERSION = 1
REPO_ROOT = Path(__file__).parent.parent
DATA_DIR = REPO_ROOT / "data"
HISTORY_DAYS = 400  # ~1.5 years of trading days -- enough for 252d window + trend lookback


def download_prices(tickers: list[str], history_days: int = HISTORY_DAYS) -> pd.DataFrame:
    """Download EOD close prices for all tickers in one batch call.

    yfinance handles batching + retries internally. Returns a wide DataFrame
    with dates as index and tickers as columns.
    """
    end = dt.date.today()
    start = end - dt.timedelta(days=int(history_days * 1.5))  # calendar->trading day slack
    log.info("Downloading %d tickers from %s to %s", len(tickers), start, end)

    df = yf.download(
        tickers=tickers,
        start=start,
        end=end + dt.timedelta(days=1),
        interval="1d",
        auto_adjust=True,
        progress=False,
        group_by="ticker",
        threads=True,
    )

    # yfinance returns MultiIndex columns for multi-ticker; single-ticker returns flat.
    if isinstance(df.columns, pd.MultiIndex):
        closes = df.xs("Close", axis=1, level=1)
    else:
        closes = df[["Close"]].rename(columns={"Close": tickers[0]})

    # Drop tickers that failed entirely, warn about them.
    all_nan = closes.columns[closes.isna().all()].tolist()
    if all_nan:
        log.warning("Dropped %d tickers with no data: %s", len(all_nan), all_nan[:20])
        closes = closes.drop(columns=all_nan)

    return closes.sort_index()


def json_default(o):
    """JSON serializer for numpy/pandas types."""
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        return None if np.isnan(o) else float(o)
    if isinstance(o, (np.bool_,)):
        return bool(o)
    if isinstance(o, pd.Timestamp):
        return o.isoformat()
    if isinstance(o, (dt.date, dt.datetime)):
        return o.isoformat()
    raise TypeError(f"Not JSON serializable: {type(o)}")


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, default=json_default))
    # Show path relative to repo root when possible, absolute otherwise.
    try:
        display = path.relative_to(REPO_ROOT)
    except ValueError:
        display = path
    log.info("Wrote %s (%d bytes)", display, path.stat().st_size)


def build_meta(as_of: pd.Timestamp, universe_size: int, dropped: list[str], ref_dropped: list[str]) -> dict:
    return {
        "schema_version": SCHEMA_VERSION,
        "built_at": dt.datetime.utcnow().isoformat() + "Z",
        "as_of_date": as_of.strftime("%Y-%m-%d"),
        "windows": DEFAULT_WINDOWS,
        "trend_lookback_days": DEFAULT_TREND_LOOKBACK,
        "universe": {
            "sp500_tickers": universe_size,
            "dropped_stocks": dropped,
            "dropped_reference": ref_dropped,
        },
        "sources": {
            "prices": "yfinance (Yahoo Finance)",
            "sp500_constituents": "Wikipedia",
        },
    }


def build_rs_ranks_json(rs_frame: pd.DataFrame, sp500: pd.DataFrame) -> dict:
    """Serialize the per-ticker RS frame into JSON, joined with sector/name info."""
    meta = sp500.set_index("symbol")[["name", "sector", "industry"]]
    joined = rs_frame.join(meta, how="left")
    joined.index.name = "ticker"
    records = joined.reset_index().to_dict(orient="records")
    return {
        "schema_version": SCHEMA_VERSION,
        "count": len(records),
        "records": records,
    }


def build_sectors_json(sector_agg: dict[int, pd.DataFrame]) -> dict:
    """Serialize per-sector aggregates keyed by timeframe window."""
    out = {"schema_version": SCHEMA_VERSION, "by_window": {}}
    for window, df in sector_agg.items():
        df_reset = df.reset_index()
        out["by_window"][str(window)] = df_reset.to_dict(orient="records")
    return out


def build_rrg_json(ref_frame: pd.DataFrame) -> dict:
    """Build RRG chart coordinates for sector ETFs (both CW and EW variants).

    Returns per-window arrays of {ticker, sector, rs_rank, rs_trend, quadrant}.
    """
    out = {"schema_version": SCHEMA_VERSION, "by_window": {}}
    # Reverse map: ETF ticker -> sector name
    etf_to_sector: dict[str, tuple[str, str]] = {}
    for sector, (cw, ew) in SECTOR_ETFS.items():
        etf_to_sector[cw] = (sector, "CW")
        etf_to_sector[ew] = (sector, "EW")

    for window in DEFAULT_WINDOWS:
        rows = []
        for ticker in etf_to_sector:
            if ticker not in ref_frame.index:
                continue
            sector, variant = etf_to_sector[ticker]
            rk = ref_frame.at[ticker, f"rs_rank_{window}d"]
            tr = ref_frame.at[ticker, f"rs_trend_{window}d"]
            rows.append({
                "ticker": ticker,
                "sector": sector,
                "variant": variant,
                "rs_rank": None if pd.isna(rk) else int(rk),
                "rs_trend": None if pd.isna(tr) else float(tr),
                "quadrant": rrg_quadrant(rk, tr),
            })
        out["by_window"][str(window)] = rows
    return out


def build_snapshot_json(frame: pd.DataFrame, tickers: list[tuple[str, str, str]]) -> dict:
    """Build a simple snapshot JSON: ticker/name/category/price/day_change for a list."""
    rows = []
    for tk, name, category in tickers:
        if tk not in frame.index:
            continue
        r = frame.loc[tk]
        rows.append({
            "ticker": tk,
            "name": name,
            "category": category,
            "price": None if pd.isna(r["price"]) else float(r["price"]),
            "day_change_pct": None if pd.isna(r["day_change_pct"]) else float(r["day_change_pct"]),
        })
    return {"schema_version": SCHEMA_VERSION, "records": rows}


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
    )

    log.info("Loading S&P 500 constituents...")
    sp500 = load_sp500()
    sp500_tickers = sp500["symbol"].tolist()

    # SPY is the benchmark for RS calcs -- it must be in the price frame.
    reference = all_reference_tickers()
    reference_tickers = [t for t, _, _ in reference]

    all_tickers = sorted(set(sp500_tickers + reference_tickers))
    log.info("Downloading %d unique tickers", len(all_tickers))

    prices = download_prices(all_tickers)
    log.info("Received prices: %d dates x %d tickers", *prices.shape)

    # ---- CRITICAL: RS is ALWAYS cross-sectional across the S&P 500 stock universe ----
    # (not across a mixed stock+ETF universe -- mixing distorts percentile ranks).
    # ETFs get RS ranks computed against THAT SAME universe so they are comparable.
    stock_prices = prices[[c for c in prices.columns if c in sp500_tickers]]
    log.info("Stock universe for RS ranking: %d tickers", stock_prices.shape[1])

    stock_frame = build_rs_frame(stock_prices)

    # For ETFs (sector + benchmarks + vol + intermarket), we compute their
    # returns and then rank them against the STOCK universe distribution.
    # This is how @jfsrev-style RRG works: sector ETF's rank is its position
    # in the stock-universe leadership distribution.
    ref_frame = _rank_reference_against_stocks(prices, sp500_tickers, reference_tickers)

    ticker_to_sector = dict(zip(sp500["symbol"], sp500["sector"]))
    sector_agg = {w: aggregate_by_sector(stock_frame, ticker_to_sector, window=w) for w in DEFAULT_WINDOWS}

    as_of = pd.Timestamp(prices.index[-1])
    dropped_stocks = [t for t in sp500_tickers if t not in prices.columns]
    dropped_ref = [t for t in reference_tickers if t not in prices.columns]

    log.info("Writing JSON outputs to %s", DATA_DIR)
    write_json(DATA_DIR / "meta.json",       build_meta(as_of, len(stock_prices.columns), dropped_stocks, dropped_ref))
    write_json(DATA_DIR / "rs_ranks.json",   build_rs_ranks_json(stock_frame, sp500))
    write_json(DATA_DIR / "sectors.json",    build_sectors_json(sector_agg))
    write_json(DATA_DIR / "rrg.json",        build_rrg_json(ref_frame))
    write_json(DATA_DIR / "benchmarks.json", build_snapshot_json(ref_frame, BENCHMARKS + VOLATILITY))
    write_json(DATA_DIR / "intermarket.json", build_snapshot_json(ref_frame, INTERMARKET))

    log.info("Pipeline complete. As-of: %s. Stock universe: %d. Dropped stocks: %d. Dropped refs: %d.",
             as_of.date(), len(stock_prices.columns), len(dropped_stocks), len(dropped_ref))
    return 0


def _rank_reference_against_stocks(
    all_prices: pd.DataFrame,
    stock_tickers: list[str],
    reference_tickers: list[str],
) -> pd.DataFrame:
    """Compute RS ranks for reference tickers against the stock universe distribution.

    We compute each reference ticker's return, then interpolate its rank into
    the stock universe's return distribution. This makes 'sector ETF at rank 82'
    mean 'this sector ETF is stronger than 82% of S&P 500 stocks over this window'.
    """
    stock_prices = all_prices[[c for c in all_prices.columns if c in stock_tickers]]
    ref_prices = all_prices[[c for c in all_prices.columns if c in reference_tickers]]

    frame = pd.DataFrame(index=ref_prices.columns)
    frame["price"] = ref_prices.iloc[-1]
    frame["prev_close"] = ref_prices.iloc[-2] if len(ref_prices) >= 2 else np.nan
    frame["day_change_pct"] = ((frame["price"] / frame["prev_close"]) - 1.0) * 100

    for window in DEFAULT_WINDOWS:
        if len(all_prices) <= window:
            frame[f"ret_{window}d"] = np.nan
            frame[f"rs_rank_{window}d"] = pd.NA
            frame[f"rs_trend_{window}d"] = np.nan
            continue

        # Current-day rank
        stock_ret = (stock_prices.iloc[-1] / stock_prices.iloc[-1 - window]) - 1.0
        ref_ret = (ref_prices.iloc[-1] / ref_prices.iloc[-1 - window]) - 1.0
        frame[f"ret_{window}d"] = ref_ret
        frame[f"rs_rank_{window}d"] = _interp_rank(stock_ret, ref_ret)

        # Trend rank (21 days ago)
        if len(all_prices) > window + DEFAULT_TREND_LOOKBACK:
            past_stock_ret = (
                stock_prices.iloc[-1 - DEFAULT_TREND_LOOKBACK] /
                stock_prices.iloc[-1 - DEFAULT_TREND_LOOKBACK - window]
            ) - 1.0
            past_ref_ret = (
                ref_prices.iloc[-1 - DEFAULT_TREND_LOOKBACK] /
                ref_prices.iloc[-1 - DEFAULT_TREND_LOOKBACK - window]
            ) - 1.0
            past_rank = _interp_rank(past_stock_ret, past_ref_ret)
            frame[f"rs_trend_{window}d"] = frame[f"rs_rank_{window}d"] - past_rank
        else:
            frame[f"rs_trend_{window}d"] = np.nan

    return frame


def _interp_rank(universe: pd.Series, values: pd.Series) -> pd.Series:
    """For each value, return its percentile rank (1-99) in the universe distribution."""
    sorted_u = universe.dropna().sort_values().values
    n = len(sorted_u)
    if n == 0:
        return pd.Series(np.nan, index=values.index)
    def rank_one(v):
        if pd.isna(v):
            return np.nan
        pos = np.searchsorted(sorted_u, v, side="right")
        return round((pos / n) * 98 + 1)
    return values.apply(rank_one).astype("Int64")


if __name__ == "__main__":
    sys.exit(main())

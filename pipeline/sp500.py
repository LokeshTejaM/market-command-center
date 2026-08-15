"""S&P 500 constituent list with GICS sector mapping.

Strategy:
  1. Try Wikipedia scrape (canonical, updates automatically).
  2. Fall back to a hardcoded snapshot (last-known-good, shipped in repo)
     if Wikipedia is unreachable, so the pipeline never breaks on a bad day.

This module exports:
    load_sp500() -> pd.DataFrame with columns ['symbol', 'name', 'sector', 'industry']

Sector labels are the 11 GICS Sectors, matching the sector ETF universe used
in etfs.py so we can compute proper sector aggregates.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

import pandas as pd

log = logging.getLogger(__name__)

WIKI_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
SNAPSHOT_PATH = Path(__file__).parent / "sp500_snapshot.json"


def _fetch_from_wikipedia() -> pd.DataFrame:
    """Pull the current S&P 500 list from Wikipedia."""
    tables = pd.read_html(WIKI_URL)  # table[0] is the constituent list
    df = tables[0].rename(
        columns={
            "Symbol": "symbol",
            "Security": "name",
            "GICS Sector": "sector",
            "GICS Sub-Industry": "industry",
        }
    )[["symbol", "name", "sector", "industry"]]

    # Wikipedia uses '.' in tickers like BRK.B / BF.B; yfinance wants '-'.
    df["symbol"] = df["symbol"].str.replace(".", "-", regex=False)
    return df


def _save_snapshot(df: pd.DataFrame) -> None:
    """Persist a last-known-good snapshot so we can survive Wikipedia outages."""
    SNAPSHOT_PATH.write_text(df.to_json(orient="records", indent=2))


def _load_snapshot() -> pd.DataFrame:
    return pd.read_json(SNAPSHOT_PATH, orient="records")


def load_sp500(prefer_snapshot: bool = False) -> pd.DataFrame:
    """Return the S&P 500 constituent DataFrame.

    Args:
        prefer_snapshot: if True, skip Wikipedia and use the cached snapshot.
            Handy for offline dev or CI where scraping is flaky.
    """
    if prefer_snapshot and SNAPSHOT_PATH.exists():
        log.info("Loading S&P 500 from cached snapshot")
        return _load_snapshot()

    try:
        df = _fetch_from_wikipedia()
        log.info("Fetched %d S&P 500 constituents from Wikipedia", len(df))
        _save_snapshot(df)
        return df
    except Exception as exc:
        log.warning("Wikipedia fetch failed (%s); falling back to snapshot", exc)
        if SNAPSHOT_PATH.exists():
            return _load_snapshot()
        raise RuntimeError(
            "S&P 500 list unavailable: Wikipedia failed and no snapshot exists"
        ) from exc


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    df = load_sp500()
    print(df.head(20))
    print(f"\nTotal: {len(df)} tickers, {df['sector'].nunique()} sectors")
    print(df["sector"].value_counts())

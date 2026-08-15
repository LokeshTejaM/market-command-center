"""S&P 500 constituent list with GICS sector mapping.

Strategy (in order):
  1. Try Wikipedia scrape (canonical).
  2. Fall back to datahub.io CSV (stable, curated).
  3. Fall back to a hardcoded snapshot shipped in the repo.

This module exports:
    load_sp500() -> pd.DataFrame with columns ['symbol', 'name', 'sector', 'industry']
"""

from __future__ import annotations

import io
import logging
from pathlib import Path

import pandas as pd
import requests

log = logging.getLogger(__name__)

WIKI_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
DATAHUB_CSV_URL = (
    "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/"
    "main/data/constituents.csv"
)
SNAPSHOT_PATH = Path(__file__).parent / "sp500_snapshot.json"

REQUIRED_COLS = {"symbol", "name", "sector"}


def _normalize_ticker(sym: str) -> str:
    """Wikipedia uses '.' in tickers like BRK.B / BF.B; yfinance wants '-'."""
    return sym.replace(".", "-").strip().upper()


def _find_constituent_table(tables: list[pd.DataFrame]) -> pd.DataFrame:
    """Wikipedia occasionally shifts table order — find the one with the right cols."""
    for i, t in enumerate(tables):
        cols = {str(c).lower() for c in t.columns}
        if "symbol" in cols and ("security" in cols or "company" in cols):
            log.info("Using Wikipedia table[%d] as S&P 500 constituents", i)
            return t
    raise RuntimeError(
        f"No Wikipedia table looked like an S&P 500 constituents list "
        f"(scanned {len(tables)} tables, columns: "
        f"{[list(t.columns)[:3] for t in tables[:5]]})"
    )


def _fetch_from_wikipedia() -> pd.DataFrame:
    tables = pd.read_html(WIKI_URL, flavor="lxml")
    tbl = _find_constituent_table(tables)
    rename_map = {}
    for c in tbl.columns:
        cl = str(c).lower()
        if cl == "symbol":
            rename_map[c] = "symbol"
        elif cl in ("security", "company"):
            rename_map[c] = "name"
        elif "gics sector" in cl:
            rename_map[c] = "sector"
        elif "gics sub-industry" in cl or "sub-industry" in cl or "industry" in cl:
            rename_map[c] = "industry"
    df = tbl.rename(columns=rename_map)
    if "industry" not in df.columns:
        df["industry"] = df.get("sector", "")
    df = df[["symbol", "name", "sector", "industry"]].copy()
    df["symbol"] = df["symbol"].astype(str).map(_normalize_ticker)
    return df


def _fetch_from_datahub() -> pd.DataFrame:
    """Fallback #1: datahub.io curated CSV. Simple, no HTML parsing needed."""
    r = requests.get(DATAHUB_CSV_URL, timeout=15)
    r.raise_for_status()
    df = pd.read_csv(io.StringIO(r.text))
    # datahub cols: Symbol, Security, GICS Sector, GICS Sub-Industry, ...
    df = df.rename(
        columns={
            "Symbol": "symbol",
            "Security": "name",
            "GICS Sector": "sector",
            "GICS Sub-Industry": "industry",
        }
    )
    if "industry" not in df.columns:
        df["industry"] = df["sector"]
    df = df[["symbol", "name", "sector", "industry"]].copy()
    df["symbol"] = df["symbol"].astype(str).map(_normalize_ticker)
    return df


def _save_snapshot(df: pd.DataFrame) -> None:
    SNAPSHOT_PATH.write_text(df.to_json(orient="records", indent=2))
    log.info("Wrote snapshot with %d rows to %s", len(df), SNAPSHOT_PATH)


def _load_snapshot() -> pd.DataFrame:
    return pd.read_json(SNAPSHOT_PATH, orient="records")


def load_sp500(prefer_snapshot: bool = False) -> pd.DataFrame:
    """Return the S&P 500 constituent DataFrame with robust fallbacks."""
    if prefer_snapshot and SNAPSHOT_PATH.exists():
        log.info("Loading S&P 500 from cached snapshot (forced)")
        return _load_snapshot()

    for name, fetch in (("Wikipedia", _fetch_from_wikipedia), ("datahub.io", _fetch_from_datahub)):
        try:
            df = fetch()
            if len(df) < 400:
                raise RuntimeError(f"{name} returned only {len(df)} rows -- suspicious, refusing")
            missing = REQUIRED_COLS - set(df.columns)
            if missing:
                raise RuntimeError(f"{name} missing required cols: {missing}")
            log.info("Loaded %d S&P 500 constituents from %s", len(df), name)
            try:
                _save_snapshot(df)
            except Exception as exc:
                log.warning("Snapshot save failed (%s) -- non-fatal", exc)
            return df
        except Exception as exc:
            log.warning("%s fetch failed: %s", name, exc)

    if SNAPSHOT_PATH.exists():
        log.warning("All live sources failed; loading from cached snapshot")
        return _load_snapshot()

    raise RuntimeError(
        "S&P 500 list unavailable: Wikipedia + datahub.io both failed and no snapshot exists"
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    df = load_sp500()
    print(df.head(10))
    print(f"\nTotal: {len(df)} tickers, {df['sector'].nunique()} sectors")
    print(df["sector"].value_counts())

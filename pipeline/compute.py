"""Cross-sectional Relative Strength ranks + RRG coordinates.

The critical fix vs the old buggy dashboard:

    OLD (WRONG): _percentileRank(ticker.rsHistory, ticker.rsToday)
        Answers "Is NVDA's ratio-to-SPY today higher than NVDA's ratio-to-SPY
        was over its own last 25 days?"  --  self-referential, tells you
        nothing about leadership across the market.

    NEW (CORRECT): pct_rank(universe_returns[t], ticker_return[t])
        Answers "Where does NVDA's 63-day return rank against every other
        stock in the universe today?"  --  actual cross-sectional strength.

Public functions:
    compute_returns(prices, windows)         -> per-ticker return over each window
    compute_rs_ranks(returns)                -> 1-99 cross-sectional percentile
    compute_rs_trend(rank_history, lookback) -> change in rank over lookback
    compute_rrg_coords(...)                  -> (rs_rank, rs_trend) per ticker
    aggregate_by_sector(...)                 -> median rank + trend per sector

All functions are pure (no I/O), so they are trivially unit-testable.
"""

from __future__ import annotations

from typing import Iterable

import numpy as np
import pandas as pd


# Default windows follow IBD / Minervini conventions.
# Short-momo traders should lean on 21d/63d; positional on 126d/252d.
DEFAULT_WINDOWS = [21, 63, 126, 252]

# RS trend lookback: how much has our rank changed over the last N days?
# 21 days = ~1 month; long enough to smooth noise, short enough to see rotation.
DEFAULT_TREND_LOOKBACK = 21


def compute_returns(prices: pd.DataFrame, windows: Iterable[int] = DEFAULT_WINDOWS) -> dict[int, pd.Series]:
    """Compute trailing return over each window, per ticker, as-of the latest date.

    Args:
        prices: DataFrame indexed by date, columns = tickers, values = close price.
        windows: list of lookback windows (trading days).

    Returns:
        {window: Series indexed by ticker, values = return over that window}
    """
    latest = prices.iloc[-1]
    out: dict[int, pd.Series] = {}
    for w in windows:
        if len(prices) <= w:
            # Not enough history for this window; return all-NaN.
            out[w] = pd.Series(np.nan, index=prices.columns, name=f"ret_{w}d")
            continue
        past = prices.iloc[-1 - w]
        out[w] = ((latest / past) - 1.0).rename(f"ret_{w}d")
    return out


def compute_rs_ranks(returns: pd.Series) -> pd.Series:
    """Convert a Series of returns into cross-sectional percentile ranks (1-99).

    Uses average tie-breaking so identical returns get the same rank.
    NaN returns produce NaN ranks (so untracked / dropped tickers are visible).
    """
    ranks = returns.rank(method="average", pct=True, ascending=True)
    # Scale to 1-99 (IBD convention), keep NaNs.
    return (ranks * 98 + 1).round().astype("Int64")


def compute_returns_history(prices: pd.DataFrame, window: int, tail_days: int) -> pd.DataFrame:
    """Compute rolling N-day returns for the last `tail_days`, per ticker.

    Used to build a history of RS ranks (which is what RRG needs).
    """
    rets = prices.pct_change(window)
    return rets.tail(tail_days)


def compute_rank_history(returns_history: pd.DataFrame) -> pd.DataFrame:
    """Convert a returns history DataFrame into cross-sectional rank history.

    Every row (date) is ranked independently across all columns (tickers).
    Result values are 1-99 percentile ranks.
    """
    ranks = returns_history.rank(axis=1, method="average", pct=True, ascending=True)
    return (ranks * 98 + 1).round()


def compute_rs_trend(rank_history: pd.DataFrame, lookback: int = DEFAULT_TREND_LOOKBACK) -> pd.Series:
    """Change in RS rank over `lookback` days: today's rank - past rank.

    Positive => rank is rising (accelerating leadership).
    Negative => rank is falling (fading leadership).
    """
    if len(rank_history) < lookback + 1:
        return pd.Series(np.nan, index=rank_history.columns, name=f"rs_trend_{lookback}d")
    today = rank_history.iloc[-1]
    past = rank_history.iloc[-1 - lookback]
    return (today - past).rename(f"rs_trend_{lookback}d")


def build_rs_frame(
    prices: pd.DataFrame,
    windows: Iterable[int] = DEFAULT_WINDOWS,
    trend_lookback: int = DEFAULT_TREND_LOOKBACK,
) -> pd.DataFrame:
    """One-stop builder: returns a DataFrame with all RS metrics per ticker.

    Columns:
        ret_{w}d          -- trailing return for window w
        rs_rank_{w}d      -- cross-sectional percentile rank for window w
        rs_trend_{w}d     -- change in rs_rank over `trend_lookback` days
        price             -- latest close
        prev_close        -- prior day close (for day-change calc)
        day_change_pct    -- (price / prev_close - 1) * 100
    """
    frame = pd.DataFrame(index=prices.columns)
    frame["price"] = prices.iloc[-1]
    frame["prev_close"] = prices.iloc[-2] if len(prices) >= 2 else np.nan
    frame["day_change_pct"] = ((frame["price"] / frame["prev_close"]) - 1.0) * 100

    returns_now = compute_returns(prices, windows)
    for w, ret in returns_now.items():
        frame[f"ret_{w}d"] = ret
        frame[f"rs_rank_{w}d"] = compute_rs_ranks(ret)

    # RS trend needs rank history, computed over enough tail to cover trend_lookback.
    tail_needed = max(windows) + trend_lookback + 5
    for w in windows:
        rets_hist = compute_returns_history(prices, w, tail_needed)
        rank_hist = compute_rank_history(rets_hist)
        frame[f"rs_trend_{w}d"] = compute_rs_trend(rank_hist, trend_lookback)

    return frame


def aggregate_by_sector(
    rs_frame: pd.DataFrame,
    ticker_to_sector: dict[str, str],
    window: int = 63,
) -> pd.DataFrame:
    """Compute per-sector median RS rank + trend.

    Args:
        rs_frame: output of build_rs_frame().
        ticker_to_sector: {ticker: GICS sector name}
        window: which timeframe to aggregate on.

    Returns DataFrame indexed by sector with columns:
        rs_rank_median, rs_trend_median, n_constituents,
        top_5 (list of top-ranked tickers)
    """
    df = rs_frame.copy()
    df["sector"] = df.index.map(ticker_to_sector.get)
    df = df.dropna(subset=["sector"])

    rank_col = f"rs_rank_{window}d"
    trend_col = f"rs_trend_{window}d"

    grouped = df.groupby("sector")
    agg = grouped.agg(
        rs_rank_median=(rank_col, "median"),
        rs_trend_median=(trend_col, "median"),
        n_constituents=(rank_col, "count"),
    )

    # Top 5 leaders per sector (highest rs_rank).
    top5 = (
        df.sort_values(rank_col, ascending=False)
          .groupby("sector")
          .head(5)
          .groupby("sector")
          .apply(lambda x: list(x.index), include_groups=False)
    )
    agg["top_5"] = top5

    return agg.sort_values("rs_rank_median", ascending=False)


def rrg_quadrant(rs_rank: float, rs_trend: float) -> str:
    """Classify a (rank, trend) point into the four RRG quadrants."""
    if pd.isna(rs_rank) or pd.isna(rs_trend):
        return "unknown"
    strong = rs_rank >= 50
    rising = rs_trend > 0
    if strong and rising:
        return "leading"      # top-right: strong AND getting stronger
    if strong and not rising:
        return "weakening"    # bottom-right: strong but fading
    if not strong and rising:
        return "improving"    # top-left: weak but recovering
    return "lagging"          # bottom-left: weak AND getting weaker

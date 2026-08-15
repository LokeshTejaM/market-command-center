"""End-to-end pipeline test with synthetic price data.

Bypasses yfinance / Wikipedia so we can verify correctness of:
    * compute.py math (cross-sectional RS ranks, RS trend, RRG quadrants)
    * build_rs_data.py JSON output shape (matches what frontend expects)
    * aggregate_by_sector logic (sector medians, top-5 leaders)

Run: `uv run test_pipeline.py`
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

import numpy as np
import pandas as pd

import build_rs_data as pipeline
from compute import (
    aggregate_by_sector,
    build_rs_frame,
    compute_rs_ranks,
    rrg_quadrant,
)

log = logging.getLogger(__name__)


def make_synthetic_prices(n_tickers: int = 60, n_days: int = 400, seed: int = 42) -> pd.DataFrame:
    """Generate synthetic OHLC-close data. Each ticker gets its own trend + noise."""
    rng = np.random.default_rng(seed)
    dates = pd.bdate_range(end=pd.Timestamp.today().normalize(), periods=n_days)
    tickers = [f"SYN{i:03d}" for i in range(n_tickers)]

    # Give each ticker a random drift so we get real RS separation.
    drifts = rng.normal(loc=0.0004, scale=0.001, size=n_tickers)
    volatilities = rng.uniform(0.008, 0.025, size=n_tickers)

    prices = np.zeros((n_days, n_tickers))
    prices[0] = 100
    for t in range(1, n_days):
        shocks = rng.normal(loc=drifts, scale=volatilities)
        prices[t] = prices[t - 1] * (1 + shocks)

    df = pd.DataFrame(prices, index=dates, columns=tickers)
    # Also inject SPY so build_rs_frame works.
    df["SPY"] = df.iloc[:, :10].mean(axis=1)   # SPY as "average of top 10"
    return df


def test_compute_rs_ranks_are_cross_sectional():
    """RS ranks must be a strictly monotone function of returns cross-sectionally."""
    returns = pd.Series([0.10, 0.05, 0.20, -0.05, 0.00], index=list("ABCDE"))
    ranks = compute_rs_ranks(returns)
    # C has highest return (0.20) -> highest rank; D has lowest -> lowest.
    assert ranks["C"] > ranks["A"] > ranks["B"] > ranks["E"] > ranks["D"], f"bad ordering: {ranks.to_dict()}"
    # With N=5 elements, top is 99 (100th percentile mapped to 1..99 scale).
    assert ranks["C"] == 99, f"top should be 99, got {ranks['C']}"
    # All ranks must be within [1, 99]
    assert ranks.min() >= 1 and ranks.max() <= 99, f"out of range: {ranks.to_dict()}"
    print(f"PASS: compute_rs_ranks orders correctly and clamps to [1,99] (ranks: {ranks.to_dict()})")


def test_rrg_quadrant():
    assert rrg_quadrant(80, 5) == "leading"
    assert rrg_quadrant(80, -5) == "weakening"
    assert rrg_quadrant(30, 5) == "improving"
    assert rrg_quadrant(30, -5) == "lagging"
    assert rrg_quadrant(np.nan, 5) == "unknown"
    print("PASS: rrg_quadrant classifies all 4 quadrants correctly")


def test_build_rs_frame_shape():
    prices = make_synthetic_prices(n_tickers=50, n_days=400)
    frame = build_rs_frame(prices)
    for w in [21, 63, 126, 252]:
        assert f"ret_{w}d" in frame.columns
        assert f"rs_rank_{w}d" in frame.columns
        assert f"rs_trend_{w}d" in frame.columns
    # ranks are 1-99 or NaN
    ranks = frame["rs_rank_63d"].dropna()
    assert ranks.min() >= 1 and ranks.max() <= 99, "rank out of [1,99]"
    print(f"PASS: build_rs_frame produces expected columns and rank bounds ({len(frame)} tickers)")


def test_aggregate_by_sector():
    prices = make_synthetic_prices(n_tickers=40, n_days=400)
    frame = build_rs_frame(prices)
    # Assign every 4 tickers to a sector.
    sectors = ["Tech", "Health", "Energy", "Finance"]
    mapping = {t: sectors[i % 4] for i, t in enumerate(frame.index)}
    agg = aggregate_by_sector(frame, mapping, window=63)
    assert set(agg.index) <= set(sectors), "unexpected sector"
    assert (agg["n_constituents"] > 0).all()
    assert all(isinstance(x, list) and len(x) <= 5 for x in agg["top_5"])
    print(f"PASS: aggregate_by_sector produces {len(agg)} sectors with medians + top-5")


def test_end_to_end_json_shape(tmp_dir: Path):
    """Run the pipeline against synthetic data and verify JSON output shape."""
    prices = make_synthetic_prices(n_tickers=50, n_days=400)
    sp500 = pd.DataFrame({
        "symbol": prices.columns[:50],
        "name": [f"Company {t}" for t in prices.columns[:50]],
        "sector": [["Tech", "Health", "Energy", "Finance"][i % 4] for i in range(50)],
        "industry": ["Test Industry"] * 50,
    })

    stock_prices = prices.iloc[:, :50]
    stock_frame = build_rs_frame(stock_prices)
    ticker_to_sector = dict(zip(sp500["symbol"], sp500["sector"]))
    sector_agg = {w: aggregate_by_sector(stock_frame, ticker_to_sector, window=w) for w in [21, 63, 126, 252]}

    # Write to tmp_dir and re-read to prove JSON serialization works
    meta = pipeline.build_meta(pd.Timestamp(prices.index[-1]), 50, [], [])
    rs_json = pipeline.build_rs_ranks_json(stock_frame, sp500)
    sec_json = pipeline.build_sectors_json(sector_agg)

    for name, payload in [("meta", meta), ("rs", rs_json), ("sectors", sec_json)]:
        path = tmp_dir / f"{name}.json"
        pipeline.write_json(path, payload)
        # Re-read and validate
        reloaded = json.loads(path.read_text())
        assert reloaded.get("schema_version") == pipeline.SCHEMA_VERSION, f"{name} missing schema_version"

    # Check RS records have all expected fields
    sample_rec = rs_json["records"][0]
    for key in ["ticker", "price", "sector", "ret_63d", "rs_rank_63d", "rs_trend_63d"]:
        assert key in sample_rec, f"missing {key} in RS record"

    print(f"PASS: end-to-end JSON has correct shape (rs records: {rs_json['count']}, sectors: {len(sec_json['by_window']['63'])})")


def test_no_nan_in_json_output(tmp: Path) -> None:
    """Regression: pipeline must produce RFC-8259 compliant JSON (no NaN).

    We forcibly inject NaN into a DataFrame and confirm write_json produces
    a file that `json.loads` accepts. Browsers refuse to parse `NaN` literals
    which was a shipping bug (data/rs_ranks.json unrenderable).
    """
    import json, math
    from build_rs_data import write_json
    payload = {
        "records": [
            {"ticker": "AAPL", "rs_rank": 87, "ret": 0.12},
            {"ticker": "MSFT", "rs_rank": 82, "ret": float("nan")},
            {"ticker": "NVDA", "rs_rank": None, "ret": math.inf},
            {"ticker": "TSLA", "rs_rank": np.nan, "ret": -math.inf},
        ],
    }
    out = tmp / "nan_regression.json"
    write_json(out, payload)
    raw = out.read_text()
    assert "NaN" not in raw, f"NaN leaked into JSON: {raw}"
    assert "Infinity" not in raw, f"Infinity leaked into JSON: {raw}"
    parsed = json.loads(raw)  # must succeed
    assert parsed["records"][1]["ret"] is None
    assert parsed["records"][2]["ret"] is None
    print("PASS: NaN/Inf sanitized to null in JSON output")


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    test_compute_rs_ranks_are_cross_sectional()
    test_rrg_quadrant()
    test_build_rs_frame_shape()
    test_aggregate_by_sector()

    tmp = Path("/tmp/mcc-pipeline-test")
    tmp.mkdir(exist_ok=True)
    test_end_to_end_json_shape(tmp)
    test_no_nan_in_json_output(tmp)

    print("\nAll pipeline tests PASSED.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

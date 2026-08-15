# GOAL: Ship a production-grade momentum dashboard end-to-end    DONE

**Owner:** nancy (code-puppy)
**Repo:** https://github.com/LokeshTejaM/market-command-center
**Live URL:** https://lokeshtejam.github.io/market-command-center/

## Definition of done — status

- [x] Real S&P 500 data flowing daily via GitHub Actions
- [x] Sector Rotation page renders with real data (blocker: NaN in JSON — fixed)
- [x] Info tooltips visible and readable on every plot (upgraded to instant custom CSS tooltip)
- [x] Watchlist page with localStorage (`js/dashboards/watchlist.js`)
- [x] "Run full pipeline" link opens Actions in a new tab (safe: no PAT needed in browser)
- [x] Industry-group ETFs added (40+ tickers, Jeff Sun's Index→Sector→Industry→Stocks structure)
- [x] Jeff Sun's `RS_Strength %` column (25d self-percentile) alongside cross-sectional rank
- [x] 20d realized volatility column (position-sizing input)
- [x] EW / CW variants both computed in RRG (shown as separate points via `variant` field)
- [x] README fully updated with all features
- [x] All commits pushed to `main`, live URL reflects everything

## Bugs fixed

-  **NaN in JSON**: `_sanitize()` recursive walker + `allow_nan=False` + regression test
-  **Info icons dead**: moved CSS to core.css (was scoped to sector page only) + custom CSS ::after tooltip that appears instantly (no 1.5s native-title delay)

## Data pipeline health

- 503 real S&P 500 tickers loaded daily from Yahoo Finance
- 40+ industry-group ETFs (XSD/SMH, KRE/KIE, XBI/IHI, XRT/IBUY, XOP/URA/TAN/GDX/XME/LIT/COPX, IBIT/WGMI/BLOK, etc.)
- 11 GICS sector ETFs × 2 variants (CW + EW)
- 6 broad benchmarks (SPY/RSP/QQQ/QQQE/IWM/DIA)
- Volatility (VIX/VIX3M) + intermarket (TLT/HYG/LQD/UUP/GLD/USO)
- Regression tests pass: NaN sanitization, cross-sectional rank correctness, RRG quadrant math

## What's live at each URL

- `/#breadth`         — StockBee-style breadth monitor with 8 KPIs and 7 charts, tooltips on every one
- `/#sector`          — Cross-sectional RS ranks, RRG scatter, full RS table with new columns
- `/#sector-detail?sector=Information Technology` — deep-dive into any sector
- `/#calendar`        — FOMC / CPI / NFP / PCE upcoming events + Momentum Trader Playbook
- `/#watchlist`       — Personal starred tickers with live localStorage sync

## Follow-ups (not part of this goal, potential v2 backlog)

- RS Histogram Sparkline (Jeff's iconic viz — 25-day RS ratio as inline SVG bars per row)
- EW vs CW visual toggle on RRG (currently both shown; a filter would be nice)
- Industry-group deep-dive page (like sector-detail but for a specific industry ETF)
- Country ETFs page (international rotation view — traderwillhu has this)
- Leveraged ETF pair viewer (SOXL/TQQQ shown next to base tickers)
- Real-time WebSocket updates (would need paid data feed)
- Backtesting page (given historical RS ranks, simulate a strategy)

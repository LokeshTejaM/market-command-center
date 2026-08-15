# Market Command Center

A unified, static-hosted momentum trading dashboard. Combines
StockBee-style breadth analysis (Pradeep Bonde), cross-sectional
relative-strength ranks, Relative Rotation Graphs (Jeff Sun /
@jfsrev style), and a macro-event calendar.

**Live data, zero backend, zero API keys.** A GitHub Actions cron
runs a Python pipeline every weekday morning, downloads S&P 500
EOD data via `yfinance`, computes RS ranks + Jeff Sun's
RS_Strength + realized volatility + RRG coordinates in pandas,
commits the resulting JSON back to the repo, and GitHub Pages
serves them.

**Live URL:** https://lokeshtejam.github.io/market-command-center/

## Dashboards

| Page | What it shows |
|---|---|
| **Market Breadth**    | StockBee breadth monitor with regime detection, 8 KPIs, 7 charts. Tooltips on every metric. |
| **Sector Rotation**   | Cross-sectional RS ranks per sector, RRG scatter, full RS table with 5 new columns (RS Str%, Vol, etc). |
| **Sector Detail**     | Click any sector to drill into constituent leaders with mini-RRG. |
| **Macro Calendar**    | Upcoming FOMC / CPI / NFP / PCE events + Momentum Trader Playbook. |
| **Watchlist**         | Personal starred tickers, localStorage-backed. Survives page reload. |

Every plot has a hover-able **info icon** that explains WHAT it
measures, HOW it's calculated, and HOW to read it.

## Data columns explained

The main RS table shows:

| Column | Formula | Range | Meaning |
|---|---|---|---|
| **RS Rank**   | percentile of N-day return across S&P 500 | 1-99 | Cross-sectional strength (IBD/Minervini) |
| **RS Trend**  | today's RS Rank minus RS Rank 21 days ago | -98..+98 | Rank is accelerating or fading |
| **RS Str%**   | percentile of today's `ticker/SPY` ratio within own 25d series | 0-100 | Jeff Sun's self-referential RS_Strength |
| **Vol 20d**   | annualized stdev of 20d log returns | 0..∞% | Position-sizing input, ~ATR proxy |
| **Quadrant**  | (RS Rank, RS Trend) → Leading / Weakening / Improving / Lagging | — | RRG interpretation |

**Why two RS metrics?** RS Rank answers *"is this a market leader
right now?"* (cross-sectional). RS Str% answers *"is this ticker
at its own recent leadership peak?"* (self-referential, Jeff
Sun's exact recipe). They diverge in interesting ways — a stock
can have cross-sectional Rank 30 but self-Str 90 (regaining
strength from weakness), or Rank 80 but self-Str 20 (fading
leader — take profits).

## Architecture

```
  [GitHub Actions cron -- weekday 06:00 ET]
              |
              |  Python (yfinance + pandas):
              |  fetch S&P 500 + 40 industry ETFs + benchmarks
              |  compute cross-sectional RS + RS_Strength + Vol + RRG
              v
     [data/*.json committed to repo]
              |
              v
     [GitHub Pages serves static files -- zero live API calls]
              |
              v
     [Browser: registry-based dashboard modules render]
              |
              v
     [localStorage: Watchlist, saved per-user, never leaves browser]
```

## What was rebuilt vs the v1 dashboard

The old Sector Rotation page had four hard bugs:

1. Used `corsproxy.io` (public CORS proxy, unreliable, rate-limited).
2. No fetch timeout or retries — a single stalled request hung the page.
3. RS calc was ambiguous — was computing self-percentile but labeling it "RS Rank".
4. Refetched 76 tickers every 5 min through a public proxy — guaranteed 429s.

All gone. RS is now computed once per day in Python across the entire
S&P 500 universe (proper cross-sectional 1-99 rank), AND Jeff Sun's
self-percentile is kept as a *second* column for orthogonal signal.

## Layout

```
market-command-center/
  index.html                 shell + nav
  css/
    core.css                 design tokens + universal info-icon tooltip
    dashboards/*.css         one per dashboard, scoped by #view-<id>
  js/
    shared.js                fetchJSON w/ timeout+retry, infoIcon helper
    watchlist.js             localStorage-backed watchlist module (shared)
    registry.js              plugin registry + hash routing (query params)
    dashboards/
      breadth.js
      sector.js
      sector-detail.js       (hiddenInNav; reached via #sector-detail?sector=X)
      calendar.js
      watchlist.js
  data/                      GENERATED -- pipeline output, served as-is
    meta.json                schema version, build time, universe stats
    rs_ranks.json            per-ticker RS ranks + trends + RS_Strength + vol
    sectors.json             per-sector medians + top-5 leaders per timeframe
    rrg.json                 RRG coords for sector ETFs (CW + EW variants)
    benchmarks.json          SPY/RSP/QQQ/IWM/VIX snapshot
    intermarket.json         TLT/HYG/DXY/GLD/USO snapshot
  pipeline/                  Python data pipeline (uv-managed)
    build_rs_data.py         main entry: writes data/*.json
    compute.py               RS ranks + RS_Strength + Vol + RRG math
    sp500.py                 S&P 500 constituents (Wikipedia + datahub fallback)
    etfs.py                  sector + 40 industry ETFs + benchmarks + intermarket
    test_pipeline.py         6 unit + regression tests (NaN, rank correctness)
    gen_sample_data.py       offline sample data generator
  .github/workflows/
    refresh-data.yml         daily cron + workflow_dispatch trigger
    deploy.yml               GitHub Pages deployment
```

## Local development

```bash
# Install pipeline deps (optional -- only if you want to rebuild data)
cd pipeline && uv sync

# Regenerate sample data (offline-friendly, uses synthetic prices)
uv run python gen_sample_data.py

# Or run the real pipeline (needs internet)
uv run python build_rs_data.py

# Serve the static site
cd .. && python3 -m http.server 8901
open http://localhost:8901/
```

## Deploy

Push to `main`. GitHub Pages is already configured on the branch root.
The Actions cron writes to `main` daily; Pages picks it up automatically.
Manual pipeline trigger: Actions → **refresh-market-data** → Run workflow
(or click the "Run full pipeline" link in the app's toolbar).

## Reading materials that shaped this design

- Jeff Sun's tweet threads on RS methodology: https://x.com/jfsrev
- Pradeep Bonde's StockBee blog: https://stockbee.blogspot.com/
- Qullamaggie's process (episodic pivots, range breakouts):
  https://qullamaggie.com/
- StockCharts.com RRG methodology (JdK's original):
  https://school.stockcharts.com/doku.php?id=chart_analysis:rrg_charts
- Comparable open-source dashboard (studied for inspiration):
  https://github.com/traderwillhu/market_dashboard

## Credits

- Market Breadth data: **StockBee Monitor** by Pradeep Bonde.
- Sector Rotation & RS methodology: inspired by **@jfsrev** (Jeff Sun, CFTe).
- For educational purposes only. **Not financial advice.**

# Market Command Center

A unified, static-hosted momentum trading dashboard. Combines StockBee-style
breadth analysis (Pradeep Bonde) with cross-sectional relative-strength ranks
and Relative Rotation Graphs (Jeff Sun / @jfsrev style).

**Live data, zero backend, zero API keys.** A GitHub Actions cron runs a Python
pipeline every weekday morning, downloads S&P 500 EOD data via `yfinance`,
computes RS ranks + RRG coordinates in pandas, commits the resulting JSON back
to the repo, and GitHub Pages serves them.

## Dashboards

| Dashboard | Description | Source |
|---|---|---|
| **Market Breadth** | StockBee breadth monitor with regime detection, KPIs, 7 charts | Google Sheets GVIZ (Pradeep Bonde) |
| **Sector Rotation** | Cross-sectional RS ranks per sector + full stock leaderboard + RRG scatter | `data/*.json` (built by pipeline) |
| **Sector Detail** | Click any sector to drill into its constituent leaders and mini-RRG | Same |

## Architecture

```
  [GitHub Actions cron -- daily 06:00 ET, weekdays]
              |
              |  Python (yfinance + pandas):
              |  fetch S&P 500 EOD bars -> compute cross-sectional
              |  RS ranks + RRG coords -> write JSON
              v
     [data/*.json committed to repo]
              |
              v
     [GitHub Pages serves static files -- zero live API calls]
              |
              v
     [Browser: registry-based dashboard modules render]
```

## What was fixed vs the v1 dashboard

The old Sector Rotation page had four hard bugs:

1. **Used `corsproxy.io`** (public CORS proxy, unreliable, rate-limited).
2. **No fetch timeout or retries** -- a single stalled request could hang the
   page forever.
3. **RS calculation was self-referential** -- it computed each ticker's percentile
   against its own last 25 days, not cross-sectionally against other stocks. That
   answered "is this ticker's ratio-to-SPY at a recent high?" instead of the
   actually useful question "does this ticker lead the market?"
4. **Refetched 76 tickers every 5 min** through a public proxy -- guaranteed 429s.

All four are gone. RS is now computed once per day in Python with `pd.rank(pct=True)`
across the entire S&P 500 universe -- proper 1-99 cross-sectional percentile,
matching the IBD / Minervini / Bonde convention.

## Layout

```
market-command-center/
  index.html                 shell + nav
  css/
    core.css                 design tokens
    dashboards/
      breadth.css
      sector.css             (shared: sector + sector-detail)
  js/
    shared.js                fetchJSON with timeout+retry, DOM helpers
    registry.js              plugin registry + hash routing
    dashboards/
      breadth.js
      sector.js
      sector-detail.js
  data/                      GENERATED -- pipeline output, served as-is
    meta.json                schema version, build time, universe stats
    rs_ranks.json            per-ticker RS ranks (21/63/126/252d) + trends
    sectors.json             per-sector medians + top-5 leaders per timeframe
    rrg.json                 sector ETF coordinates for RRG chart
    benchmarks.json          SPY/RSP/QQQ/IWM/VIX snapshot
    intermarket.json         TLT/HYG/DXY/GLD/USO snapshot
  pipeline/                  Python data pipeline (uv-managed)
    pyproject.toml
    build_rs_data.py         main entry: writes data/*.json
    compute.py               RS ranks + RRG math (pure, unit-testable)
    sp500.py                 S&P 500 constituents (Wikipedia scrape + snapshot)
    etfs.py                  sector ETFs + benchmarks + inter-market tickers
    gen_sample_data.py       generates synthetic data for local dev
    test_pipeline.py         end-to-end sanity tests
  .github/workflows/
    refresh-data.yml         daily cron + workflow_dispatch trigger
```

## Local development

```bash
# 1. Install pipeline dependencies (optional -- only needed if you want to
#    regenerate data locally rather than using what's committed).
cd pipeline && uv sync

# 2. Regenerate sample data (offline-friendly, uses synthetic prices).
uv run gen_sample_data.py

# 3. Or run the real pipeline (needs internet: Yahoo Finance + Wikipedia).
uv run build_rs_data.py

# 4. Serve the static site.
cd .. && python3 -m http.server 8901
open http://localhost:8901/
```

## Adding a new dashboard

1. Create `js/dashboards/my-dashboard.js`:
   ```js
   DashboardRegistry.register({
       id: 'my-dashboard',
       name: 'My Dashboard',
       icon: '\u2b50',
       order: 4,
       init(container) { /* build DOM, fetch data */ },
       activate() { /* on focus */ },
       deactivate() { /* on blur -- abort in-flight, pause timers */ },
       destroy() { /* full teardown */ },
   });
   ```
2. Optionally create `css/dashboards/my-dashboard.css` (scope everything under
   `#view-my-dashboard`).
3. Add both to `index.html`. The registry generates a nav tab automatically.

Set `hiddenInNav: true` to keep a dashboard reachable only via URL hash
(like `sector-detail`).

## Deploy

Static site. Push to `main`, enable GitHub Pages on the `main` branch, done.
The Actions cron writes to `main` daily; Pages picks it up automatically.

## Credits & attribution

- Market Breadth data: [StockBee Monitor](https://stockbee.blogspot.com/)
  by Pradeep Bonde.
- Sector Rotation methodology: inspired by [@jfsrev](https://x.com/jfsrev)
  (Jeff Sun, CFTe).
- For educational purposes only. Not financial advice.

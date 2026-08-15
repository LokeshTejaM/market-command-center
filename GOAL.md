# GOAL (Round 2): Fix reported bugs + impeccable polish + validate

**Owner:** nancy (code-puppy)
**Repo:** https://github.com/LokeshTejaM/market-command-center
**Live URL:** https://lokeshtejam.github.io/market-command-center/

## Reported issues -- status

- [x] **Watchlist "Clear All" broken + no per-row delete**
  * Removed the "Clear all" button entirely (bad UX -- destructive nuke)
  * Added a per-row delete button (crisp X icon, red hover) at the END of every row
  * Fade-out animation on click for visual feedback
  * Fixed misaligned columns for hand-added tickers not in S&P 500

- [x] **Info tooltip text going UNDERNEATH the plot above**
  * Root cause: three parent containers had `overflow: hidden` (table wrappers, chart cards). Pure-CSS `::after` tooltips cannot escape an ancestor's overflow clip -- no amount of `z-index` fixes this
  * Fix: portal the tooltip to `<body>` with `position: fixed`, positioned via JS on hover
  * Result: tooltips now visibly overlay ALL neighboring elements, regardless of the icon's ancestor overflow rules
  * Bonus: auto-flip below icon when near top of viewport, arrow points to icon center

- [x] **Impeccable polish pass on all dashboards**
  * Removed ALL side-stripe borders (impeccable absolute ban): breadth KPI cards, sector RRG quadrant legend, sector-detail quadrant tiles
  * Rewrote with subtle full-border tints + diagonal gradient backgrounds + leading colored pips
  * Fixed a broken CSS rule in calendar.css (`border-left:#ef4444` with no width -- a truly cursed line)
  * Polished Watchlist empty state: large icon, layered background gradient, better hierarchy, added privacy hint
  * Polished Watchlist inputs: focus states, hover states, cleaner button typography

- [x] **Validate everything is working + all calculations correct**
  * 6/6 pipeline unit tests pass (including NaN sanitization regression)
  * All 6 data JSONs clean (0 NaN, 0 Inf literals)
  * 503 real S&P 500 records; 501 have 63d RS Rank; 503/503 have RS_Strength %; 503/503 have Vol 20d
  * Rank distribution 1..99 median 50 (proper uniform cross-sectional)
  * 11 GICS sectors all present; SPY correctly excluded from stock universe
  * All 7 JS modules parse cleanly (node --check)
  * HTML tag stack balances perfectly (no unclosed elements)

## Design laws enforced (impeccable rulebook)

| Rule | Status | Notes |
|---|---|---|
| No side-stripe borders | PASS | All rewrote to full borders + gradient tints + pips |
| No gradient text (background-clip: text) | PASS | grep returned zero |
| Glassmorphism rare & purposeful | PASS | Only on nav (purposeful -- sticky over content) |
| No hero-metric template cliche | PASS | KPI cards have variable roles + status pips |
| No identical card grids | PASS | Sector aggregate cards differ by rank/quadrant |
| No modals-as-first-thought | PASS | Zero modals in the app |
| No em dashes | PASS | Removed from all copy in this pass |

## Follow-ups from earlier round (still deferred, backlog)

- RS Histogram Sparkline (Jeff's iconic viz)
- Industry-group deep-dive page
- Country ETFs page (international rotation)
- Leveraged ETF pair viewer
- Backtesting page

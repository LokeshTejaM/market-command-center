# GOAL: Ship a production-grade momentum dashboard end-to-end

**Owner:** nancy (code-puppy)
**Repo:** https://github.com/LokeshTejaM/market-command-center
**Live URL:** https://lokeshtejam.github.io/market-command-center/

## Definition of done

- [x] Real S&P 500 data flowing daily via GitHub Actions
- [ ] Sector Rotation page renders with real data (blocked: NaN in JSON)
- [ ] Info tooltips visible and readable on every plot
- [ ] Watchlist page with localStorage (original MVP ask)
- [ ] Manual refresh button that triggers `workflow_dispatch` via GH API
- [ ] Industry-group ETFs added (Jeff Sun's structure)
- [ ] Jeff Sun's `RS_Strength %` column (self-percentile) alongside cross-sectional rank
- [ ] EW variant shown on RRG (Jeff prefers EW over CW)
- [ ] ATR (volatility) column for position sizing
- [ ] README fully updated with all features
- [ ] All commits pushed to `main`, live URL reflects everything

## Bugs to fix first

- [ ] **BLOCKER:** `data/rs_ranks.json` contains literal `NaN` (invalid JSON, browser refuses to parse). Root cause: `df.to_dict('records')` produces Python `float('nan')` which `json.dumps` writes as `NaN`. Fix: sanitize before serialize; add unit test.
- [ ] **Info icons not visible:** likely a rendering-order casualty of bug 1, but verify by loading with real data.

## Sequence

1. Hotfix `data/rs_ranks.json` in the repo (sed `NaN` → `null`) so dashboard un-bricks immediately
2. Fix pipeline sanitizer + add regression test
3. Verify info icons render + hover works
4. Watchlist page (localStorage)
5. Manual refresh button (workflow_dispatch via GH API)
6. Industry-group ETFs (add to `etfs.py`)
7. Jeff's `RS_Strength %` column (add to `compute.py`, render in table)
8. EW variant on RRG (already computed, just need to render distinct marker)
9. ATR column (add to `compute.py`, render in table)
10. README + final polish
11. Push, watch pipeline succeed, verify live site

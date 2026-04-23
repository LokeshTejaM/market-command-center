# Market Command Center 📊

A unified, extensible dashboard platform combining multiple market analysis tools into a single professional interface.

## Current Dashboards

| Dashboard | Description | Data Source |
|---|---|---|
| **Market Breadth** | StockBee breadth monitor with regime analysis, KPI cards, 7 interactive charts, and data reference table | Google Sheets (GVIZ) |
| **Sector Rotation** | Relative Strength vs SPY with percentile rankings, sparklines, signal detection | Yahoo Finance API |

## Architecture

**Plugin-based registry pattern** — each dashboard is a self-contained module that registers itself. The shell auto-generates navigation and manages lifecycle.

```
market-command-center/
├── index.html                # Shell — nav + viewport
├── css/
│   ├── core.css              # Design tokens, nav, shared components
│   └── dashboards/
│       ├── breadth.css       # Breadth-specific styles
│       └── sector.css        # Sector-specific styles
├── js/
│   ├── shared.js             # Common utilities
│   ├── registry.js           # Dashboard registry + router
│   └── dashboards/
│       ├── breadth.js        # StockBee breadth module
│       └── sector.js         # Sector rotation module
```

## Adding a New Dashboard

1. Create `js/dashboards/my-dashboard.js`:
```js
DashboardRegistry.register({
    id: 'my-dashboard',
    name: 'My Dashboard',
    icon: '⭐',
    order: 3,
    init(container) { /* build DOM, fetch data */ },
    activate() { /* resume timers */ },
    deactivate() { /* pause timers */ },
    destroy() { /* cleanup */ },
});
```

2. Create `css/dashboards/my-dashboard.css` (scope under `#view-my-dashboard`)

3. Add to `index.html`:
```html
<link rel="stylesheet" href="css/dashboards/my-dashboard.css">
<script src="js/dashboards/my-dashboard.js"></script>
```

No other files need to change. The tab appears automatically.

## Deploy

Static site — deploy anywhere (GitHub Pages, Netlify, etc). No build step required.

## Credits

- Market Breadth: [StockBee Monitor](https://stockbee.blogspot.com/)
- Sector Rotation: Inspired by [@jfsrev](https://x.com/jfsrev) (Jeff Sun, CFTe)
- For educational purposes only. Not financial advice.

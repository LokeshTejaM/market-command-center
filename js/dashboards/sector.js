/* ============================================================
   SECTOR ROTATION DASHBOARD — Registry Module
   Yahoo Finance → RS Ratio → Percentile Rank → Signals
   Inspired by @jfsrev (Jeff Sun, CFTe)
   ============================================================ */

DashboardRegistry.register({
    id: 'sector',
    name: 'Sector Rotation',
    icon: '🔄',
    order: 2,

    _state: { data: [], filter: 'all', sort: 'rs_strength_desc', timer: null },

    // ── Ticker Universe ──────────────────────────────────────
    _TICKERS: [
        // Indices
        ...'SPY,S&P 500 ETF;RSP,S&P 500 EW;QQQ,Nasdaq 100;QQQE,Nasdaq 100 EW;IWM,Russell 2000;FFTY,IBD 50'
            .split(';').map(s => { const [t,n] = s.split(','); return { ticker: t, name: n, category: 'indices' }; }),
        // EW Sectors
        ...'RSPT,EW Technology;RSPD,EW Consumer Disc;RSPC,EW Comm Svcs;RSPF,EW Financials;RSPS,EW Consumer Staples;RSPH,EW Healthcare;RSPN,EW Industrials;RSPG,EW Energy;RSPU,EW Utilities;RSPM,EW Materials;RSPR,EW Real Estate'
            .split(';').map(s => { const [t,n] = s.split(','); return { ticker: t, name: n, category: 'sectors' }; }),
        // CW Sectors
        ...'XLK,Technology;XLY,Consumer Disc;XLC,Comm Services;XLF,Financials;XLP,Consumer Staples;XLV,Healthcare;XLI,Industrials;XLE,Energy;XLU,Utilities;XLB,Materials;XLRE,Real Estate'
            .split(';').map(s => { const [t,n] = s.split(','); return { ticker: t, name: n, category: 'cap_sectors' }; }),
        // Industry Groups
        ...'XSD,Semiconductors;XSW,Software & Svcs;KIE,Insurance;GDX,Gold Miners;XHB,Homebuilders;XRT,Retail;CIBR,Cybersecurity;XBI,Biotech;KRE,Regional Banks;KBE,US Banks;KCE,Capital Markets;WCLD,Cloud Computing;DRIV,Autonomous & EV;PAVE,Infrastructure;ROBO,Robotics;IPAY,Mobile Payments;XOP,Oil & Gas E&P;XME,Metals & Mining;JETS,Airlines;XAR,Aerospace & Defense;XTN,Transportation;XHS,Healthcare Svcs;XHE,Healthcare Equip;XPH,Pharmaceuticals;PBJ,Food & Beverage;IBUY,Online Retail;PEJ,Leisure & Entmt;XTL,Telecom;USO,US Oil;FCG,Natural Gas;XES,Oil & Gas Equip;GNR,Natural Resources;COPX,Copper Miners;SLX,Steel;MOO,Agribusiness;PBW,Clean Energy;BLOK,Blockchain;GBTC,Bitcoin Trust;BUZZ,Social Sentiment;FXI,China Large Cap;GXC,China'
            .split(';').map(s => { const [t,n] = s.split(','); return { ticker: t, name: n, category: 'industry' }; }),
        // Stocks
        ...'NVDA,NVIDIA;TSLA,Tesla;COIN,Coinbase;BABA,Alibaba;MSTR,MicroStrategy;PLTR,Palantir;AVGO,Broadcom;NFLX,Netflix;CRWD,CrowdStrike;HOOD,Robinhood;RBRK,Rubrik;TMDX,TransMedics'
            .split(';').map(s => { const [t,n] = s.split(','); return { ticker: t, name: n, category: 'leaders' }; }),
    ],

    _BENCHMARKS: ['SPY', 'RSP', 'QQQ', 'IWM', 'RSPT', 'XSD'],
    _RS_WINDOW: 25,

    init(container) {
        container.innerHTML = this._template();
        this._bindEvents(container);
        this._loadDashboard(container);
    },

    activate() {
        if (!this._state.timer) {
            this._state.timer = setInterval(() => {
                if (Shared.isMarketOpen()) {
                    const el = document.getElementById('view-sector');
                    if (el) this._loadDashboard(el, true);
                }
            }, 5 * 60 * 1000);
        }
    },

    deactivate() {
        if (this._state.timer) { clearInterval(this._state.timer); this._state.timer = null; }
    },

    destroy() { this.deactivate(); },

    // ─── HTML Template ───────────────────────────────────────
    _template() {
        return `
            <div class="benchmark-bar" id="s-benchmarks"></div>
            <div class="controls-bar">
                <div class="filter-group" id="s-filters">
                    <button class="filter-btn active" data-filter="all">All</button>
                    <button class="filter-btn" data-filter="indices">Indices</button>
                    <button class="filter-btn" data-filter="sectors">EW Sectors</button>
                    <button class="filter-btn" data-filter="cap_sectors">CW Sectors</button>
                    <button class="filter-btn" data-filter="industry">Industry Grps</button>
                    <button class="filter-btn" data-filter="leaders">Stocks</button>
                </div>
                <div class="sort-group">
                    <label class="sort-label">Sort by</label>
                    <select id="s-sort" class="sort-select">
                        <option value="rs_strength_desc">RS_STS % \u2193</option>
                        <option value="rs_strength_asc">RS_STS % \u2191</option>
                        <option value="change_desc">Day Change \u2193</option>
                        <option value="change_asc">Day Change \u2191</option>
                        <option value="name_asc">Name A-Z</option>
                    </select>
                </div>
            </div>
            <div class="signal-summary" id="s-signals"></div>
            <div class="table-container"><div class="table-wrapper">
                <table><thead><tr>
                    <th class="col-rank">#</th><th>Ticker</th><th>Name</th><th>Category</th>
                    <th>Price</th><th>Day Chg%</th><th>RS Ratio</th><th>RS Trend (25d)</th>
                    <th>RS_STS %</th><th>Signal</th>
                </tr></thead><tbody id="s-tbody"></tbody></table>
            </div></div>
            <footer class="dashboard-footer">
                <div>
                    <span>Inspired by <a href="https://x.com/jfsrev" target="_blank" rel="noopener">@jfsrev</a> (Jeff Sun, CFTe)</span>
                    <span class="footer-sep">\u00b7</span>
                    <span>RS = Ticker / SPY</span>
                    <span class="footer-sep">\u00b7</span>
                    <span>RS_STS % = Percentile rank over 25 days</span>
                </div>
                <div><span>For educational purposes only. Not financial advice.</span></div>
            </footer>`;
    },

    // ─── Events ──────────────────────────────────────────────
    _bindEvents(container) {
        container.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._state.filter = btn.dataset.filter;
                this._renderTable();
            });
        });
        document.getElementById('s-sort').addEventListener('change', (e) => {
            this._state.sort = e.target.value;
            this._renderTable();
        });
    },

    // ─── Data Fetching ───────────────────────────────────────
    async _loadDashboard(container, isRefresh = false) {
        if (!isRefresh) {
            Shared.showLoading(container, 'Fetching market data...');
            this._showSkeleton();
        }
        try {
            const raw = await this._fetchAll();
            if (!raw.length) { Shared.showToast('No data received.', 'error'); return; }
            this._state.data = this._processData(raw);
            this._renderBenchmarks();
            this._renderSignals();
            this._renderTable();
            if (isRefresh) Shared.showToast('Dashboard refreshed', 'success');
        } catch (err) {
            Shared.showToast(`Error: ${err.message}`, 'error');
        } finally {
            Shared.hideLoading(container);
        }
    },

    async _fetchTicker(ticker) {
        const url = `https://corsproxy.io/?url=${encodeURIComponent(
            `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=3mo&interval=1d&includePrePost=false`
        )}`;
        try {
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const json = await resp.json();
            const result = json.chart?.result?.[0];
            if (!result) throw new Error('No data');
            const ts = result.timestamp || [], closes = result.indicators?.quote?.[0]?.close || [];
            const history = [];
            for (let i = 0; i < ts.length; i++) {
                if (closes[i] != null) history.push({ date: new Date(ts[i] * 1000), close: closes[i] });
            }
            const meta = result.meta || {};
            return { ticker, history, currentPrice: meta.regularMarketPrice || history[history.length - 1]?.close, previousClose: meta.chartPreviousClose || meta.previousClose };
        } catch (err) {
            console.warn(`Failed: ${ticker}:`, err.message);
            return null;
        }
    },

    async _fetchAll() {
        const results = [], tickers = this._TICKERS.map(t => t.ticker);
        for (let i = 0; i < tickers.length; i += 10) {
            const batch = tickers.slice(i, i + 10);
            const batchResults = await Promise.all(batch.map(t => this._fetchTicker(t)));
            results.push(...batchResults);
            if (i + 10 < tickers.length) await new Promise(r => setTimeout(r, 500));
        }
        return results.filter(Boolean);
    },

    // ─── Data Processing ─────────────────────────────────────
    _processData(raw) {
        const spyData = raw.find(d => d.ticker === 'SPY');
        if (!spyData) { Shared.showToast('SPY data unavailable.', 'error'); return []; }
        const spyByDate = {};
        spyData.history.forEach(h => { spyByDate[h.date.toISOString().slice(0, 10)] = h.close; });

        return raw.map(r => {
            const meta = this._TICKERS.find(t => t.ticker === r.ticker);
            if (!meta) return null;
            const rsHistory = [];
            r.history.forEach(h => {
                const spy = spyByDate[h.date.toISOString().slice(0, 10)];
                if (spy && spy > 0) rsHistory.push({ date: h.date, rs: h.close / spy });
            });
            const recent = rsHistory.slice(-this._RS_WINDOW);
            const currentRS = recent.length ? recent[recent.length - 1].rs : null;
            const rsValues = recent.map(x => x.rs);
            const rsStrength = currentRS != null ? this._percentileRank(rsValues, currentRS) : null;
            const prevRS = recent.length >= 2 ? recent[recent.length - 2].rs : currentRS;
            const rsChange = currentRS && prevRS ? ((currentRS - prevRS) / prevRS) * 100 : 0;
            const dayChange = r.currentPrice && r.previousClose ? ((r.currentPrice - r.previousClose) / r.previousClose) * 100 : 0;

            return { ...meta, currentPrice: r.currentPrice, dayChange, rsRatio: currentRS, rsHistory: recent.map(x => x.rs), rsStrength, rsChange, signal: this._signal(rsStrength, rsChange) };
        }).filter(Boolean);
    },

    _percentileRank(arr, val) {
        if (!arr || arr.length < 2) return 50;
        const sorted = [...arr].sort((a, b) => a - b);
        let below = 0;
        for (const v of sorted) { if (v < val) below++; }
        return Math.round((below / (sorted.length - 1)) * 100);
    },

    _signal(str, chg) {
        if (str >= 85) return { label: '\ud83d\udd25 Hot', cls: 'hot' };
        if (str >= 70) return { label: '\u25b2 Strong', cls: 'warm' };
        if (str >= 40 && str < 70 && chg > 0) return { label: '\u2197 Rising', cls: 'rising' };
        if (str >= 30 && str < 70) return { label: '\u2014 Neutral', cls: 'neutral' };
        if (str >= 15) return { label: '\u25bc Weak', cls: 'weak' };
        return { label: '\u2744 Cold', cls: 'cold' };
    },

    _strengthColor(pct) {
        if (pct >= 80) return '#10b981';
        if (pct >= 60) return '#22c55e';
        if (pct >= 40) return '#eab308';
        if (pct >= 20) return '#f97316';
        return '#ef4444';
    },

    _rsCellStyle(pct) {
        if (pct == null) return '';
        const op = (pct / 100) * 0.65;
        const g = Math.round(163 + (pct / 100) * 34);
        const text = pct >= 60 ? '#f1f5f9' : pct >= 30 ? '#d1fae5' : '#94a3b8';
        return `background:rgba(22,${g},74,${op.toFixed(3)});color:${text}`;
    },

    // ─── Rendering ───────────────────────────────────────────
    _renderBenchmarks() {
        const el = document.getElementById('s-benchmarks');
        el.innerHTML = this._BENCHMARKS.map(t => {
            const d = this._state.data.find(x => x.ticker === t);
            if (!d) return '';
            const cls = d.dayChange >= 0 ? 'positive' : 'negative';
            return `<div class="benchmark-card ${cls}">
                <div class="benchmark-ticker">${d.ticker}</div>
                <div class="benchmark-price">${Shared.formatPrice(d.currentPrice)}</div>
                <div class="benchmark-change ${cls}">${Shared.formatChange(d.dayChange)}</div>
            </div>`;
        }).join('');
    },

    _renderSignals() {
        const data = this._state.data.filter(d => d.ticker !== 'SPY');
        const hot = data.filter(d => d.rsStrength >= 85);
        const cold = data.filter(d => d.rsStrength < 20);
        const rising = data.filter(d => d.rsChange > 0 && d.rsStrength >= 40 && d.rsStrength < 70);
        const avg = data.length ? Math.round(data.reduce((s, d) => s + (d.rsStrength || 0), 0) / data.length) : 0;
        const top = this._state.data.filter(d => d.category === 'sectors').sort((a, b) => (b.rsStrength || 0) - (a.rsStrength || 0))[0];

        const card = (icon, title, val, color, detail) =>
            `<div class="signal-card"><div class="signal-card-header">${icon} ${title}</div>
            <div class="signal-card-value" style="color:${color || 'inherit'}">${val}</div>
            <div class="signal-card-detail">${detail}</div></div>`;

        document.getElementById('s-signals').innerHTML = [
            card('\ud83d\udd25', 'Hot Sectors', hot.length, '#10b981', hot.slice(0, 3).map(h => h.ticker).join(', ') || 'None'),
            card('\ud83d\udcca', 'Avg RS Strength', avg + '%', this._strengthColor(avg), `Across ${data.length} assets`),
            card('\ud83c\udfc6', 'Top EW Sector', top?.ticker || '\u2014', '', top ? `${top.name} \u2014 ${top.rsStrength}%` : ''),
            card('\u2744\ufe0f', 'Cold Assets', cold.length, '#ef4444', cold.slice(0, 3).map(h => h.ticker).join(', ') || 'None'),
            card('\u2197\ufe0f', 'Rising', rising.length, '#0ea5e9', rising.slice(0, 3).map(h => h.ticker).join(', ') || 'None'),
        ].join('');
    },

    _renderTable() {
        const data = this._state.data;
        let filtered = this._state.filter === 'all' ? data : data.filter(d => d.category === this._state.filter);

        // Sort
        const copy = [...filtered];
        const sk = this._state.sort;
        if (sk === 'rs_strength_desc') copy.sort((a, b) => (b.rsStrength || 0) - (a.rsStrength || 0));
        else if (sk === 'rs_strength_asc') copy.sort((a, b) => (a.rsStrength || 0) - (b.rsStrength || 0));
        else if (sk === 'change_desc') copy.sort((a, b) => (b.dayChange || 0) - (a.dayChange || 0));
        else if (sk === 'change_asc') copy.sort((a, b) => (a.dayChange || 0) - (b.dayChange || 0));
        else if (sk === 'name_asc') copy.sort((a, b) => a.name.localeCompare(b.name));

        const catLabels = { indices: 'indices', sectors: 'sectors', cap_sectors: 'cw sectors', industry: 'industry', leaders: 'leaders' };

        document.getElementById('s-tbody').innerHTML = copy.map((d, i) => {
            const chgCls = d.dayChange >= 0.01 ? 'positive' : d.dayChange <= -0.01 ? 'negative' : '';
            const isSPY = d.ticker === 'SPY';
            const stsHtml = isSPY ? '<div class="rs-sts-cell is-spy">ref</div>'
                : d.rsStrength != null ? `<div class="rs-sts-cell" style="${this._rsCellStyle(d.rsStrength)}">${d.rsStrength}%</div>`
                : '<div class="rs-sts-cell">\u2014</div>';

            return `<tr>
                <td class="col-rank">${i + 1}</td>
                <td><span class="ticker-text">${d.ticker}</span></td>
                <td class="col-name">${d.name}</td>
                <td><span class="category-badge ${d.category}">${catLabels[d.category] || d.category}</span></td>
                <td>${Shared.formatPrice(d.currentPrice)}</td>
                <td class="${chgCls}">${Shared.formatChange(d.dayChange)}</td>
                <td>${d.rsRatio != null ? d.rsRatio.toFixed(4) : '\u2014'}</td>
                <td>${this._sparkline(d.rsHistory)}</td>
                <td>${stsHtml}</td>
                <td><span class="signal-badge ${d.signal.cls}">${d.signal.label}</span></td>
            </tr>`;
        }).join('');
    },

    _sparkline(rs) {
        if (!rs || rs.length < 2) return '<div class="sparkline-container">\u2014</div>';
        const min = Math.min(...rs), max = Math.max(...rs), range = max - min || 1;
        return '<div class="sparkline-container">' + rs.map((v, i) => {
            const h = Math.max(4, ((v - min) / range) * 100 * 0.28 + 4);
            const color = i > 0 && v >= rs[i - 1] ? 'rgba(16,185,129,0.7)' : 'rgba(239,68,68,0.5)';
            const op = i === rs.length - 1 ? '1' : '0.7';
            return `<div class="sparkline-bar" style="height:${h}px;background:${color};opacity:${op}"></div>`;
        }).join('') + '</div>';
    },

    _showSkeleton() {
        const tbody = document.getElementById('s-tbody');
        if (!tbody) return;
        tbody.innerHTML = Array.from({ length: 12 }, () => `<tr>${
            '<td><div class="skeleton" style="width:30px;height:14px"></div></td>'.repeat(10)
        }</tr>`).join('');
    },
});

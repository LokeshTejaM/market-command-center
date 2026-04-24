/* ============================================================
   STOCKBEE MARKET BREADTH DASHBOARD — Registry Module
   Fetches Google Sheets data → analysis engine → 7 charts + KPIs
   ============================================================ */

DashboardRegistry.register({
    id: 'breadth',
    name: 'Market Breadth',
    icon: '📊',
    order: 1,

    _state: { year: '2026', data: [], charts: {}, timer: null },

    init(container) {
        container.innerHTML = this._template();
        this._bindEvents(container);
        this._loadData(container);
    },

    activate() {
        if (!this._state.timer) {
            this._state.timer = setInterval(() => {
                const el = document.getElementById('view-breadth');
                if (el) this._loadData(el);
            }, 5 * 60 * 1000);
        }
    },

    deactivate() {
        if (this._state.timer) { clearInterval(this._state.timer); this._state.timer = null; }
    },

    destroy() {
        this.deactivate();
        Object.values(this._state.charts).forEach(c => c.destroy());
        this._state.charts = {};
    },

    // ─── HTML Template ───────────────────────────────────────
    _template() {
        const chartCard = (id, title, badge, wide = false) =>
            `<div class="chart-card${wide ? ' chart-wide' : ''}">
                <div class="chart-header"><h3>${title}</h3><span class="chart-badge">${badge}</span></div>
                <div class="chart-container"><canvas id="bc-${id}"></canvas></div>
            </div>`;

        const kpi = (id, label, sub) =>
            `<div class="kpi-card" id="bkpi-${id}">
                <div class="kpi-label">${label}</div>
                <div class="kpi-value" id="bkpi-${id}-val">\u2014</div>
                <div class="kpi-sub">${sub}</div>
            </div>`;

        return `
            <div class="sub-nav">
                <div class="sub-tabs">
                    <button class="sub-tab active" data-subpage="dashboard">Dashboard</button>
                    <button class="sub-tab" data-subpage="data">Data Reference</button>
                </div>
                <div class="sub-controls">
                    <div class="year-selector">
                        <label>Year:</label>
                        <select id="b-year-select">
                            <option value="2026" selected>2026</option>
                            <option value="2025">2025</option>
                            <option value="2024">2024</option>
                            <option value="2023">2023</option>
                        </select>
                    </div>
                    <div class="live-indicator"><span class="live-dot"></span> Live</div>
                </div>
            </div>
            <div id="b-error" class="error-banner hidden"><span>\u26a0</span><span id="b-error-msg">Error</span><button class="btn-retry" id="b-retry">Retry</button></div>
            <div class="sub-page active" id="b-dashboard-page">
                <div class="section-head"><h2>Market Regime</h2><p>Current breadth posture and action bias</p></div>
                <div class="regime-banner" id="b-regime">
                    <div class="regime-label" id="b-regime-label">LOADING</div>
                    <span class="regime-sub" id="b-regime-sub">Analyzing...</span>
                    <p class="regime-text" id="b-regime-text">Fetching data from StockBee Monitor...</p>
                    <div class="regime-pills" id="b-regime-pills"></div>
                </div>
                <div class="section-head"><h2>Key Metrics</h2><p>At-a-glance breadth diagnostics</p></div>
                <div class="kpi-grid">
                    ${kpi('t2108', 'T2108', '% above 40d MA')}
                    ${kpi('r5', '5-Day Ratio', 'Up/Down momentum')}
                    ${kpi('r10', '10-Day Ratio', 'Trend confirmation')}
                    ${kpi('up4', 'Up 4%+ Today', 'Momentum bursts')}
                    ${kpi('dn4', 'Down 4%+ Today', 'Selling pressure')}
                    ${kpi('qup', 'Qtr Leaders', 'Up 25%+ / quarter')}
                    ${kpi('qdn', 'Qtr Losers', 'Down 25%+ / quarter')}
                    ${kpi('sp', 'S&P 500', 'Index level')}
                </div>
                <div class="section-head"><h2>Trend Charts</h2><p>Daily momentum, structure, and risk zones</p></div>
                <div class="charts-grid">
                    ${chartCard('updown', 'Stocks Up 4%+ vs Down 4%+ Daily', 'Primary Breadth', true)}
                    ${chartCard('ratio', '5-Day & 10-Day Ratio', 'Momentum Signal')}
                    ${chartCard('qtr', 'Quarterly Momentum (Up vs Down 25%)', 'Structural Health')}
                    ${chartCard('t2108', 'T2108 \u2014 % Above 40-Day MA', 'Market Oscillator')}
                    ${chartCard('sp500', 'S&P 500', 'Benchmark')}
                    ${chartCard('monthly', 'Monthly Momentum (Up vs Down 25%/Month)', 'Secondary Breadth')}
                    ${chartCard('streak', '34-Day Streaks (Up vs Down 13%)', 'Persistence')}
                </div>
            </div>
            <div class="sub-page" id="b-data-page">
                <div class="section-head"><h2>Reference Data</h2><p>Raw breadth series used by the dashboard</p></div>
                <div class="data-header"><h2>\ud83d\udccb Complete Breadth Data Reference</h2>
                    <p class="data-subtitle">Color-coded raw data \u2014 <span id="b-row-count">0</span> trading days</p>
                </div>
                <div class="data-table-wrapper"><div class="table-scroll">
                    <table><thead><tr>
                        <th>Date</th><th>Up 4%+</th><th>Down 4%+</th><th>5d Ratio</th><th>10d Ratio</th>
                        <th>Qtr Up 25%</th><th>Qtr Dn 25%</th><th>Mo Up 25%</th><th>Mo Dn 25%</th>
                        <th>Mo Up 50%</th><th>Mo Dn 50%</th><th>34d Up 13%</th><th>34d Dn 13%</th>
                        <th>Universe</th><th>T2108</th><th>S&P 500</th>
                    </tr></thead><tbody id="b-table-body"></tbody></table>
                </div></div>
                <div class="data-legend"><h3>Color Legend</h3>
                    <div class="legend-items">
                        <div class="legend-item"><span class="legend-color bullish"></span> Bullish</div>
                        <div class="legend-item"><span class="legend-color caution"></span> Caution</div>
                        <div class="legend-item"><span class="legend-color bearish"></span> Bearish</div>
                        <div class="legend-item"><span class="legend-color extreme"></span> Extreme</div>
                    </div>
                </div>
            </div>`;
    },

    // ─── Event Binding ───────────────────────────────────────
    _bindEvents(container) {
        container.querySelectorAll('.sub-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                container.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                container.querySelectorAll('.sub-page').forEach(p => p.classList.remove('active'));
                document.getElementById(`b-${tab.dataset.subpage}-page`).classList.add('active');
            });
        });
        document.getElementById('b-year-select').addEventListener('change', (e) => {
            this._state.year = e.target.value;
            this._loadData(container);
        });
        document.getElementById('b-retry').addEventListener('click', () => this._loadData(container));
    },

    // ─── Data Layer ──────────────────────────────────────────
    async _loadData(container) {
        Shared.showLoading(container, 'Fetching market breadth data...');
        const errEl = document.getElementById('b-error');
        errEl.classList.add('hidden');

        try {
            const data = await this._fetchSheet(this._state.year);
            if (!data.length) throw new Error('No data found.');
            this._state.data = data;
            const analysis = this._analyze(data);
            this._renderRegime(analysis);
            this._renderKPIs(analysis);
            this._renderAllCharts(data);
            this._renderTable(data);
        } catch (err) {
            errEl.classList.remove('hidden');
            document.getElementById('b-error-msg').textContent = `Unable to fetch data: ${err.message}`;
        } finally {
            Shared.hideLoading(container);
        }
    },

    async _fetchSheet(sheetName) {
        const SHEET_ID = '1O6OhS7ciA8zwfycBfGPbP2fWJnR0pn2UUvFZVDP9jpE';
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const text = await resp.text();
        const match = text.match(/google\.visualization\.Query\.setResponse\((\{[\s\S]*\})\);?\s*$/);
        if (!match) throw new Error('Unexpected format');
        const json = JSON.parse(match[1]);
        if (json.status === 'error') throw new Error(json.errors?.[0]?.message || 'Sheet error');
        return this._parseTable(json.table);
    },

    _parseTable(table) {
        const rows = [];
        for (const row of table.rows) {
            const c = row.c;
            if (!c?.[0]) continue;
            const date = this._parseDate(c[0]?.v);
            if (!date) continue;
            const n = Shared.numVal;
            rows.push({
                date, dateStr: c[0]?.f || Shared.formatDate(date),
                up4: n(c[1]), down4: n(c[2]), ratio5d: n(c[3]), ratio10d: n(c[4]),
                qtrUp25: n(c[5]), qtrDown25: n(c[6]),
                moUp25: n(c[7]), moDown25: n(c[8]), moUp50: n(c[9]), moDown50: n(c[10]),
                streak34Up: n(c[11]), streak34Down: n(c[12]),
                universe: n(c[13]), t2108: n(c[14]), sp500: n(c[15]),
            });
        }
        return rows.sort((a, b) => a.date - b.date);
    },

    _parseDate(val) {
        if (!val) return null;
        if (typeof val === 'string' && val.startsWith('Date(')) {
            const p = val.replace('Date(', '').replace(')', '').split(',').map(Number);
            return new Date(p[0], p[1], p[2]);
        }
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    },

    // ─── Analysis Engine ─────────────────────────────────────
    _analyze(data) {
        if (!data.length) return null;
        const latest = data[data.length - 1];
        const prev = data.length > 1 ? data[data.length - 2] : null;
        const consec = this._consecutive(data);
        const regime = this._regime(latest);
        const qtrGap = (latest.qtrUp25 || 0) - (latest.qtrDown25 || 0);
        const spChange = prev?.sp500 && latest.sp500 ? ((latest.sp500 - prev.sp500) / prev.sp500 * 100) : null;
        return { latest, prev, consec, regime, qtrGap, spChange, totalDays: data.length };
    },

    _consecutive(data) {
        if (data.length < 2) return { count: 0, dir: 'neutral', rCount: 0, rDir: 'stable' };
        let count = 0;
        const dir = data[data.length - 1].up4 > data[data.length - 1].down4 ? 'improving' : 'deteriorating';
        for (let i = data.length - 1; i >= 0; i--) {
            if ((data[i].up4 > data[i].down4 ? 'improving' : 'deteriorating') === dir) count++; else break;
        }
        let rCount = 0, rDir = 'stable';
        for (let i = data.length - 1; i >= 1; i--) {
            const c = data[i].ratio5d, p = data[i - 1].ratio5d;
            if (c == null || p == null) break;
            const d = c > p ? 'rising' : 'falling';
            if (rCount === 0) { rDir = d; rCount = 1; } else if (d === rDir) rCount++; else break;
        }
        return { count, dir, rCount, rDir };
    },

    _regime(l) {
        const t = l.t2108, r = l.ratio5d;
        if (t != null && t < 20) return r != null && r < 0.8
            ? { label: 'SEVERE BREADTH BREAKDOWN', cls: 'regime-extreme-bear', level: 'extreme-bear', color: '#ef4444' }
            : { label: 'OVERSOLD \u2014 BOUNCE WATCH', cls: 'regime-bear', level: 'bear', color: '#ef4444' };
        if (t != null && t < 30) return { label: 'BEARISH \u2014 OVERSOLD ZONE', cls: 'regime-bear', level: 'bear', color: '#ef4444' };
        if (t != null && t < 50) return r != null && r > 1.5
            ? { label: 'RECOVERING \u2014 SELECTIVE', cls: 'regime-caution', level: 'caution', color: '#f59e0b' }
            : { label: 'BEARISH \u2014 TRANSITION ZONE', cls: 'regime-caution', level: 'caution', color: '#f59e0b' };
        if (t != null && t < 70) return r != null && r > 2.0
            ? { label: 'BULLISH \u2014 MOMENTUM ACTIVE', cls: 'regime-bull', level: 'bull', color: '#10b981' }
            : { label: 'NEUTRAL \u2014 SELECTIVE BUYING', cls: 'regime-neutral', level: 'neutral', color: '#8b97b0' };
        if (t != null && t >= 70) return { label: 'OVERBOUGHT \u2014 CAUTION', cls: 'regime-extreme-bull', level: 'extreme-bull', color: '#f59e0b' };
        return { label: 'DATA UNAVAILABLE', cls: 'regime-neutral', level: 'neutral', color: '#8b97b0' };
    },

    _actionSignal(level) {
        const map = {
            'extreme-bear': { text: '\ud83d\uded1 GO TO CASH \u2014 No new longs. Wait for ratio > 2.0 & T2108 > 25.', cls: 'action-cash' },
            'bear':         { text: '\u26a0\ufe0f DEFENSIVE \u2014 Minimal exposure. Watch for breadth thrust.', cls: 'action-cash' },
            'caution':      { text: '\u26a1 SELECTIVE \u2014 Small positions only. Tight stops.', cls: 'action-selective' },
            'bull':         { text: '\u2705 MOMENTUM ON \u2014 Buy breakouts. Full sizing.', cls: 'action-buy' },
            'extreme-bull': { text: '\ud83d\udcca TRIM & TRAIL \u2014 Scale out. Lock gains.', cls: 'action-trim' },
        };
        return map[level] || { text: 'Analyzing...', cls: 'action-selective' };
    },

    // ─── UI Rendering ────────────────────────────────────────
    _renderRegime(a) {
        if (!a) return;
        const banner = document.getElementById('b-regime');
        banner.className = `regime-banner ${a.regime.cls}`;
        document.getElementById('b-regime-label').innerHTML =
            `<span class="pill-dot" style="background:${a.regime.color}"></span> ${a.regime.label}`;
        document.getElementById('b-regime-sub').textContent =
            `${a.latest.dateStr} \u2014 ${a.totalDays} trading days \u00b7 Auto-updates from Google Sheets`;
        document.getElementById('b-regime-text').textContent = this._summaryText(a);

        const action = this._actionSignal(a.regime.level);
        let actionEl = banner.querySelector('.regime-action');
        if (!actionEl) { actionEl = document.createElement('div'); banner.querySelector('.regime-text').insertAdjacentElement('afterend', actionEl); }
        actionEl.className = `regime-action ${action.cls}`;
        actionEl.textContent = action.text;

        const pills = [];
        if (a.latest.t2108 != null) pills.push({ label: `T2108: ${a.latest.t2108.toFixed(1)}`, color: a.latest.t2108 < 20 ? '#ef4444' : a.latest.t2108 > 70 ? '#f59e0b' : '#10b981' });
        if (a.consec.count > 0) pills.push({ label: `${a.consec.count} day${a.consec.count > 1 ? 's' : ''} ${a.consec.dir}`, color: a.consec.dir === 'improving' ? '#10b981' : '#ef4444' });
        if (a.latest.ratio5d != null) { const r = a.latest.ratio5d; pills.push({ label: `5d ratio: ${r.toFixed(2)} (${r >= 2 ? 'green light' : r >= 1 ? 'caution' : 'red light'})`, color: r >= 2 ? '#10b981' : r >= 1 ? '#f59e0b' : '#ef4444' }); }
        if (a.consec.rCount > 1) pills.push({ label: `Ratio ${a.consec.rDir} ${a.consec.rCount} days`, color: a.consec.rDir === 'rising' ? '#10b981' : '#ef4444' });
        document.getElementById('b-regime-pills').innerHTML = pills.map(p => `<span class="regime-pill"><span class="pill-dot" style="background:${p.color}"></span>${p.label}</span>`).join('');
    },

    _summaryText(a) {
        const { latest: l, consec, regime, qtrGap } = a;
        let t = '';
        if (regime.level === 'extreme-bear') t += `Market breadth is in severe breakdown. T2108 at ${l.t2108?.toFixed(1) || '\u2014'}. ${l.down4 || 0} stocks fell 4%+ vs just ${l.up4 || 0} rising. `;
        else if (regime.level === 'bear') t += `Market breadth is bearish. T2108 at ${l.t2108?.toFixed(1) || '\u2014'} suggests oversold conditions. `;
        else if (regime.level === 'caution') t += `Market is in a transition zone. T2108 at ${l.t2108?.toFixed(1) || '\u2014'} \u2014 breadth hasn't confirmed a new uptrend. `;
        else if (regime.level === 'bull') t += `Breadth is healthy for momentum trading. T2108 at ${l.t2108?.toFixed(1) || '\u2014'} with 5-day ratio at ${l.ratio5d?.toFixed(2) || '\u2014'} \u2014 wind at your back. `;
        else if (regime.level === 'extreme-bull') t += `Market breadth is extremely elevated. T2108 at ${l.t2108?.toFixed(1) || '\u2014'} \u2014 guard profits. `;
        t += `Breadth has been ${consec.dir} for ${consec.count} consecutive day${consec.count !== 1 ? 's' : ''}. `;
        if (qtrGap < 0) t += `Quarterly momentum crossover is bearish. `;
        else if (qtrGap > 200) t += `Quarterly momentum favors bulls with ${qtrGap.toLocaleString()} more leaders than losers. `;
        return t;
    },

    _renderKPIs(a) {
        if (!a) return;
        const l = a.latest, p = a.prev;
        const set = (id, val, cls, sub, curr, prev, invert) => {
            const card = document.getElementById(`bkpi-${id}`);
            const valEl = document.getElementById(`bkpi-${id}-val`);
            if (valEl) valEl.textContent = val || '\u2014';
            card.className = `kpi-card kpi-${cls || 'neutral'}`;
            let deltaEl = card.querySelector('.kpi-delta');
            if (curr != null && prev != null) {
                const d = curr - prev;
                if (!deltaEl) { deltaEl = document.createElement('div'); card.appendChild(deltaEl); }
                const arrow = d > 0 ? '\u25b2' : d < 0 ? '\u25bc' : '\u2014';
                const dcls = invert ? (d > 0 ? 'delta-down' : 'delta-up') : (d > 0 ? 'delta-up' : 'delta-down');
                deltaEl.className = `kpi-delta ${dcls}`;
                deltaEl.textContent = `${arrow} ${Math.abs(d).toLocaleString(undefined, { maximumFractionDigits: 2 })} vs prev`;
            }
            if (sub) { const s = card.querySelector('.kpi-sub'); if (s) s.textContent = sub; }
            card.classList.add('flash'); setTimeout(() => card.classList.remove('flash'), 800);
        };
        const clsT = (v) => v == null ? 'neutral' : v < 20 ? 'bearish' : v < 30 ? 'caution' : v > 70 ? 'caution' : 'bullish';
        const clsR = (v) => v == null ? 'neutral' : v >= 2 ? 'bullish' : v >= 1 ? 'caution' : 'bearish';

        set('t2108', l.t2108?.toFixed(1), clsT(l.t2108), null, l.t2108, p?.t2108);
        set('r5', l.ratio5d?.toFixed(2), clsR(l.ratio5d), null, l.ratio5d, p?.ratio5d);
        set('r10', l.ratio10d?.toFixed(2), clsR(l.ratio10d), null, l.ratio10d, p?.ratio10d);
        set('up4', l.up4?.toLocaleString(), l.up4 > 300 ? 'bullish' : l.up4 > 150 ? 'caution' : 'bearish', null, l.up4, p?.up4);
        set('dn4', l.down4?.toLocaleString(), l.down4 > 400 ? 'bearish' : l.down4 > 200 ? 'caution' : 'bullish', null, l.down4, p?.down4, true);
        set('qup', l.qtrUp25?.toLocaleString(), l.qtrUp25 > 1200 ? 'bullish' : l.qtrUp25 > 900 ? 'caution' : 'bearish', null, l.qtrUp25, p?.qtrUp25);
        set('qdn', l.qtrDown25?.toLocaleString(), l.qtrDown25 > 1400 ? 'bearish' : l.qtrDown25 > 1000 ? 'caution' : 'bullish', null, l.qtrDown25, p?.qtrDown25, true);
        const spSub = a.spChange != null ? `${a.spChange >= 0 ? '\u25b2' : '\u25bc'} ${Math.abs(a.spChange).toFixed(2)}%` : 'Index level';
        set('sp', l.sp500?.toLocaleString(undefined, { minimumFractionDigits: 2 }), a.spChange >= 0 ? 'bullish' : 'bearish', spSub, l.sp500, p?.sp500);
    },

    // ─── Chart Factory ───────────────────────────────────────
    _C: { // Colors shorthand (Walmart-aligned)
        green: '#2a8703', greenBg: 'rgba(42,135,3,0.2)', greenFill: 'rgba(42,135,3,0.12)',
        red: '#ea1100', redBg: 'rgba(234,17,0,0.18)', redFill: 'rgba(234,17,0,0.11)',
        cyan: '#3f79ff', cyanFill: 'rgba(63,121,255,0.14)',
        purple: '#7ea8ff', purpleFill: 'rgba(126,168,255,0.12)',
        greenBright: '#49b41a', redBright: '#ff4a3e', amberBright: '#ffc220',
        grid: 'rgba(238,243,251,0.06)', tick: '#8ca0bf', tooltip: 'rgba(11,18,32,0.97)',
    },

    _chartBase() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 520, easing: 'easeOutQuart' },
            interaction: { mode: 'index', intersect: false },
            elements: {
                line: { borderWidth: 2.25, tension: 0.28 },
                point: { radius: 0, hoverRadius: 4 },
                bar: { borderRadius: 4 },
            },
            plugins: {
                tooltip: {
                    backgroundColor: this._C.tooltip,
                    titleColor: '#eef3fb',
                    bodyColor: '#c3d0e4',
                    borderColor: 'rgba(238,243,251,0.14)',
                    borderWidth: 1,
                    cornerRadius: 10,
                    padding: 10,
                    displayColors: true,
                    boxPadding: 5,
                },
                legend: {
                    position: 'top',
                    align: 'start',
                    labels: {
                        color: '#9fb0cb',
                        usePointStyle: true,
                        pointStyle: 'circle',
                        pointStyleWidth: 8,
                        padding: 14,
                        font: { size: 11, weight: '600' },
                    },
                },
            },
            scales: {
                x: {
                    ticks: { color: this._C.tick, font: { size: 10 }, maxRotation: 0, autoSkip: true, autoSkipPadding: 12 },
                    grid: { color: this._C.grid, drawTicks: false },
                    border: { color: this._C.grid },
                },
                y: {
                    ticks: { color: this._C.tick, font: { size: 10 }, maxTicksLimit: 6 },
                    grid: { color: this._C.grid, drawTicks: false },
                    border: { color: this._C.grid },
                },
            },
        };
    },

    _makeChart(canvasId, type, datasets, extraOpts = {}) {
        if (this._state.charts[canvasId]) { this._state.charts[canvasId].destroy(); delete this._state.charts[canvasId]; }
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) return;
        const labels = this._state.data.map(d => `${d.date.getMonth() + 1}/${d.date.getDate()}`);
        const base = this._chartBase();
        const opts = { ...base, ...extraOpts, plugins: { ...base.plugins, ...(extraOpts.plugins || {}) }, scales: { ...base.scales, ...(extraOpts.scales || {}) } };
        this._state.charts[canvasId] = new Chart(ctx, { type, data: { labels, datasets }, options: opts });
    },

    _ds(label, data, color, bg, extra = {}) {
        return { label, data, borderColor: color, backgroundColor: bg, borderWidth: 2, tension: 0.3, pointRadius: 1.5, pointHoverRadius: 5, fill: true, ...extra };
    },

    // ─── Render All 7 Charts ─────────────────────────────────
    _renderAllCharts(data) {
        const C = this._C, d = data;

        // 1. Up/Down 4% bar chart
        this._makeChart('bc-updown', 'bar', [
            { label: 'Up 4%+', data: d.map(r => r.up4), backgroundColor: C.greenBg, borderColor: C.green, borderWidth: 1.5, borderRadius: 3, barPercentage: 0.8, categoryPercentage: 0.85 },
            { label: 'Down 4%+', data: d.map(r => r.down4), backgroundColor: C.redBg, borderColor: C.red, borderWidth: 1.5, borderRadius: 3, barPercentage: 0.8, categoryPercentage: 0.85 },
        ]);

        // 2. Ratio chart with annotation lines
        this._makeChart('bc-ratio', 'line', [
            this._ds('5-Day Ratio', d.map(r => r.ratio5d), C.cyan, C.cyanFill, { borderWidth: 2.5, pointRadius: 2 }),
            this._ds('10-Day Ratio', d.map(r => r.ratio10d), C.purple, C.purpleFill, { borderDash: [4, 3] }),
        ], {
            plugins: { annotation: { annotations: {
                bullLine: { type: 'line', yMin: 2, yMax: 2, borderColor: 'rgba(16,185,129,0.5)', borderWidth: 2, borderDash: [6,4], label: { display: true, content: '\u2705 Bullish \u2265 2.0', position: 'start', backgroundColor: 'rgba(16,185,129,0.18)', color: C.greenBright, font: { size: 10, weight: '600' }, padding: 4 } },
                neutLine: { type: 'line', yMin: 1, yMax: 1, borderColor: 'rgba(245,158,11,0.4)', borderWidth: 1.5, borderDash: [4,4], label: { display: true, content: '\u26a0\ufe0f Neutral = 1.0', position: 'start', backgroundColor: 'rgba(245,158,11,0.15)', color: C.amberBright, font: { size: 10, weight: '600' }, padding: 4 } },
            } } },
            scales: { y: { min: 0, ticks: { color: C.tick, font: { size: 10 } }, grid: { color: C.grid }, border: { color: C.grid } } },
        });

        // 3. Quarterly momentum
        this._makeChart('bc-qtr', 'line', [
            this._ds('Up 25%+ / Quarter (Leaders)', d.map(r => r.qtrUp25), C.greenBright, C.greenFill, { borderWidth: 2.5 }),
            this._ds('Down 25%+ / Quarter (Losers)', d.map(r => r.qtrDown25), C.redBright, C.redFill, { borderWidth: 2.5 }),
        ]);

        // 4. T2108 with zone annotations
        this._makeChart('bc-t2108', 'line', [
            this._ds('T2108', d.map(r => r.t2108), C.cyan, C.cyanFill, { borderWidth: 2.5, pointRadius: 2 }),
        ], {
            plugins: { annotation: { annotations: {
                oversold: { type: 'box', yMin: 0, yMax: 20, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 0, label: { display: true, content: '\ud83d\uded1 Oversold < 20', position: { x: 'start', y: 'center' }, color: 'rgba(248,113,113,0.7)', font: { size: 10, weight: '600' } } },
                overbought: { type: 'box', yMin: 70, yMax: 100, backgroundColor: 'rgba(245,158,11,0.08)', borderWidth: 0, label: { display: true, content: '\u26a0\ufe0f Overbought > 70', position: { x: 'start', y: 'center' }, color: 'rgba(251,191,36,0.7)', font: { size: 10, weight: '600' } } },
                oLine: { type: 'line', yMin: 20, yMax: 20, borderColor: 'rgba(239,68,68,0.35)', borderWidth: 1.5, borderDash: [4,4] },
                obLine: { type: 'line', yMin: 70, yMax: 70, borderColor: 'rgba(245,158,11,0.35)', borderWidth: 1.5, borderDash: [4,4] },
            } } },
            scales: { y: { min: 0, max: 100, ticks: { color: C.tick, font: { size: 10 } }, grid: { color: C.grid }, border: { color: C.grid } } },
        });

        // 5. S&P 500
        const ctx5 = document.getElementById('bc-sp500')?.getContext('2d');
        if (ctx5) {
            const grad = ctx5.createLinearGradient(0, 0, 0, 280);
            grad.addColorStop(0, 'rgba(34,211,238,0.18)'); grad.addColorStop(1, 'rgba(34,211,238,0)');
            this._makeChart('bc-sp500', 'line', [
                this._ds('S&P 500', d.map(r => r.sp500), C.cyan, grad),
            ], { scales: { y: { ticks: { color: C.tick, font: { size: 10 }, callback: v => v.toLocaleString() }, grid: { color: C.grid }, border: { color: C.grid } } } });
        }

        // 6. Monthly momentum
        this._makeChart('bc-monthly', 'bar', [
            { label: 'Up 25%+ / Month', data: d.map(r => r.moUp25), backgroundColor: C.greenBg, borderColor: C.green, borderWidth: 1, borderRadius: 2 },
            { label: 'Down 25%+ / Month', data: d.map(r => r.moDown25), backgroundColor: C.redBg, borderColor: C.red, borderWidth: 1, borderRadius: 2 },
        ]);

        // 7. Streak chart
        this._makeChart('bc-streak', 'line', [
            this._ds('Up 13%+ in 34 Days', d.map(r => r.streak34Up), C.greenBright, C.greenFill),
            this._ds('Down 13%+ in 34 Days', d.map(r => r.streak34Down), C.redBright, C.redFill),
        ]);
    },

    // ─── Data Table ──────────────────────────────────────────
    _renderTable(data) {
        document.getElementById('b-row-count').textContent = data.length;
        const cc = (type, val) => {
            if (val == null) return '';
            const m = { up4: [400,'cell-strong-bull',300,'cell-bull',200,'cell-caution',100,'cell-bear','cell-strong-bear'],
                down4: [500,'cell-strong-bear',300,'cell-bear',200,'cell-caution',100,'cell-bull','cell-strong-bull'],
                t2108: null };
            if (type === 'ratio') return val >= 2.5 ? 'cell-strong-bull' : val >= 2 ? 'cell-bull' : val >= 1 ? 'cell-caution' : val >= 0.7 ? 'cell-bear' : 'cell-strong-bear';
            if (type === 'qtrUp') return val >= 1400 ? 'cell-strong-bull' : val >= 1100 ? 'cell-bull' : val >= 900 ? 'cell-caution' : 'cell-bear';
            if (type === 'qtrDown') return val >= 1500 ? 'cell-strong-bear' : val >= 1200 ? 'cell-bear' : val >= 900 ? 'cell-caution' : 'cell-bull';
            if (type === 't2108') return val < 20 ? 'cell-extreme' : val < 30 ? 'cell-strong-bear' : val < 50 ? 'cell-caution' : val > 70 ? 'cell-extreme' : 'cell-bull';
            const t = m[type]; if (!t) return '';
            for (let i = 0; i < t.length - 1; i += 2) { if (val >= t[i]) return t[i + 1]; }
            return t[t.length - 1];
        };
        const f = Shared.fmt;
        document.getElementById('b-table-body').innerHTML = [...data].reverse().map(r => `<tr>
            <td>${r.dateStr}</td><td class="${cc('up4',r.up4)}">${f(r.up4)}</td><td class="${cc('down4',r.down4)}">${f(r.down4)}</td>
            <td class="${cc('ratio',r.ratio5d)}">${r.ratio5d?.toFixed(2)||'\u2014'}</td><td class="${cc('ratio',r.ratio10d)}">${r.ratio10d?.toFixed(2)||'\u2014'}</td>
            <td class="${cc('qtrUp',r.qtrUp25)}">${f(r.qtrUp25)}</td><td class="${cc('qtrDown',r.qtrDown25)}">${f(r.qtrDown25)}</td>
            <td>${f(r.moUp25)}</td><td>${f(r.moDown25)}</td><td>${f(r.moUp50)}</td><td>${f(r.moDown50)}</td>
            <td>${f(r.streak34Up)}</td><td>${f(r.streak34Down)}</td><td>${f(r.universe)}</td>
            <td class="${cc('t2108',r.t2108)}">${r.t2108?.toFixed(2)||'\u2014'}</td>
            <td>${r.sp500?.toLocaleString(undefined,{minimumFractionDigits:2})||'\u2014'}</td></tr>`).join('');
    },
});

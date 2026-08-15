/* ============================================================
   SECTOR ROTATION DASHBOARD -- v2 (static JSON)
   Loads static JSON produced by pipeline/build_rs_data.py.
   Zero live API calls, zero CORS pain, correct cross-sectional
   RS ranks computed server-side in Python/pandas.

   Data flow:
       GitHub Actions cron -> data/*.json -> this module -> DOM
   ============================================================ */

DashboardRegistry.register({
    id: 'sector',
    name: 'Sector Rotation',
    icon: '\u{1F504}',
    order: 2,

    _state: {
        rs: null,           // rs_ranks.json payload
        sectors: null,      // sectors.json payload
        rrg: null,          // rrg.json payload
        benchmarks: null,   // benchmarks.json payload
        meta: null,         // meta.json payload
        window: 63,         // selected timeframe: 21|63|126|252
        filter: 'all',      // sector-name filter or 'all'
        sort: 'rs_desc',    // sort mode for table
        abortController: null,
        chart: null,        // RRG Chart.js instance
    },

    get _abortSignal() { return this._state.abortController?.signal ?? null; },

    init(container) {
        container.innerHTML = this._template();
        this._bindEvents(container);
        this._loadAll(container);
    },

    activate() { /* no-op: EOD data, no polling */ },

    deactivate() {
        if (this._state.abortController) {
            this._state.abortController.abort();
            this._state.abortController = null;
        }
    },

    destroy() {
        this.deactivate();
        if (this._state.chart) { this._state.chart.destroy(); this._state.chart = null; }
    },

    _template() {
        return `
            <div class="section-head">
                <h2>Sector Rotation</h2>
                <p>Cross-sectional relative strength across the S&amp;P 500 universe. Refreshes each morning via GitHub Actions.</p>
            </div>

            <div class="s-toolbar">
                <div class="s-toolbar-group">
                    <label class="s-label">Timeframe</label>
                    <div class="s-tf-group" id="s-tf-group">
                        <button class="s-tf-btn" data-window="21">21d</button>
                        <button class="s-tf-btn active" data-window="63">63d</button>
                        <button class="s-tf-btn" data-window="126">126d</button>
                        <button class="s-tf-btn" data-window="252">252d</button>
                    </div>
                </div>
                <div class="s-toolbar-group">
                    <label class="s-label">Sort</label>
                    <select id="s-sort" class="s-select">
                        <option value="rs_desc">RS Rank \u2193</option>
                        <option value="rs_asc">RS Rank \u2191</option>
                        <option value="trend_desc">RS Trend \u2193</option>
                        <option value="trend_asc">RS Trend \u2191</option>
                        <option value="day_desc">Day % \u2193</option>
                        <option value="day_asc">Day % \u2191</option>
                        <option value="name_asc">Name A-Z</option>
                    </select>
                </div>
                <div class="s-toolbar-group s-toolbar-right">
                    <span class="s-updated" id="s-updated">Loading\u2026</span>
                    <button class="s-refresh-btn" id="s-refresh">\u21BB Refresh</button>
                </div>
            </div>

            <div id="s-error" class="s-error hidden"></div>

            <div class="section-head">
                <h2>Sector Aggregates ${Shared.infoIcon(
                    'What: Each card is one of the 11 GICS sectors. The BIG number is the MEDIAN cross-sectional RS rank (1\u201399) of all S&P 500 stocks in that sector over the selected timeframe. Higher = more of that sector\u2019s stocks are leading the market. Delta shows how the median moved vs 21 days ago. Top 5 shows the leader tickers in that sector. HOW TO READ: A sector at 70+ with a positive delta is a strong bull thesis. A sector at 30- with a negative delta is where breakdowns and shorts live. Click any card to see every stock in that sector ranked.'
                )}</h2>
                <p>Median RS rank per GICS sector. Click a card to drill into its constituent leaders.</p>
            </div>
            <div class="s-sector-grid" id="s-sector-grid"></div>

            <div class="section-head">
                <h2>Relative Rotation Graph ${Shared.infoIcon(
                    'What: Each dot is a sector ETF (e.g. XLK Technology). X-axis = its current cross-sectional RS rank (1\u201399). Y-axis = its RS trend (rank change over the last ~21 trading days). Quadrants: Leading (top-right) = strong & getting stronger, buy the leaders. Weakening (bottom-right) = still strong but momentum fading, tighten stops. Lagging (bottom-left) = weak & getting weaker, avoid. Improving (top-left) = weak but recovering, watchlist for entries. HOW TO READ: Momentum traders live in the top-right and short from the bottom-left. Sectors rotate clockwise over weeks/months. Click any dot to drill into that sector.'
                )}</h2>
                <p>Position tells you WHERE each sector is; quadrant tells you WHAT to do about it.</p>
            </div>
            <div class="s-rrg-wrapper">
                <div class="s-rrg-canvas-wrap"><canvas id="s-rrg-canvas"></canvas></div>
                <div class="s-rrg-legend">
                    <div class="s-quad s-quad-leading"><b>Leading</b><span>strong &amp; getting stronger</span></div>
                    <div class="s-quad s-quad-weakening"><b>Weakening</b><span>strong but fading</span></div>
                    <div class="s-quad s-quad-improving"><b>Improving</b><span>weak but recovering</span></div>
                    <div class="s-quad s-quad-lagging"><b>Lagging</b><span>weak &amp; getting weaker</span></div>
                </div>
            </div>

            <div class="section-head">
                <h2>Full RS Table (S&amp;P 500 stocks) ${Shared.infoIcon(
                    'What: Every S&P 500 stock ranked by cross-sectional RS rank (1\u201399) over the selected timeframe. RS Rank = percentile of this stock\u2019s N-day return within the S&P 500 return distribution (IBD/Minervini/Bonde convention). RS Trend = today\u2019s rank minus rank from 21 trading days ago (positive = rank is climbing). Quadrant chip is derived from (rank, trend). HOW TO READ: Momentum traders scan for RS \u2265 80 AND positive trend AND recent volume expansion. Use the sector chips to slice the universe; click columnto sort.'
                )}</h2>
                <p>Every stock ranked cross-sectionally. Filter by sector to focus.</p>
            </div>
            <div class="s-filter-group" id="s-filter-group"></div>
            <div class="table-container"><div class="table-wrapper">
                <table>
                    <thead><tr>
                        <th class="col-rank">#</th>
                        <th>Ticker</th>
                        <th>Name</th>
                        <th>Sector</th>
                        <th class="right">Price</th>
                        <th class="right">Day %</th>
                        <th class="right">RS Rank</th>
                        <th class="right">RS Trend</th>
                        <th>Quadrant</th>
                    </tr></thead>
                    <tbody id="s-tbody"></tbody>
                </table>
            </div></div>

            <footer class="dashboard-footer">
                <span>Inspired by <a href="https://x.com/jfsrev" target="_blank" rel="noopener">@jfsrev</a> (Jeff Sun, CFTe) and Pradeep Bonde.</span>
                <span class="footer-sep">\u00B7</span>
                <span>RS = ticker return over N days, ranked cross-sectionally 1-99 across all S&amp;P 500 stocks.</span>
                <span class="footer-sep">\u00B7</span>
                <span>Trend = today's rank minus rank 21 days ago.</span>
            </footer>
        `;
    },

    _bindEvents(container) {
        container.querySelectorAll('.s-tf-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.s-tf-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._state.window = parseInt(btn.dataset.window, 10);
                this._render();
            });
        });
        container.querySelector('#s-sort').addEventListener('change', e => {
            this._state.sort = e.target.value;
            this._renderTable();
        });
        container.querySelector('#s-refresh').addEventListener('click', () => this._loadAll(container));
    },

    async _loadAll(container) {
        if (this._state.abortController) this._state.abortController.abort();
        this._state.abortController = new AbortController();

        Shared.showLoading(container, 'Loading market data\u2026');
        const errEl = container.querySelector('#s-error');
        errEl.classList.add('hidden');
        errEl.textContent = '';

        try {
            const bust = `?t=${Date.now()}`;
            const [meta, rs, sectors, rrg, benchmarks] = await Promise.all([
                Shared.fetchJSON(`data/meta.json${bust}`,       { signal: this._abortSignal }),
                Shared.fetchJSON(`data/rs_ranks.json${bust}`,   { signal: this._abortSignal }),
                Shared.fetchJSON(`data/sectors.json${bust}`,    { signal: this._abortSignal }),
                Shared.fetchJSON(`data/rrg.json${bust}`,        { signal: this._abortSignal }),
                Shared.fetchJSON(`data/benchmarks.json${bust}`, { signal: this._abortSignal }),
            ]);
            this._state.meta = meta;
            this._state.rs = rs;
            this._state.sectors = sectors;
            this._state.rrg = rrg;
            this._state.benchmarks = benchmarks;

            this._render();
        } catch (err) {
            if (err.name === 'AbortError' || this._state.abortController?.signal.aborted) return;
            errEl.textContent = `Unable to load data: ${err.message}. Check that data/*.json exists and the pipeline has run at least once.`;
            errEl.classList.remove('hidden');
        } finally {
            Shared.hideLoading(container);
        }
    },

    _render() {
        this._renderMeta();
        this._renderSectorGrid();
        this._renderRRG();
        this._renderFilterGroup();
        this._renderTable();
    },

    _renderMeta() {
        const meta = this._state.meta;
        if (!meta) return;
        const el = document.getElementById('s-updated');
        const dropped = (meta.universe?.dropped_stocks?.length || 0);
        const sample = meta.sources?.prices?.toLowerCase().includes('sample');
        const badge = sample ? ' <span class="s-sample-badge">SAMPLE DATA</span>' : '';
        el.innerHTML = `Data as of <b>${meta.as_of_date}</b> \u00B7 `
            + `${meta.universe?.sp500_tickers ?? '?'} tickers`
            + (dropped ? ` \u00B7 ${dropped} dropped` : '')
            + badge;
    },

    _renderSectorGrid() {
        const w = this._state.window;
        const rows = (this._state.sectors?.by_window?.[String(w)]) || [];
        const el = document.getElementById('s-sector-grid');
        if (!rows.length) { el.innerHTML = '<em>No sector data.</em>'; return; }

        el.innerHTML = rows.map(r => {
            const rank = r.rs_rank_median != null ? Math.round(r.rs_rank_median) : '\u2014';
            const trend = r.rs_trend_median;
            const trendCls = trend > 0 ? 'positive' : trend < 0 ? 'negative' : '';
            const trendStr = trend == null ? '\u2014' : (trend > 0 ? '+' : '') + Math.round(trend);
            const bg = this._rankColor(r.rs_rank_median);
            const leaders = (r.top_5 || []).slice(0, 5).join(', ');
            return `<div class="s-sector-card" data-sector="${this._escape(r.sector)}"
                        style="--rank-bg:${bg}">
                        <div class="s-sector-name">${this._escape(r.sector)}</div>
                        <div class="s-sector-metrics">
                            <div class="s-metric">
                                <div class="s-metric-label">RS Rank</div>
                                <div class="s-metric-value">${rank}</div>
                            </div>
                            <div class="s-metric">
                                <div class="s-metric-label">Trend (21d)</div>
                                <div class="s-metric-value ${trendCls}">${trendStr}</div>
                            </div>
                            <div class="s-metric">
                                <div class="s-metric-label">N</div>
                                <div class="s-metric-value">${r.n_constituents}</div>
                            </div>
                        </div>
                        <div class="s-sector-leaders" title="${leaders}">${leaders || '\u2014'}</div>
                        <div class="s-sector-drill">click to drill down \u2192</div>
                    </div>`;
        }).join('');

        el.querySelectorAll('.s-sector-card').forEach(card => {
            card.addEventListener('click', () => {
                const sector = card.dataset.sector;
                window.location.hash = `sector-detail?sector=${encodeURIComponent(sector)}`;
            });
        });
    },

    _renderRRG() {
        if (!window.Chart) return;
        const w = this._state.window;
        const rows = (this._state.rrg?.by_window?.[String(w)]) || [];
        // Only CW ETFs on the chart -- EW variants would clutter it.
        const cwRows = rows.filter(r => r.variant === 'CW' && r.rs_rank != null && r.rs_trend != null);

        if (this._state.chart) this._state.chart.destroy();
        const canvas = document.getElementById('s-rrg-canvas');
        if (!canvas) return;

        const points = cwRows.map(r => ({
            x: r.rs_rank,
            y: r.rs_trend,
            label: r.ticker,
            sector: r.sector,
            quadrant: r.quadrant,
        }));
        const colors = points.map(p => this._quadColor(p.quadrant));

        this._state.chart = new Chart(canvas, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Sector ETF',
                    data: points,
                    backgroundColor: colors,
                    borderColor: colors,
                    pointRadius: 9,
                    pointHoverRadius: 12,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                onClick: (evt, els, chart) => {
                    if (!els.length) return;
                    const p = points[els[0].index];
                    window.location.hash = `sector-detail?sector=${encodeURIComponent(p.sector)}`;
                },
                scales: {
                    x: {
                        title: { display: true, text: 'RS Rank (0 = weakest, 99 = strongest)' },
                        min: 0, max: 100,
                        grid: { color: 'rgba(148,163,184,0.15)' },
                    },
                    y: {
                        title: { display: true, text: 'RS Trend (rank change over 21d)' },
                        grid: { color: 'rgba(148,163,184,0.15)' },
                    },
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const p = ctx.raw;
                                return `${p.label} \u00B7 ${p.sector} \u00B7 rank ${p.x}, trend ${p.y} (${p.quadrant})`;
                            },
                        },
                    },
                    annotation: {
                        annotations: {
                            vline: { type: 'line', xMin: 50, xMax: 50,
                                borderColor: 'rgba(148,163,184,0.5)', borderWidth: 1 },
                            hline: { type: 'line', yMin: 0, yMax: 0,
                                borderColor: 'rgba(148,163,184,0.5)', borderWidth: 1 },
                        },
                    },
                },
            },
        });
    },

    _renderFilterGroup() {
        const rows = this._state.sectors?.by_window?.[String(this._state.window)] || [];
        const el = document.getElementById('s-filter-group');
        const buttons = [{ label: 'All', value: 'all' }]
            .concat(rows.map(r => ({ label: r.sector, value: r.sector })));
        el.innerHTML = buttons.map(b =>
            `<button class="s-filter-btn ${this._state.filter === b.value ? 'active' : ''}"
                     data-filter="${this._escape(b.value)}">${this._escape(b.label)}</button>`
        ).join('');
        el.querySelectorAll('.s-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this._state.filter = btn.dataset.filter;
                el.querySelectorAll('.s-filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._renderTable();
            });
        });
    },

    _renderTable() {
        const w = this._state.window;
        const rank_col = `rs_rank_${w}d`;
        const trend_col = `rs_trend_${w}d`;

        let recs = (this._state.rs?.records || []).slice();
        if (this._state.filter !== 'all') {
            recs = recs.filter(r => r.sector === this._state.filter);
        }

        const cmp = {
            rs_desc:    (a, b) => (b[rank_col] ?? -1) - (a[rank_col] ?? -1),
            rs_asc:     (a, b) => (a[rank_col] ?? 100) - (b[rank_col] ?? 100),
            trend_desc: (a, b) => (b[trend_col] ?? -1e9) - (a[trend_col] ?? -1e9),
            trend_asc:  (a, b) => (a[trend_col] ?? 1e9) - (b[trend_col] ?? 1e9),
            day_desc:   (a, b) => (b.day_change_pct ?? -1e9) - (a.day_change_pct ?? -1e9),
            day_asc:    (a, b) => (a.day_change_pct ?? 1e9) - (b.day_change_pct ?? 1e9),
            name_asc:   (a, b) => (a.name || '').localeCompare(b.name || ''),
        }[this._state.sort] || ((a, b) => 0);
        recs.sort(cmp);

        const tbody = document.getElementById('s-tbody');
        tbody.innerHTML = recs.map((r, i) => {
            const rank = r[rank_col];
            const trend = r[trend_col];
            const dayCls = r.day_change_pct > 0 ? 'positive' : r.day_change_pct < 0 ? 'negative' : '';
            const trendCls = trend > 0 ? 'positive' : trend < 0 ? 'negative' : '';
            const quadrant = this._quadrantOf(rank, trend);
            const rankBg = this._rankColor(rank);
            return `<tr>
                <td class="col-rank">${i + 1}</td>
                <td><b class="ticker-text">${r.ticker}</b></td>
                <td class="col-name">${this._escape(r.name || '')}</td>
                <td><span class="s-sector-pill">${this._escape(r.sector || '\u2014')}</span></td>
                <td class="right">${Shared.formatPrice(r.price)}</td>
                <td class="right ${dayCls}">${Shared.formatChange(r.day_change_pct)}</td>
                <td class="right"><span class="s-rank-cell" style="background:${rankBg}">${rank ?? '\u2014'}</span></td>
                <td class="right ${trendCls}">${trend == null ? '\u2014' : (trend > 0 ? '+' : '') + Math.round(trend)}</td>
                <td><span class="s-quad-pill s-quad-${quadrant}">${quadrant}</span></td>
            </tr>`;
        }).join('');
    },

    _quadrantOf(rank, trend) {
        if (rank == null || trend == null) return 'unknown';
        const strong = rank >= 50;
        const rising = trend > 0;
        if (strong && rising) return 'leading';
        if (strong && !rising) return 'weakening';
        if (!strong && rising) return 'improving';
        return 'lagging';
    },

    _quadColor(q) {
        return {
            leading:   '#10b981',
            weakening: '#eab308',
            improving: '#0ea5e9',
            lagging:   '#ef4444',
            unknown:   '#94a3b8',
        }[q] || '#94a3b8';
    },

    _rankColor(rank) {
        if (rank == null) return 'rgba(148,163,184,0.15)';
        const t = Math.max(0, Math.min(99, rank)) / 99;
        const r = Math.round(239 * (1 - t) + 16 * t);
        const g = Math.round(68  * (1 - t) + 185 * t);
        const b = Math.round(68  * (1 - t) + 129 * t);
        return `rgba(${r},${g},${b},0.55)`;
    },

    _escape(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        }[c]));
    },
});

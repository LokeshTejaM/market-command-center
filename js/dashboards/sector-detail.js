/* ============================================================
   SECTOR DETAIL DASHBOARD -- drill-down from Sector Rotation
   Consumes ?sector=<GICS name> from the URL hash.
   Shows constituent leaders + a mini RRG for that sector.
   ============================================================ */

DashboardRegistry.register({
    id: 'sector-detail',
    name: 'Sector Detail',
    icon: '\u{1F50D}',
    order: 3,
    hiddenInNav: true,   // only reachable via drill-down from Sector Rotation

    _state: {
        rs: null,
        meta: null,
        window: 63,
        sector: null,
        abortController: null,
        chart: null,
    },

    get _abortSignal() { return this._state.abortController?.signal ?? null; },

    init(container) {
        container.innerHTML = this._template();
        this._bindEvents(container);
        this._syncFromHash();
        this._loadAll(container);
        // React to hash changes (user clicks a different sector card, etc.)
        window.addEventListener('hashchange', this._onHashChange);
    },

    _onHashChange: null,   // populated below in init via arrow closure

    activate() {
        // Re-sync sector from hash whenever this view is activated
        this._syncFromHash();
        if (this._state.rs) this._render();
        else this._loadAll(document.getElementById('view-sector-detail'));
    },

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
                <button class="s-back-btn" id="sd-back">\u2190 Back to Sector Rotation</button>
                <h2 id="sd-title">Sector Detail</h2>
                <p id="sd-subtitle">Constituent leaders ranked cross-sectionally.</p>
            </div>

            <div class="s-toolbar">
                <div class="s-toolbar-group">
                    <label class="s-label">Timeframe</label>
                    <div class="s-tf-group" id="sd-tf-group">
                        <button class="s-tf-btn" data-window="21">21d</button>
                        <button class="s-tf-btn active" data-window="63">63d</button>
                        <button class="s-tf-btn" data-window="126">126d</button>
                        <button class="s-tf-btn" data-window="252">252d</button>
                    </div>
                </div>
                <div class="s-toolbar-group s-toolbar-right">
                    <span class="s-updated" id="sd-updated">Loading\u2026</span>
                </div>
            </div>

            <div id="sd-error" class="s-error hidden"></div>

            <div class="section-head">
                <h2>Constituent Mini-RRG</h2>
                <p>Each dot is a stock in this sector, positioned by its cross-sectional RS rank and 21d trend.</p>
            </div>
            <div class="s-rrg-wrapper">
                <div class="s-rrg-canvas-wrap"><canvas id="sd-rrg-canvas"></canvas></div>
                <div class="s-rrg-legend">
                    <div class="s-quad s-quad-leading"><b>Leading</b><span>strong &amp; getting stronger</span></div>
                    <div class="s-quad s-quad-weakening"><b>Weakening</b><span>strong but fading</span></div>
                    <div class="s-quad s-quad-improving"><b>Improving</b><span>weak but recovering</span></div>
                    <div class="s-quad s-quad-lagging"><b>Lagging</b><span>weak &amp; getting weaker</span></div>
                </div>
            </div>

            <div class="section-head">
                <h2>Constituent Leaderboard</h2>
                <p>Ranked by cross-sectional RS in the selected timeframe.</p>
            </div>
            <div class="table-container"><div class="table-wrapper">
                <table>
                    <thead><tr>
                        <th class="col-rank">#</th>
                        <th>Ticker</th>
                        <th>Name</th>
                        <th>Industry</th>
                        <th class="right">Price</th>
                        <th class="right">Day %</th>
                        <th class="right">RS Rank</th>
                        <th class="right">RS Trend</th>
                        <th>Quadrant</th>
                    </tr></thead>
                    <tbody id="sd-tbody"></tbody>
                </table>
            </div></div>
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
        container.querySelector('#sd-back').addEventListener('click', () => {
            window.location.hash = 'sector';
        });
        // Bind hashchange with a stable arrow reference so activate() can re-check
        this._onHashChange = () => {
            const prevSector = this._state.sector;
            this._syncFromHash();
            if (this._state.sector !== prevSector) this._render();
        };
        // (Listener attached in init.)
    },

    _syncFromHash() {
        // Hash format: "sector-detail?sector=Information%20Technology"
        const hash = window.location.hash.replace(/^#/, '');
        const [, query] = hash.split('?');
        if (!query) return;
        const params = new URLSearchParams(query);
        const sector = params.get('sector');
        if (sector) this._state.sector = sector;
    },

    async _loadAll(container) {
        if (this._state.abortController) this._state.abortController.abort();
        this._state.abortController = new AbortController();

        Shared.showLoading(container, 'Loading market data\u2026');
        const errEl = container.querySelector('#sd-error');
        errEl.classList.add('hidden');
        errEl.textContent = '';

        try {
            const bust = `?t=${Date.now()}`;
            const [meta, rs] = await Promise.all([
                Shared.fetchJSON(`data/meta.json${bust}`,     { signal: this._abortSignal }),
                Shared.fetchJSON(`data/rs_ranks.json${bust}`, { signal: this._abortSignal }),
            ]);
            this._state.meta = meta;
            this._state.rs = rs;
            this._render();
        } catch (err) {
            if (err.name === 'AbortError' || this._state.abortController?.signal.aborted) return;
            errEl.textContent = `Unable to load data: ${err.message}.`;
            errEl.classList.remove('hidden');
        } finally {
            Shared.hideLoading(container);
        }
    },

    _render() {
        if (!this._state.rs || !this._state.sector) return;
        this._renderMeta();
        this._renderTitle();
        this._renderMiniRRG();
        this._renderTable();
    },

    _renderMeta() {
        const meta = this._state.meta;
        if (!meta) return;
        const el = document.getElementById('sd-updated');
        const sample = meta.sources?.prices?.toLowerCase().includes('sample');
        const badge = sample ? ' <span class="s-sample-badge">SAMPLE DATA</span>' : '';
        el.innerHTML = `Data as of <b>${meta.as_of_date}</b>` + badge;
    },

    _renderTitle() {
        document.getElementById('sd-title').textContent = this._state.sector;
        const w = this._state.window;
        const constituents = (this._state.rs.records || []).filter(r => r.sector === this._state.sector);
        document.getElementById('sd-subtitle').textContent =
            `${constituents.length} constituents. RS ranks are cross-sectional over the full S&P 500 universe (not just this sector).`;
    },

    _renderMiniRRG() {
        if (!window.Chart) return;
        const w = this._state.window;
        const rank_col = `rs_rank_${w}d`;
        const trend_col = `rs_trend_${w}d`;

        const constituents = (this._state.rs.records || [])
            .filter(r => r.sector === this._state.sector)
            .filter(r => r[rank_col] != null && r[trend_col] != null);

        if (this._state.chart) this._state.chart.destroy();
        const canvas = document.getElementById('sd-rrg-canvas');
        if (!canvas) return;

        const points = constituents.map(r => ({
            x: r[rank_col],
            y: r[trend_col],
            label: r.ticker,
            name: r.name,
            quadrant: this._quadrantOf(r[rank_col], r[trend_col]),
        }));
        const colors = points.map(p => this._quadColor(p.quadrant));

        this._state.chart = new Chart(canvas, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Constituent',
                    data: points,
                    backgroundColor: colors,
                    borderColor: colors,
                    pointRadius: 7,
                    pointHoverRadius: 11,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: { display: true, text: 'RS Rank (cross-sectional across S&P 500)' },
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
                                return `${p.label} \u00B7 ${p.name} \u00B7 rank ${p.x}, trend ${p.y} (${p.quadrant})`;
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

    _renderTable() {
        const w = this._state.window;
        const rank_col = `rs_rank_${w}d`;
        const trend_col = `rs_trend_${w}d`;

        const recs = (this._state.rs.records || [])
            .filter(r => r.sector === this._state.sector)
            .sort((a, b) => (b[rank_col] ?? -1) - (a[rank_col] ?? -1));

        const tbody = document.getElementById('sd-tbody');
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
                <td>${this._escape(r.industry || '\u2014')}</td>
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

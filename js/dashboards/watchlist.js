/* =========================================================
   WATCHLIST DASHBOARD

   Shows the tickers the user has starred from anywhere in
   the app (RS table, sector-detail). Client-side only --
   localStorage-backed, survives page reload, private.

   Data source: same data/rs_ranks.json used everywhere else,
   filtered to just the watched tickers.
   ========================================================= */

DashboardRegistry.register({
    id: 'watchlist',
    name: 'Watchlist',
    icon: '\u2b50',
    order: 4,

    _state: { data: null, abortController: null },

    init(container) {
        container.id = 'view-watchlist';
        container.innerHTML = this._template();
        this._bindEvents(container);
        // Auto-refresh when watchlist changes in another tab / another page
        this._onChange = () => this._render();
        window.addEventListener('watchlist-change', this._onChange);
        this._loadAll(container);
    },

    activate() { this._render(); },

    deactivate() {
        if (this._state.abortController) { this._state.abortController.abort(); this._state.abortController = null; }
    },

    destroy() {
        this.deactivate();
        window.removeEventListener('watchlist-change', this._onChange);
    },

    _template() {
        return `
            <div class="s-toolbar">
                <h2 style="margin:0">Watchlist ${Shared.infoIcon(
                    'What: Your personal list of tickers to monitor. Add stars from the Sector Rotation page or the Sector Detail page. Data updates daily via the same pipeline (no separate refresh needed). HOW TO READ: A pre-market checklist for your specific names \\u2014 look at RS Rank (>= 80 to keep watching), RS Trend (positive = still leading), and Day % for early setups. Stored in your browser only, never sent to a server.'
                )}</h2>
                <div class="s-tf-group">
                    <button class="s-tf-btn" data-window="21">21d</button>
                    <button class="s-tf-btn active" data-window="63">63d</button>
                    <button class="s-tf-btn" data-window="126">126d</button>
                    <button class="s-tf-btn" data-window="252">252d</button>
                </div>
                <div class="w-actions">
                    <input type="text" id="w-input" placeholder="Add ticker (e.g. NVDA)" class="w-input" maxlength="10">
                    <button id="w-add" class="s-refresh-btn">+ Add</button>
                    <button id="w-clear" class="s-refresh-btn" title="Remove all tickers">Clear all</button>
                </div>
            </div>

            <div id="w-error" class="s-error hidden"></div>

            <div class="section-head">
                <h2>My Watched Tickers <span id="w-count">(0)</span></h2>
                <p>Everything you\u2019ve starred. Data refreshes automatically each morning; use the star to add/remove.</p>
            </div>

            <div class="table-container" id="w-table-wrap"><div class="table-wrapper">
                <table>
                    <thead><tr>
                        <th></th>
                        <th>Ticker</th>
                        <th>Name</th>
                        <th>Sector</th>
                        <th class="right">Price</th>
                        <th class="right">Day %</th>
                        <th class="right">RS Rank</th>
                        <th class="right">RS Trend</th>
                        <th class="right">RS Str%</th>
                        <th class="right">Vol 20d</th>
                        <th>Quadrant</th>
                    </tr></thead>
                    <tbody id="w-tbody"></tbody>
                </table>
            </div></div>

            <div class="w-empty hidden" id="w-empty">
                <h3>No tickers yet</h3>
                <p>Head to the <b>Sector Rotation</b> page and click the star (\u2606) next to any ticker to add it here.
                Or type a symbol above and hit <b>Add</b>.</p>
            </div>
        `;
    },

    _bindEvents(container) {
        container.querySelectorAll('.s-tf-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.s-tf-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._state.window = parseInt(btn.dataset.window, 10) || 63;
                this._renderTable();
            });
        });
        container.querySelector('#w-add').addEventListener('click', () => this._doAdd());
        container.querySelector('#w-input').addEventListener('keydown', e => { if (e.key === 'Enter') this._doAdd(); });
        container.querySelector('#w-clear').addEventListener('click', () => {
            if (Watchlist.get().length === 0) return;
            if (confirm('Remove ALL tickers from your watchlist? This cannot be undone.')) {
                Watchlist.clear();
            }
        });
    },

    _doAdd() {
        const input = document.getElementById('w-input');
        const val = input.value.trim().toUpperCase();
        if (!val) return;
        Watchlist.add(val);
        input.value = '';
    },

    async _loadAll(container) {
        if (this._state.abortController) this._state.abortController.abort();
        this._state.abortController = new AbortController();
        Shared.showLoading(container, 'Loading market data\u2026');
        const errEl = container.querySelector('#w-error');
        errEl.classList.add('hidden');
        try {
            const bust = `?t=${Date.now()}`;
            const rs = await Shared.fetchJSON(`data/rs_ranks.json${bust}`, { signal: this._state.abortController.signal });
            this._state.data = rs.records;
            this._state.window = this._state.window || 63;
            Shared.hideLoading(container);
            this._render();
        } catch (err) {
            Shared.hideLoading(container);
            if (err.name === 'AbortError') return;
            errEl.textContent = `Unable to load data: ${err.message}. Check that data/*.json exists and the pipeline has run at least once.`;
            errEl.classList.remove('hidden');
        }
    },

    _render() {
        this._renderTable();
    },

    _renderTable() {
        if (!this._state.data) return;
        const watched = Watchlist.get();
        const countEl = document.getElementById('w-count');
        if (countEl) countEl.textContent = `(${watched.length})`;

        const emptyEl = document.getElementById('w-empty');
        const tblEl = document.getElementById('w-table-wrap');
        if (watched.length === 0) {
            emptyEl.classList.remove('hidden');
            tblEl.classList.add('hidden');
            return;
        }
        emptyEl.classList.add('hidden');
        tblEl.classList.remove('hidden');

        const w = this._state.window || 63;
        const rank_col = `rs_rank_${w}d`;
        const trend_col = `rs_trend_${w}d`;
        const byTicker = new Map(this._state.data.map(r => [r.ticker, r]));

        const tbody = document.getElementById('w-tbody');
        tbody.innerHTML = watched.map(ticker => {
            const r = byTicker.get(ticker);
            if (!r) {
                // Ticker exists in watchlist but not in the S&P 500 data (e.g. added by hand).
                return `<tr class="w-row-missing" data-ticker="${ticker}">
                    <td><button class="s-star starred" data-ticker="${ticker}" aria-label="Remove">\u2605</button></td>
                    <td><b>${ticker}</b></td>
                    <td colspan="8" class="w-missing-text">Not in S&P 500 universe \u2014 no data available. (Pipeline only tracks S&P 500 constituents right now.)</td>
                    <td></td>
                </tr>`;
            }
            const rank = r[rank_col];
            const trend = r[trend_col];
            const dayCls = r.day_change_pct > 0 ? 'positive' : r.day_change_pct < 0 ? 'negative' : '';
            const trendCls = trend > 0 ? 'positive' : trend < 0 ? 'negative' : '';
            const quadrant = this._quadOf(rank, trend);
            const rsStr = r.rs_strength_pct;
            const rsStrCls = rsStr == null ? '' : rsStr >= 80 ? 'positive' : rsStr <= 20 ? 'negative' : '';
            return `<tr data-ticker="${r.ticker}">
                <td><button class="s-star starred" data-ticker="${r.ticker}" aria-label="Remove from watchlist">\u2605</button></td>
                <td><b class="ticker-text">${r.ticker}</b></td>
                <td class="col-name">${this._esc(r.name || '')}</td>
                <td><span class="s-sector-pill">${this._esc(r.sector || '\u2014')}</span></td>
                <td class="right">${Shared.formatPrice(r.price)}</td>
                <td class="right ${dayCls}">${Shared.formatChange(r.day_change_pct)}</td>
                <td class="right">${rank ?? '\u2014'}</td>
                <td class="right ${trendCls}">${trend == null ? '\u2014' : (trend > 0 ? '+' : '') + Math.round(trend)}</td>
                <td class="right ${rsStrCls}">${rsStr == null ? '\u2014' : Math.round(rsStr)}</td>
                <td class="right">${r.vol_20d == null ? '\u2014' : r.vol_20d.toFixed(0) + '%'}</td>
                <td><span class="s-quad-pill s-quad-${quadrant}">${quadrant}</span></td>
            </tr>`;
        }).join('');

        tbody.querySelectorAll('.s-star').forEach(btn => {
            btn.addEventListener('click', () => {
                Watchlist.remove(btn.dataset.ticker);
            });
        });
    },

    _quadOf(rank, trend) {
        if (rank == null || trend == null) return 'unknown';
        const strong = rank >= 50, rising = trend > 0;
        if (strong && rising)   return 'leading';
        if (strong && !rising)  return 'weakening';
        if (!strong && rising)  return 'improving';
        return 'lagging';
    },

    _esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },
});

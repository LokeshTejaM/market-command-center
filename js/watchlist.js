/* ============================================================
   WATCHLIST — client-side, localStorage-backed
   Zero-dependency, works offline, survives page refresh.
   Shared module: any dashboard can add/read/remove tickers.
   ============================================================ */

const Watchlist = (() => {
    const KEY = 'mcc.watchlist.v1';

    function get() {
        try {
            const raw = localStorage.getItem(KEY);
            const arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
        } catch { return []; }
    }

    function set(list) {
        // Normalize: uppercase, dedupe, cap at 100 entries.
        const clean = [...new Set(list.map(t => String(t).toUpperCase().trim()).filter(Boolean))].slice(0, 100);
        localStorage.setItem(KEY, JSON.stringify(clean));
        // Broadcast so open Watchlist page can refresh live.
        window.dispatchEvent(new CustomEvent('watchlist-change', { detail: { list: clean } }));
        return clean;
    }

    function add(ticker)    { const cur = get(); if (!cur.includes(ticker.toUpperCase())) return set([...cur, ticker]); return cur; }
    function remove(ticker) { return set(get().filter(t => t !== ticker.toUpperCase())); }
    function toggle(ticker) { return get().includes(ticker.toUpperCase()) ? remove(ticker) : add(ticker); }
    function clear()        { return set([]); }

    return { get, set, add, remove, toggle, clear };
})();

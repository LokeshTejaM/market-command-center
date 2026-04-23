/* ============================================================
   SHARED UTILITIES — Market Command Center
   Common helpers used across all dashboards.
   ============================================================ */

const Shared = (() => {
    // ── Number helpers ────────────────────────────────────────
    function numVal(cell) {
        if (!cell) return null;
        const v = cell.v;
        if (v === null || v === undefined || v === '') return null;
        const n = Number(v);
        return isNaN(n) ? null : n;
    }

    function fmt(val) {
        if (val === null || val === undefined) return '\u2014';
        return val.toLocaleString();
    }

    function formatPrice(n) {
        if (n == null || isNaN(n)) return '\u2014';
        return n >= 1
            ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : n.toFixed(4);
    }

    function formatChange(n) {
        if (n == null || isNaN(n)) return '\u2014';
        const sign = n >= 0 ? '+' : '';
        return `${sign}${n.toFixed(2)}%`;
    }

    function formatDate(d) {
        return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    }

    // ── DOM helpers ───────────────────────────────────────────
    function $(selector, parent = document) {
        return parent.querySelector(selector);
    }

    function $$(selector, parent = document) {
        return [...parent.querySelectorAll(selector)];
    }

    // ── Toast notifications ───────────────────────────────────
    function showToast(message, type = 'info') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // ── Loading overlay ───────────────────────────────────────
    function showLoading(container, message = 'Loading...') {
        let overlay = container.querySelector('.loading-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'loading-overlay';
            overlay.innerHTML = `
                <div class="loader">
                    <div class="loader-ring"></div>
                    <p class="loader-text">${message}</p>
                </div>`;
            container.style.position = 'relative';
            container.appendChild(overlay);
        }
        overlay.classList.remove('hidden');
    }

    function hideLoading(container) {
        const overlay = container.querySelector('.loading-overlay');
        if (overlay) overlay.classList.add('hidden');
    }

    // ── Market status ─────────────────────────────────────────
    function isMarketOpen() {
        const now = new Date();
        const eastern = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
        const day = eastern.getDay();
        if (day === 0 || day === 6) return false;
        const mins = eastern.getHours() * 60 + eastern.getMinutes();
        return mins >= 570 && mins < 960; // 9:30 AM - 4:00 PM ET
    }

    return {
        numVal, fmt, formatPrice, formatChange, formatDate,
        $, $$, showToast, showLoading, hideLoading, isMarketOpen,
    };
})();

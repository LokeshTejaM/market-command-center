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

    // ── Robust fetch (timeout + retry + backoff) ──────────────
    // Single source of truth for every HTTP call in the app.
    // Ships with:
    //   * AbortSignal.timeout so a stalled request cannot hang forever
    //   * Retries with exponential backoff on 5xx / 429 / network errors
    //   * Optional external AbortSignal so tab-switch can cancel in-flight work
    async function fetchJSON(url, {
        timeoutMs = 10000,
        retries = 2,
        backoffMs = 500,
        parser = 'json',       // 'json' | 'text'
        signal = null,         // external AbortSignal (e.g. from tab switch)
        init = {},             // extra fetch init
    } = {}) {
        let lastErr = null;
        for (let attempt = 0; attempt <= retries; attempt++) {
            const controllers = [AbortSignal.timeout(timeoutMs)];
            if (signal) controllers.push(signal);
            const combined = AbortSignal.any ? AbortSignal.any(controllers) : controllers[0];
            try {
                const resp = await fetch(url, { ...init, signal: combined });
                if (!resp.ok) {
                    // Retry on 5xx and 429; give up on other 4xx.
                    if (resp.status >= 500 || resp.status === 429) {
                        lastErr = new Error(`HTTP ${resp.status}`);
                    } else {
                        throw new Error(`HTTP ${resp.status}`);
                    }
                } else {
                    return parser === 'text' ? await resp.text() : await resp.json();
                }
            } catch (err) {
                lastErr = err;
                if (signal?.aborted) throw err;    // user-initiated cancel, do not retry
            }
            if (attempt < retries) {
                await new Promise(r => setTimeout(r, backoffMs * Math.pow(2, attempt)));
            }
        }
        throw lastErr || new Error('fetchJSON failed');
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

    // ── Info tooltip helper ───────────────────────────────────
    // Renders a small `\u24d8` icon. The actual tooltip element is
    // PORTALED to <body> on hover so it escapes any ancestor with
    // overflow: hidden (chart cards, table wrappers). This is the ONLY
    // way to get a tooltip that visibly overlays neighboring cards —
    // pure CSS ::after tooltips get clipped by parent overflow, and
    // no amount of z-index can rescue them.
    // Usage: `<h3>My Plot ${Shared.infoIcon('what this is + how to read it')}</h3>`
    function infoIcon(text, opts = {}) {
        const cls = opts.className || 'info-icon';
        const safe = String(text)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        return `<span class="${cls}" role="button" tabindex="0"`
             + ` aria-label="${safe}" data-tip="${safe}">\u24d8</span>`;
    }

    // ── Global tooltip portal ──────────────────────────────
    // Delegated listeners on <document>, so it works for icons rendered
    // now AND for icons injected later by any dashboard.
    let _tipEl = null;
    function _ensureTipEl() {
        if (_tipEl) return _tipEl;
        _tipEl = document.createElement('div');
        _tipEl.className = 'info-tip-portal';
        _tipEl.setAttribute('role', 'tooltip');
        document.body.appendChild(_tipEl);
        return _tipEl;
    }
    function _showTip(iconEl) {
        const tip = iconEl.getAttribute('data-tip');
        if (!tip) return;
        const el = _ensureTipEl();
        el.textContent = tip;
        el.classList.add('visible');
        // Position: try above the icon; flip below if too close to top.
        // Try centered; nudge horizontally if it would clip left/right edge.
        const rect = iconEl.getBoundingClientRect();
        el.style.left = '0'; el.style.top = '0';   // measure at 0,0 first
        el.style.transform = 'none';
        const tipRect = el.getBoundingClientRect();
        const gap = 10;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let top = rect.top - tipRect.height - gap;
        let arrowDir = 'down';
        if (top < 8) {
            top = rect.bottom + gap;
            arrowDir = 'up';
        }
        let left = rect.left + rect.width / 2 - tipRect.width / 2;
        left = Math.max(8, Math.min(vw - tipRect.width - 8, left));

        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
        el.setAttribute('data-arrow', arrowDir);
        // Arrow horizontal offset -- points at the icon center.
        const arrowX = rect.left + rect.width / 2 - left;
        el.style.setProperty('--arrow-x', `${arrowX}px`);
    }
    function _hideTip() {
        if (_tipEl) _tipEl.classList.remove('visible');
    }
    // Wire once, using event delegation. Listen on mouseover so we
    // catch descendants that bubble; filter to .info-icon targets.
    if (typeof document !== 'undefined') {
        document.addEventListener('mouseover', (e) => {
            const icon = e.target.closest && e.target.closest('.info-icon');
            if (icon) _showTip(icon);
        });
        document.addEventListener('mouseout', (e) => {
            const icon = e.target.closest && e.target.closest('.info-icon');
            if (icon) _hideTip();
        });
        document.addEventListener('focusin', (e) => {
            const icon = e.target.closest && e.target.closest('.info-icon');
            if (icon) _showTip(icon);
        });
        document.addEventListener('focusout', (e) => {
            const icon = e.target.closest && e.target.closest('.info-icon');
            if (icon) _hideTip();
        });
        // Hide on scroll or resize so it does not float in the wrong place.
        window.addEventListener('scroll', _hideTip, true);
        window.addEventListener('resize', _hideTip);
    }

    return {
        numVal, fmt, formatPrice, formatChange, formatDate,
        $, $$, showToast, showLoading, hideLoading, isMarketOpen,
        fetchJSON, infoIcon,
    };
})();

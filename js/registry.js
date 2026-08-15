/* ============================================================
   DASHBOARD REGISTRY — Market Command Center
   Plugin system: dashboards register themselves, the shell
   auto-generates nav and manages lifecycle.

   Dashboard interface:
     { id, name, icon, order, init(el), activate(), deactivate(), destroy() }
   ============================================================ */

const DashboardRegistry = (() => {
    const dashboards = [];
    let activeId = null;
    let initialized = new Set();

    function register(dashboard) {
        if (dashboards.find(d => d.id === dashboard.id)) return;
        dashboards.push(dashboard);
        dashboards.sort((a, b) => a.order - b.order);
    }

    function buildNav() {
        const tabsContainer = document.getElementById('nav-tabs');
        if (!tabsContainer) return;
        tabsContainer.innerHTML = '';

        dashboards.filter(d => !d.hiddenInNav).forEach(d => {
            const btn = document.createElement('button');
            btn.className = 'nav-tab';
            btn.dataset.view = d.id;
            btn.innerHTML = `<span class="tab-icon">${d.icon}</span> ${d.name}`;
            btn.addEventListener('click', () => switchTo(d.id));
            tabsContainer.appendChild(btn);
        });
    }

    function buildViewports() {
        const viewport = document.getElementById('dashboard-viewport');
        if (!viewport) return;
        viewport.innerHTML = '';

        dashboards.forEach(d => {
            const div = document.createElement('div');
            div.id = `view-${d.id}`;
            div.className = 'view';
            viewport.appendChild(div);
        });
    }

    function switchTo(id) {
        const dashboard = dashboards.find(d => d.id === id);
        if (!dashboard) return;

        // Deactivate current
        if (activeId && activeId !== id) {
            const prev = dashboards.find(d => d.id === activeId);
            if (prev && prev.deactivate) prev.deactivate();
        }

        // Update nav
        document.querySelectorAll('.nav-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.view === id);
        });

        // Update views
        document.querySelectorAll('.view').forEach(v => {
            v.classList.toggle('active', v.id === `view-${id}`);
        });

        // Lazy init
        const container = document.getElementById(`view-${id}`);
        if (!initialized.has(id)) {
            dashboard.init(container);
            initialized.add(id);
        }

        // Activate
        if (dashboard.activate) dashboard.activate();
        activeId = id;
        // Preserve any query portion of the hash (e.g. ?sector=XLK).
        const currentQuery = window.location.hash.includes('?')
            ? window.location.hash.substring(window.location.hash.indexOf('?'))
            : '';
        const newHash = id + currentQuery;
        if (window.location.hash.replace('#', '') !== newHash) {
            window.location.hash = newHash;
        }
    }

    function boot() {
        buildNav();
        buildViewports();
        updateMarketStatus();
        setInterval(updateMarketStatus, 60000);

        // Hash format is either "id" or "id?query=params"; parse the id portion.
        const raw = window.location.hash.replace('#', '');
        const [hashId] = raw.split('?');
        const target = dashboards.find(d => d.id === hashId) || dashboards.find(d => !d.hiddenInNav);
        if (target) switchTo(target.id);

        // Deep-linkable hash changes (e.g. sector-detail?sector=XLK) should re-route.
        window.addEventListener('hashchange', () => {
            const [nextId] = window.location.hash.replace('#', '').split('?');
            if (nextId && nextId !== activeId) switchTo(nextId);
        });
    }

    function updateMarketStatus() {
        const dot = document.getElementById('status-dot');
        const text = document.getElementById('status-text');
        if (!dot || !text) return;
        const open = Shared.isMarketOpen();
        dot.className = `status-dot ${open ? 'open' : 'closed'}`;
        text.textContent = open ? 'Market Open' : 'Market Closed';

        const ts = document.getElementById('nav-timestamp');
        if (ts) ts.textContent = new Date().toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
        });
    }

    // Auto-boot when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    return { register, switchTo };
})();

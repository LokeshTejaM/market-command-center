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

        dashboards.forEach(d => {
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
        window.location.hash = id;
    }

    function boot() {
        buildNav();
        buildViewports();
        updateMarketStatus();
        setInterval(updateMarketStatus, 60000);

        // Route from hash or default to first
        const hash = window.location.hash.replace('#', '');
        const target = dashboards.find(d => d.id === hash) || dashboards[0];
        if (target) switchTo(target.id);
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

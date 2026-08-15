/* =========================================================
   ECONOMIC CALENDAR — Market Command Center

   Shows the macro events that move markets, computed from
   published release cadences. No API keys, no scraping —
   the schedule is deterministic (Fed publishes a year ahead,
   BLS/BEA release dates follow strict rules).

   For a momentum trader, knowing "CPI drops Thu 8:30 AM" or
   "FOMC statement Wed 2 PM" is oxygen — position sizing
   and holds change ENTIRELY around these events.
   ========================================================= */

DashboardRegistry.register({
    id: 'calendar',
    name: 'Macro Calendar',
    icon: '\u{1F5D3}',
    order: 3,

    _state: {},

    init(container) {
        container.id = 'view-calendar';
        container.innerHTML = this._template();
        this.activate();
    },

    activate() {
        this._render();
    },

    deactivate() {},
    destroy() {},

    // ─── HTML shell ───────────────────────────────────────
    _template() {
        return `
            <div class="cal-toolbar">
                <h2 style="margin:0">Macro Calendar</h2>
                <div class="cal-controls">
                    <label>Show:
                        <select id="cal-range">
                            <option value="7">Next 7 days</option>
                            <option value="14" selected>Next 14 days</option>
                            <option value="30">Next 30 days</option>
                            <option value="90">Next 90 days</option>
                        </select>
                    </label>
                    <label>Filter:
                        <select id="cal-filter">
                            <option value="all">All events</option>
                            <option value="high">High-impact only</option>
                            <option value="fed">Fed only</option>
                        </select>
                    </label>
                </div>
            </div>

            <div class="section-head">
                <h2>Upcoming Macro Events ${Shared.infoIcon(
                    'What: Scheduled US economic data releases and Fed events. Impact levels: HIGH (moves the whole tape -- Fed decisions, CPI, NFP, PCE, PPI, retail sales, GDP), MEDIUM (moves rates/sectors -- ISM, JOLTS, Michigan Sentiment), LOW (background). HOW TO READ: Momentum traders REDUCE size or go flat into HIGH-impact events. The tape often chops for 60-90min before, then trends after. Fed weeks are the highest volatility of the month. Cadence: NFP = first Friday, CPI = ~2nd Tuesday, FOMC = 8x/year (dates hardcoded from published Fed calendar), PCE = last Friday, Jobless Claims = every Thursday 8:30 AM ET.'
                )}</h2>
                <p>Deterministic schedule derived from BLS/BEA/Fed release conventions. All times US Eastern.</p>
            </div>

            <div class="cal-list" id="cal-list"></div>

            <div class="section-head" style="margin-top:32px">
                <h2>Momentum Trader Playbook ${Shared.infoIcon(
                    'A short cheat sheet for how these events interact with momentum setups.'
                )}</h2>
            </div>
            <div class="cal-playbook">
                <div class="cal-play-card">
                    <b>2 days before FOMC</b>
                    <p>Reduce new position sizing to 1/2. Existing leaders keep normal stops.
                    The tape often coils into the meeting.</p>
                </div>
                <div class="cal-play-card">
                    <b>FOMC day (Wed 2:00 PM ET)</b>
                    <p>Statement drops at 2:00. Presser at 2:30. The first 30min move
                    is usually faded; the trend that develops between 3:00-4:00 is often
                    the multi-day direction.</p>
                </div>
                <div class="cal-play-card">
                    <b>CPI day (~2nd Tue, 8:30 AM ET)</b>
                    <p>Pre-market gaps are large. Do NOT chase the first candle;
                    wait for opening-range breakout after 9:45. Cool prints = risk-on.</p>
                </div>
                <div class="cal-play-card">
                    <b>NFP day (1st Fri, 8:30 AM ET)</b>
                    <p>Directional day: strong reaction sets weekly trend. Watch
                    small-caps (IWM) for risk-on confirmation. Weak jobs + falling
                    yields = growth-stock rip.</p>
                </div>
            </div>
        `;
    },

    _render() {
        Shared.$('#cal-range').addEventListener('change', () => this._paint());
        Shared.$('#cal-filter').addEventListener('change', () => this._paint());
        this._paint();
    },

    _paint() {
        const days = parseInt(Shared.$('#cal-range').value, 10);
        const filter = Shared.$('#cal-filter').value;
        const events = this._computeEvents(days).filter(ev => {
            if (filter === 'all') return true;
            if (filter === 'high') return ev.impact === 'high';
            if (filter === 'fed') return ev.category === 'fed';
            return true;
        });

        // Group by date
        const grouped = new Map();
        for (const ev of events) {
            const key = ev.date.toDateString();
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key).push(ev);
        }

        const el = Shared.$('#cal-list');
        if (grouped.size === 0) {
            el.innerHTML = '<div class="cal-empty">No events in this range with the current filter.</div>';
            return;
        }

        const fmtDate = d => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        const html = [...grouped.entries()].map(([_, list]) => {
            const day = list[0].date;
            const isToday = day.toDateString() === new Date().toDateString();
            return `
                <div class="cal-day ${isToday ? 'cal-today' : ''}">
                    <div class="cal-day-head">${fmtDate(day)}${isToday ? ' <span class="cal-today-pill">TODAY</span>' : ''}</div>
                    ${list.map(ev => `
                        <div class="cal-event cal-imp-${ev.impact}">
                            <span class="cal-time">${ev.time}</span>
                            <span class="cal-impact cal-impact-${ev.impact}">${ev.impact.toUpperCase()}</span>
                            <span class="cal-name">${ev.name}</span>
                            <span class="cal-desc">${ev.desc}</span>
                        </div>
                    `).join('')}
                </div>`;
        }).join('');
        el.innerHTML = html;
    },

    // ─── Event schedule (deterministic) ──────────────────
    // FOMC dates published by the Fed a full year in advance.
    // 2026 schedule from: federalreserve.gov/monetarypolicy/fomccalendars.htm
    _fomcDates: [
        // Two-day meetings; statement + SEP drops the second afternoon.
        '2026-01-28', '2026-03-18', '2026-04-29', '2026-06-17',
        '2026-07-29', '2026-09-16', '2026-10-28', '2026-12-09',
        '2027-01-27', '2027-03-17', '2027-04-28', '2027-06-16',
    ],

    _computeEvents(daysAhead) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const end = new Date(today);
        end.setDate(end.getDate() + daysAhead);

        const events = [];

        // FOMC (2-day meetings; big event is the statement on day 2)
        for (const dstr of this._fomcDates) {
            const d = new Date(dstr + 'T00:00:00');
            if (d >= today && d <= end) {
                events.push({
                    date: d, time: '2:00 PM',
                    name: 'FOMC Statement + SEP',
                    desc: 'Rate decision + Summary of Economic Projections. Powell presser 2:30 PM.',
                    impact: 'high', category: 'fed',
                });
            }
        }

        // Iterate day by day from today to end and pull cadence events
        for (let d = new Date(today); d <= end; d.setDate(d.getDate() + 1)) {
            const dow = d.getDay();               // 0 Sun ... 6 Sat
            const dom = d.getDate();

            // Thursday 8:30 AM: Initial Jobless Claims (weekly)
            if (dow === 4) {
                events.push({
                    date: new Date(d), time: '8:30 AM',
                    name: 'Initial Jobless Claims',
                    desc: 'Weekly labor-market pulse. Watch 4-week average trend.',
                    impact: 'medium', category: 'labor',
                });
            }

            // First Friday: Non-Farm Payrolls
            if (dow === 5 && dom <= 7) {
                events.push({
                    date: new Date(d), time: '8:30 AM',
                    name: 'Non-Farm Payrolls (NFP) + Unemployment Rate',
                    desc: 'Biggest data print of the month. Sets weekly tone.',
                    impact: 'high', category: 'labor',
                });
            }

            // Second Tuesday: CPI (approximately — BLS varies but this is close)
            if (dow === 2 && dom >= 8 && dom <= 14) {
                events.push({
                    date: new Date(d), time: '8:30 AM',
                    name: 'CPI (Consumer Price Index)',
                    desc: 'Inflation print. Core CPI m/m is the number to watch.',
                    impact: 'high', category: 'inflation',
                });
            }

            // Second Wednesday: PPI (day after CPI)
            if (dow === 3 && dom >= 9 && dom <= 15) {
                events.push({
                    date: new Date(d), time: '8:30 AM',
                    name: 'PPI (Producer Price Index)',
                    desc: 'Wholesale inflation. Leads CPI by ~1 month.',
                    impact: 'medium', category: 'inflation',
                });
            }

            // Mid-month Thursday: Retail Sales
            if (dow === 4 && dom >= 14 && dom <= 20) {
                events.push({
                    date: new Date(d), time: '8:30 AM',
                    name: 'Retail Sales',
                    desc: 'Consumer strength gauge. Watch control-group m/m.',
                    impact: 'medium', category: 'consumer',
                });
            }

            // First business day: ISM Manufacturing
            const businessDay1 = new Date(d.getFullYear(), d.getMonth(), 1);
            while (businessDay1.getDay() === 0 || businessDay1.getDay() === 6) {
                businessDay1.setDate(businessDay1.getDate() + 1);
            }
            if (d.toDateString() === businessDay1.toDateString()) {
                events.push({
                    date: new Date(d), time: '10:00 AM',
                    name: 'ISM Manufacturing PMI',
                    desc: 'Above 50 = expansion. Watch prices-paid subindex.',
                    impact: 'medium', category: 'growth',
                });
            }

            // Third business day: ISM Services
            const businessDay3 = new Date(businessDay1);
            let bcount = 1;
            while (bcount < 3) {
                businessDay3.setDate(businessDay3.getDate() + 1);
                if (businessDay3.getDay() !== 0 && businessDay3.getDay() !== 6) bcount++;
            }
            if (d.toDateString() === businessDay3.toDateString()) {
                events.push({
                    date: new Date(d), time: '10:00 AM',
                    name: 'ISM Services PMI',
                    desc: 'Services expansion gauge. US is 70% services.',
                    impact: 'medium', category: 'growth',
                });
            }

            // Last Friday: PCE (Fed's preferred inflation gauge)
            const nextMon = new Date(d.getFullYear(), d.getMonth() + 1, 1);
            const lastFriday = new Date(nextMon);
            lastFriday.setDate(lastFriday.getDate() - ((lastFriday.getDay() + 2) % 7 + 1));
            if (d.toDateString() === lastFriday.toDateString()) {
                events.push({
                    date: new Date(d), time: '8:30 AM',
                    name: 'PCE (Personal Consumption Expenditures)',
                    desc: 'Fed\u2019s preferred inflation gauge. Core PCE y/y is THE number.',
                    impact: 'high', category: 'inflation',
                });
            }
        }

        return events.sort((a, b) => a.date - b.date);
    },
});

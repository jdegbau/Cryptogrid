// Stats dialog. Chart.js is pinned and only loaded the first time the
// dialog opens; the summary shows straight away and the charts follow.
import { readStats, summarizeStats, guessDistribution, dailySeries, encodeStatsBackup, importStatsBackup } from './storage.js';
import { formatTime } from './date.js';
import { buildStatsShare, shareText, copyOrShow, gameUrl } from './share.js';
import { track, EVENTS } from './analytics.js';

const CHART_JS_SRC = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js';
const CHART_JS_INTEGRITY = 'sha384-dug+JxfBvklEQdJ4AYuBBAIScUz0bVN73xpy273gcAwHjb3qI0fXmuYNaNfdyYJG';

const COLORS = { win: '#22a95a', loss: '#e0524a', time: '#f59e0b' };

// Text, grid and slice-border colours from the current theme.
const themeColors = () => {
    const css = getComputedStyle(document.documentElement);
    const v = (name) => css.getPropertyValue(name).trim();
    return { text: v('--text-muted'), grid: v('--border'), surface: v('--surface') };
};

let chartJsPromise = null;
const loadChartJs = () => {
    if (window.Chart) return Promise.resolve(window.Chart);
    if (!chartJsPromise) {
        chartJsPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = CHART_JS_SRC;
            script.integrity = CHART_JS_INTEGRITY;
            script.crossOrigin = 'anonymous';
            script.onload = () => (window.Chart ? resolve(window.Chart) : reject(new Error('Chart.js missing')));
            script.onerror = () => reject(new Error('Chart.js failed to load'));
            document.head.appendChild(script);
        }).catch(err => {
            chartJsPromise = null; // allow a retry next time the dialog opens
            throw err;
        });
    }
    return chartJsPromise;
};

const charts = [];
const destroyCharts = () => {
    while (charts.length) charts.pop().destroy();
};

const bestTime = (summary) => {
    const wins = summary.sorted.filter(e => e.win && Number.isFinite(e.timeSpent));
    return wins.length ? Math.min(...wins.map(e => e.timeSpent)) : null;
};

const renderSummary = (summary) => {
    const best = bestTime(summary);
    const time = (s) => (s === null || !summary.played ? '–' : formatTime(Math.round(s)));
    const tiles = [
        ['Played', summary.played],
        ['Win %', summary.played ? Math.round(summary.winRate) : '–'],
        ['Streak', summary.streak],
        ['Best streak', summary.bestStreak],
        ['Avg. guesses', summary.played ? summary.avgGuesses.toFixed(1) : '–'],
        ['Avg. time', time(summary.avgTime)],
        ['Best time', time(best)]
    ];
    const list = document.getElementById('stats-summary');
    list.textContent = '';
    tiles.forEach(([term, value]) => {
        const tile = document.createElement('div');
        tile.className = 'stat-tile';
        const dt = document.createElement('dt');
        dt.textContent = term;
        const dd = document.createElement('dd');
        dd.textContent = value;
        tile.append(dt, dd);
        list.append(tile);
    });
};

// Bars for wins on each guess, then losses; today's result is highlighted.
// Plain HTML, so it shows even when Chart.js can't load.
const renderDistribution = (summary, today) => {
    const wrap = document.getElementById('stats-distribution-wrap');
    const list = document.getElementById('stats-distribution');
    wrap.hidden = !summary.played;
    list.textContent = '';
    if (!summary.played) return;
    const { wins, losses } = guessDistribution(summary.sorted);
    const todays = summary.sorted.find(e => e.date === today);
    const rows = wins.map((count, i) => ({
        label: String(i + 1),
        name: i === 0 ? 'Solved on guess 1' : `Solved on guess ${i + 1}`,
        count,
        isToday: !!todays && todays.win && Math.min(Math.max(todays.guessesUsed, 1), 5) === i + 1
    }));
    rows.push({ label: 'X', name: 'Not solved', count: losses, isToday: !!todays && !todays.win });
    const max = Math.max(...rows.map(r => r.count), 1);
    rows.forEach(row => {
        const li = document.createElement('li');
        li.className = row.isToday ? 'distribution-row today' : 'distribution-row';
        const label = document.createElement('span');
        label.className = 'distribution-label';
        label.setAttribute('aria-hidden', 'true');
        label.textContent = row.label;
        const bar = document.createElement('span');
        bar.className = 'distribution-bar';
        bar.style.setProperty('--share', `${(row.count / max) * 100}%`);
        bar.setAttribute('aria-hidden', 'true');
        bar.textContent = row.count;
        const text = document.createElement('span');
        text.className = 'sr-only';
        text.textContent = `${row.name}: ${row.count} ${row.count === 1 ? 'game' : 'games'}${row.isToday ? ' (today)' : ''}`;
        li.append(label, bar, text);
        list.append(li);
    });
};

// "2026-10-21" → "Oct 21" (the date is a calendar day, so read it as UTC).
const shortDate = (date) =>
    new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });

const renderCharts = (Chart, summary) => {
    destroyCharts();
    const theme = themeColors();
    Chart.defaults.color = theme.text;
    Chart.defaults.borderColor = theme.grid;
    const animation = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? false : undefined;

    charts.push(new Chart(document.getElementById('stats-win-chart'), {
        type: 'pie',
        data: {
            labels: ['Wins', 'Losses'],
            datasets: [{
                data: [summary.wins, summary.losses],
                backgroundColor: [COLORS.win, COLORS.loss],
                borderColor: [theme.surface, theme.surface],
                borderWidth: 2
            }]
        },
        options: { animation, responsive: false, plugins: { legend: { position: 'bottom' } } }
    }));

    // Every day from the first game to the last; days not played are gaps.
    const series = dailySeries(summary.sorted, 'timeSpent');
    charts.push(new Chart(document.getElementById('stats-time-chart'), {
        type: 'line',
        data: {
            labels: series.dates,
            datasets: [{
                label: 'Time Spent (s)', data: series.values, spanGaps: false,
                borderColor: COLORS.time, backgroundColor: `${COLORS.time}26`, fill: true,
                tension: 0.35, pointRadius: 3, borderWidth: 2.5
            }]
        },
        options: {
            animation,
            plugins: { legend: { display: false } },
            scales: { x: { ticks: { maxTicksLimit: 6, maxRotation: 0, callback: (_, i) => shortDate(series.dates[i]) } }, y: { min: 0 } }
        }
    }));
};

// `getToday()` returns today's puzzle date, used for the streak.
export const setupStatsDialog = (storage, getToday) => {
    const dialog = document.getElementById('stats-modal');
    const openButton = document.getElementById('stats-button');
    const closeButton = document.getElementById('stats-close');
    const status = document.getElementById('stats-chart-status');
    const chartArea = document.getElementById('stats-charts');
    const shareButton = document.getElementById('stats-share');
    let share = null;
    shareButton.addEventListener('click', async () => {
        if (!share) return;
        const method = await shareText(share, shareButton);
        track(EVENTS.SHARE, { content_type: 'stats', method });
    });

    // Backup codes for moving stats between devices.
    const exportButton = document.getElementById('stats-export');
    const importButton = document.getElementById('stats-import');
    const importCode = document.getElementById('stats-import-code');
    const importStatus = document.getElementById('stats-import-status');
    exportButton.addEventListener('click', async () => {
        const history = readStats(storage);
        const method = await copyOrShow(encodeStatsBackup(history), exportButton);
        track(EVENTS.STATS_EXPORT, { method, games_exported: history.length });
    });
    importButton.addEventListener('click', () => {
        const result = importStatsBackup(storage, importCode.value);
        track(EVENTS.STATS_IMPORT, result
            ? { import_result: result.added ? 'added' : 'nothing_new', games_added: result.added, games_total: result.total }
            : { import_result: 'invalid_code', games_added: 0 });
        if (!result) {
            importStatus.textContent = "That doesn't look like a backup code. Copy the whole code and try again.";
            return;
        }
        importCode.value = '';
        importStatus.textContent = result.added
            ? `Added ${result.added} ${result.added === 1 ? 'game' : 'games'}. You now have ${result.total} in total.`
            : 'Nothing new to add: every game in that code is already here.';
        if (result.added) refresh();
    });

    // Fill the dialog from saved stats; also used after an import.
    const refresh = async () => {
        const summary = summarizeStats(readStats(storage), getToday());
        renderSummary(summary);
        renderDistribution(summary, getToday());
        share = summary.played ? buildStatsShare(summary, { bestTime: bestTime(summary), url: gameUrl() }) : null;
        shareButton.hidden = !share;

        chartArea.hidden = true;
        if (!summary.played) {
            status.textContent = 'Finish a puzzle to start your charts.';
            return;
        }
        status.textContent = 'Loading charts…';
        try {
            const Chart = await loadChartJs();
            if (!dialog.open) return;
            renderCharts(Chart, summary);
            chartArea.hidden = false;
            status.textContent = '';
        } catch (e) {
            status.textContent = "Charts couldn't be loaded. Your stats are listed above.";
        }
    };

    const open = () => {
        importStatus.textContent = '';
        dialog.showModal();
        refresh();
        track(EVENTS.DIALOG_OPEN, { dialog_name: 'stats', trigger: 'button' });
    };

    openButton.addEventListener('click', open);
    closeButton.addEventListener('click', () => dialog.close());
    // Clicking the dimmed backdrop (the dialog element itself) closes it.
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) dialog.close();
    });
    // Escape is handled by <dialog>; put focus back where it came from.
    dialog.addEventListener('close', () => openButton.focus());
};

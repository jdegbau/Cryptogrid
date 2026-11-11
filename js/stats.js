// Stats dialog. Chart.js is pinned and only loaded the first time the
// dialog opens; the summary shows straight away and the charts follow.
import { readStats, summarizeStats } from './storage.js';
import { formatTime } from './date.js';

const CHART_JS_SRC = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js';
const CHART_JS_INTEGRITY = 'sha384-dug+JxfBvklEQdJ4AYuBBAIScUz0bVN73xpy273gcAwHjb3qI0fXmuYNaNfdyYJG';

const COLORS = { win: '#22a95a', loss: '#e0524a', guesses: '#7c5cff', time: '#f59e0b' };

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

const renderSummary = (summary) => {
    const wins = summary.sorted.filter(e => e.win && Number.isFinite(e.timeSpent));
    const best = wins.length ? Math.min(...wins.map(e => e.timeSpent)) : null;
    const time = (s) => (s === null || !summary.played ? '–' : formatTime(Math.round(s)));
    const tiles = [
        ['Played', summary.played],
        ['Win %', summary.played ? Math.round(summary.winRate) : '–'],
        ['Streak', summary.streak],
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

const renderCharts = (Chart, summary) => {
    destroyCharts();
    const theme = themeColors();
    Chart.defaults.color = theme.text;
    Chart.defaults.borderColor = theme.grid;
    const dates = summary.sorted.map(e => e.date);
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

    const lineChart = (canvasId, label, data, color, yScale) => new Chart(document.getElementById(canvasId), {
        type: 'line',
        data: { labels: dates, datasets: [{ label, data, borderColor: color, backgroundColor: `${color}26`, fill: true, tension: 0.35, pointRadius: 3, borderWidth: 2.5 }] },
        options: { animation, plugins: { legend: { display: false } }, scales: { y: yScale } }
    });
    charts.push(lineChart('stats-guess-chart', 'Guesses Used', summary.sorted.map(e => e.guessesUsed), COLORS.guesses,
        { min: 0, max: 5, ticks: { stepSize: 1 } }));
    charts.push(lineChart('stats-time-chart', 'Time Spent (s)', summary.sorted.map(e => e.timeSpent), COLORS.time,
        { min: 0 }));
};

// `getToday()` returns today's puzzle date, used for the streak.
export const setupStatsDialog = (storage, getToday) => {
    const dialog = document.getElementById('stats-modal');
    const openButton = document.getElementById('stats-button');
    const closeButton = document.getElementById('stats-close');
    const status = document.getElementById('stats-chart-status');
    const chartArea = document.getElementById('stats-charts');

    const open = async () => {
        const summary = summarizeStats(readStats(storage), getToday());
        renderSummary(summary);
        dialog.showModal();

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

    openButton.addEventListener('click', open);
    closeButton.addEventListener('click', () => dialog.close());
    // Clicking the dimmed backdrop (the dialog element itself) closes it.
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) dialog.close();
    });
    // Escape is handled by <dialog>; put focus back where it came from.
    dialog.addEventListener('close', () => openButton.focus());
};

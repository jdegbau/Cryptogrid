// Saved game and stats history. Every function takes the storage object
// (localStorage in the browser) so it can be tested with a stand-in.
import { daysBetween, addDays } from './date.js';

export const GAME_KEY = 'pseudokuGameState';
export const STATS_KEY = 'pseudokuStatsHistory';

const readJSON = (storage, key) => {
    try {
        return JSON.parse(storage.getItem(key));
    } catch (e) {
        return null;
    }
};

const writeJSON = (storage, key, value) => {
    try {
        storage.setItem(key, JSON.stringify(value));
    } catch (e) {
        // Storage full or blocked (e.g. private mode): the game still works.
    }
};

// The saved game, but only if it is for this puzzle on this day.
export const readGameState = (storage, { puzzleID, puzzleDate }) => {
    const saved = readJSON(storage, GAME_KEY);
    if (saved && saved.currentPuzzle && saved.puzzleID === puzzleID && saved.puzzleDate === puzzleDate) {
        return saved;
    }
    return null;
};

// Whatever game is saved, for any puzzle.
export const readAnyGameState = (storage) => readJSON(storage, GAME_KEY);

export const writeGameState = (storage, state) => writeJSON(storage, GAME_KEY, state);

export const clearGameState = (storage) => {
    try {
        storage.removeItem(GAME_KEY);
    } catch (e) { }
};

// Entries from before version 2 counted only the wrong guesses on a win,
// so a first-try win was saved as 0. They are corrected as they're read.
export const STATS_VERSION = 2;

const upgradeEntry = (entry) =>
    !entry.v && entry.win && Number.isFinite(entry.guessesUsed)
        ? { ...entry, guessesUsed: entry.guessesUsed + 1, v: STATS_VERSION }
        : entry;

export const readStats = (storage) => {
    const history = readJSON(storage, STATS_KEY);
    return Array.isArray(history) ? history.filter(e => e && typeof e === 'object').map(upgradeEntry) : [];
};

// Add or replace the entry for entry.date.
export const recordResult = (storage, entry) => {
    const history = readStats(storage).filter(e => e.date !== entry.date);
    history.push(entry);
    writeJSON(storage, STATS_KEY, history);
    return history;
};

const average = (values) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

// Wins on consecutive days, ending today or yesterday. A missed day or a
// loss ends it. Not having played today yet doesn't break it.
export const currentStreak = (sorted, today) => {
    if (sorted.length === 0) return 0;
    const last = sorted[sorted.length - 1];
    if (today && daysBetween(last.date, today) > 1) return 0;
    let streak = 0;
    for (let i = sorted.length - 1; i >= 0; i--) {
        if (!sorted[i].win) break;
        if (i < sorted.length - 1 && daysBetween(sorted[i].date, sorted[i + 1].date) !== 1) break;
        streak++;
    }
    return streak;
};

// The longest run of wins on consecutive days, ever.
export const bestStreak = (sorted) => {
    let best = 0;
    let run = 0;
    sorted.forEach((entry, i) => {
        if (!entry.win) {
            run = 0;
            return;
        }
        const follows = i > 0 && sorted[i - 1].win && daysBetween(sorted[i - 1].date, entry.date) === 1;
        run = follows ? run + 1 : 1;
        best = Math.max(best, run);
    });
    return best;
};

// Wins by the number of guesses taken (index 0 = solved on guess 1), and losses.
export const guessDistribution = (sorted, totalGuesses = 5) => {
    const wins = Array(totalGuesses).fill(0);
    let losses = 0;
    sorted.forEach(entry => {
        if (!entry.win) losses++;
        else {
            const guesses = Math.min(Math.max(Math.round(entry.guessesUsed) || 1, 1), totalGuesses);
            wins[guesses - 1]++;
        }
    });
    return { wins, losses };
};

// One point per calendar day from the first game to the last, with null on
// days that weren't played, so gaps show on a chart instead of vanishing.
export const dailySeries = (sorted, key) => {
    if (!sorted.length) return { dates: [], values: [] };
    const byDate = new Map(sorted.map(e => [e.date, e]));
    const days = daysBetween(sorted[0].date, sorted[sorted.length - 1].date);
    const dates = [];
    const values = [];
    for (let i = 0; i <= days; i++) {
        const date = addDays(sorted[0].date, i);
        dates.push(date);
        values.push(byDate.has(date) ? byDate.get(date)[key] : null);
    }
    return { dates, values };
};

export const summarizeStats = (history, today = null) => {
    const sorted = history.slice().sort((a, b) => a.date.localeCompare(b.date));
    const wins = sorted.filter(e => e.win).length;
    const streak = currentStreak(sorted, today);
    return {
        sorted,
        played: sorted.length,
        wins,
        losses: sorted.length - wins,
        winRate: sorted.length ? (wins / sorted.length) * 100 : 0,
        streak,
        bestStreak: bestStreak(sorted),
        avgGuesses: average(sorted.map(e => e.guessesUsed)),
        avgTime: average(sorted.map(e => e.timeSpent))
    };
};

// --- Moving stats between devices ---
// A backup is a short text code: a prefix, then base64 of compact JSON
// ([date, win, guesses, seconds] per game). It holds no personal data.

const BACKUP_PREFIX = 'PSEUDOKU1:';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const encodeStatsBackup = (history) =>
    BACKUP_PREFIX + btoa(JSON.stringify(history.map(e => [e.date, e.win ? 1 : 0, e.guessesUsed, e.timeSpent])));

// The entries in a backup code, or null if it isn't a valid one.
export const decodeStatsBackup = (code) => {
    const trimmed = String(code || '').replace(/\s+/g, '');
    if (!trimmed.startsWith(BACKUP_PREFIX)) return null;
    let rows;
    try {
        rows = JSON.parse(atob(trimmed.slice(BACKUP_PREFIX.length)));
    } catch (e) {
        return null;
    }
    if (!Array.isArray(rows)) return null;
    const valid = (r) => Array.isArray(r) && DATE_RE.test(r[0]) && (r[1] === 0 || r[1] === 1)
        && Number.isFinite(r[2]) && r[2] >= 0 && r[2] <= 5 && Number.isFinite(r[3]) && r[3] >= 0;
    if (!rows.every(valid)) return null;
    return rows.map(([date, win, guessesUsed, timeSpent]) => ({ date, win: win === 1, guessesUsed, timeSpent, v: STATS_VERSION }));
};

// Add imported games to the history. A day already played here keeps the
// local result. Returns the merged history and how many games were added.
export const mergeStats = (local, imported) => {
    const dates = new Set(local.map(e => e.date));
    const added = imported.filter(e => !dates.has(e.date) && dates.add(e.date));
    return { history: local.concat(added), added: added.length };
};

export const importStatsBackup = (storage, code) => {
    const imported = decodeStatsBackup(code);
    if (!imported) return null;
    const { history, added } = mergeStats(readStats(storage), imported);
    writeJSON(storage, STATS_KEY, history);
    return { added, total: history.length };
};

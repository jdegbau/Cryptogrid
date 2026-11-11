// Saved game and stats history. Every function takes the storage object
// (localStorage in the browser) so it can be tested with a stand-in.
import { daysBetween } from './date.js';

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
        avgGuesses: average(sorted.map(e => e.guessesUsed)),
        avgTime: average(sorted.map(e => e.timeSpent))
    };
};

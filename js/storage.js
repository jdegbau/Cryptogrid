// Saved game and stats history. Every function takes the storage object
// (localStorage in the browser) so it can be tested with a stand-in.

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

export const readStats = (storage) => {
    const history = readJSON(storage, STATS_KEY);
    return Array.isArray(history) ? history : [];
};

// Add or replace the entry for entry.date.
export const recordResult = (storage, entry) => {
    const history = readStats(storage).filter(e => e.date !== entry.date);
    history.push(entry);
    writeJSON(storage, STATS_KEY, history);
    return history;
};

const average = (values) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

export const summarizeStats = (history) => {
    const sorted = history.slice().sort((a, b) => a.date.localeCompare(b.date));
    const wins = sorted.filter(e => e.win).length;
    let streak = 0;
    for (let i = sorted.length - 1; i >= 0 && sorted[i].win; i--) streak++;
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

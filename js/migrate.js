// Bringing saved games, stats and settings over from the game's old addresses.
//
// Browser storage belongs to one address, so a player who moves from an old
// address to this one would start with nothing. Each old address serves a
// small bridge page (old-address/pseudoku-bridge.html) that reads what that
// address saved and posts it to this page only. This page loads each bridge
// in a hidden frame and merges what comes back. All the addresses are under
// jdegbau.com, so browsers give the frame the old address's real storage.
import { GAME_KEY, STATS_KEY, mergeStats } from './storage.js';

export const OLD_BRIDGES = [
    'https://cryptogrid.jdegbau.com/pseudoku-bridge.html',  // Nov 2026
    'https://jdegbau.com/pseudoku-bridge.html'              // jdegbau.com/Cryptogrid/, until Nov 2026
];
export const LIVE_ORIGIN = 'https://pseudoku.jdegbau.com';
export const MESSAGE_TYPE = 'pseudoku-old-data';

const DONE_KEY = 'pseudokuMigratedFrom';  // old origins that have answered
const TRIES_KEY = 'pseudokuMigrateTries';
const MAX_TRIES = 20;                     // stop asking a bridge that never answers
const WAIT_MS = 2500;                     // most a page load waits for the bridges
const AFTER_LOAD_MS = 300;                // a loaded bridge posts during its load

// Copied over only if this address has nothing saved for them yet.
const COPY_IF_MISSING = ['pseudokuSettings', 'pseudokuSeenHelp', 'pseudokuShareFormat', GAME_KEY];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const validEntry = (e) => e && typeof e === 'object' && DATE_RE.test(e.date) && typeof e.win === 'boolean'
    && Number.isFinite(e.guessesUsed) && Number.isFinite(e.timeSpent);

const parseJSON = (text) => {
    try { return JSON.parse(text); } catch (e) { return null; }
};

// Merge one old address's saved data (key → stored string) into storage.
// Stats are combined, keeping this address's result for a day played on
// both; everything else is only filled in where nothing is saved here.
// Returns how many games were added and which other keys were copied.
export const mergeOldData = (storage, data) => {
    const result = { gamesAdded: 0, copied: [] };
    if (!data || typeof data !== 'object') return result;

    // Entries are stored as saved, not as readStats returns them: it upgrades
    // old-format entries as it reads them, and must not do that twice.
    const oldStats = parseJSON(data[STATS_KEY]);
    if (Array.isArray(oldStats)) {
        const localRaw = parseJSON(storage.getItem(STATS_KEY));
        const local = Array.isArray(localRaw) ? localRaw.filter(e => e && typeof e === 'object') : [];
        const { history, added } = mergeStats(local, oldStats.filter(validEntry));
        if (added) {
            try {
                storage.setItem(STATS_KEY, JSON.stringify(history));
                result.gamesAdded = added;
            } catch (e) { }
        }
    }

    COPY_IF_MISSING.forEach(key => {
        if (typeof data[key] !== 'string' || storage.getItem(key) !== null) return;
        if (key !== 'pseudokuSeenHelp' && key !== 'pseudokuShareFormat' && parseJSON(data[key]) === null) return;
        try {
            storage.setItem(key, data[key]);
            result.copied.push(key);
        } catch (e) { }
    });
    return result;
};

const readDone = (storage) => {
    const done = parseJSON(storage.getItem(DONE_KEY));
    return Array.isArray(done) ? done : [];
};

// The bridges still worth asking: not yet answered, and not given up on.
export const pendingBridges = (storage, bridges = OLD_BRIDGES) => {
    let tries = 0;
    try { tries = Number(storage.getItem(TRIES_KEY)) || 0; } catch (e) { return []; }
    if (tries >= MAX_TRIES) return [];
    const done = readDone(storage);
    return bridges.filter(url => !done.includes(new URL(url).origin));
};

// Ask each pending bridge for its data and merge it. Resolves when every
// bridge has answered or failed, or after WAIT_MS, whichever is first.
// Only runs on the live site: the bridges post to that address only.
export const migrateFromOldAddresses = (storage, { origin = window.location.origin } = {}) => {
    if (origin !== LIVE_ORIGIN) return Promise.resolve(null);
    const bridges = pendingBridges(storage);
    if (!bridges.length) return Promise.resolve(null);
    try { storage.setItem(TRIES_KEY, String((Number(storage.getItem(TRIES_KEY)) || 0) + 1)); } catch (e) { }

    const origins = bridges.map(url => new URL(url).origin);
    const total = { gamesAdded: 0, copied: [] };
    const frames = [];
    let left = bridges.length;

    return new Promise(resolve => {
        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            window.removeEventListener('message', onMessage);
            frames.forEach(f => f.remove());
            resolve(total);
        };
        const settle = () => { if (--left <= 0) finish(); };

        const answered = new Set();
        const onMessage = (event) => {
            if (!origins.includes(event.origin) || answered.has(event.origin)) return;
            if (!event.data || event.data.type !== MESSAGE_TYPE) return;
            answered.add(event.origin);
            const { gamesAdded, copied } = mergeOldData(storage, event.data.data);
            total.gamesAdded += gamesAdded;
            total.copied.push(...copied);
            try { storage.setItem(DONE_KEY, JSON.stringify([...readDone(storage), event.origin])); } catch (e) { }
            settle();
        };
        window.addEventListener('message', onMessage);

        bridges.forEach((url, i) => {
            const frame = document.createElement('iframe');
            frame.hidden = true;
            frame.setAttribute('aria-hidden', 'true');
            frame.tabIndex = -1;
            frame.src = url;
            // A missing bridge loads an error page that never posts.
            frame.addEventListener('load', () => setTimeout(() => {
                if (!answered.has(origins[i]) && !finished) settle();
            }, AFTER_LOAD_MS), { once: true });
            frame.addEventListener('error', settle, { once: true });
            frames.push(frame);
            document.body.append(frame);
        });
        setTimeout(finish, WAIT_MS);
    });
};

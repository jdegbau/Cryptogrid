// Analytics data layer. Every event is pushed to `window.dataLayer` in one
// shape, so any tag manager (Google Tag Manager, Tealium, Segment, Adobe
// Launch...) can pick it up without the game knowing which one is in use.
// See docs/tracking.md for every event and field.
//
// Each push looks like:
//   { event, schema_version, event_data: {...}, puzzle: {...}, game: {...}, player: {...}, app: {...} }
//
// `event_data` holds the fields for that one event. `puzzle`, `game`,
// `player` and `app` are context, sent whole with every event so a tag can
// read them at any point. Nothing here identifies the player, and no answers
// or guessed digits are sent: the data layer is readable in the console.

export const SCHEMA_VERSION = 1;

// Event names, in one place so tags and code agree.
export const EVENTS = Object.freeze({
    GAME_LOAD: 'game_load',
    PUZZLE_LOAD_ERROR: 'puzzle_load_error',
    PUZZLE_START: 'puzzle_start',
    GUESS_SUBMIT: 'guess_submit',
    GUESS_REJECTED: 'guess_rejected',
    PUZZLE_COMPLETE: 'puzzle_complete',
    PUZZLE_EXIT: 'puzzle_exit',
    SHARE: 'share',
    DIALOG_OPEN: 'dialog_open',
    SETTING_CHANGE: 'setting_change',
    STATS_EXPORT: 'stats_export',
    STATS_IMPORT: 'stats_import',
    NEXT_PUZZLE_CLICK: 'next_puzzle_click'
});

// `target` is the array to push to (window.dataLayer in the browser, a plain
// array in tests). `getContext()` returns { puzzle, game, player, app }.
export const createTracker = ({ target, getContext = () => ({}) }) => {
    const track = (event, eventData = {}) => {
        let context = {};
        try { context = getContext() || {}; } catch (e) { }
        // Tag managers merge pushes into one model, so a field from an
        // earlier event's `event_data` would otherwise still be readable.
        target.push({ event_data: null });
        const payload = {
            event,
            schema_version: SCHEMA_VERSION,
            event_data: { ...eventData },
            puzzle: context.puzzle ?? null,
            game: context.game ?? null,
            player: context.player ?? null,
            app: context.app ?? null
        };
        target.push(payload);
        return payload;
    };
    return { track };
};

// --- Browser instance ---

const browserTarget = () => {
    if (typeof window === 'undefined') return [];
    window.dataLayer = window.dataLayer || [];
    return window.dataLayer;
};

let getBrowserContext = () => ({});
const browserTracker = createTracker({ target: browserTarget(), getContext: () => getBrowserContext() });

// game.js supplies the context once its state exists.
export const setContextProvider = (fn) => { getBrowserContext = fn; };

// Never let tracking break the game.
export const track = (event, eventData) => {
    try { return browserTracker.track(event, eventData); } catch (e) { return null; }
};

// --- Helpers for context fields ---

// 'touch' for phones and tablets, 'pointer' for mouse and trackpad.
export const inputDevice = () =>
    typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches ? 'touch' : 'pointer';

// 'standalone' when launched from the home screen as an installed app.
export const displayMode = () => {
    if (typeof window === 'undefined') return 'browser';
    if (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator?.standalone) return 'standalone';
    return 'browser';
};

// Clue types as a stable, comma-separated list, e.g. "sum,sum_odd,decreasing".
export const ruleList = (rules = []) => rules.map(r => r.rule).join(',');

// Whole seconds, so reports don't fill with fractions.
export const seconds = (ms) => Math.max(0, Math.round(ms / 1000));

// Which puzzle is today's. Everyone gets the same puzzle on the same
// calendar day in Chicago, wherever they are and whatever the DST state.

export const PUZZLE_TIME_ZONE = 'America/Chicago';
const PUZZLE_EPOCH_UTC = Date.UTC(2024, 4, 21); // 21 May 2024 is puzzle day 0
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// The Chicago calendar date at `now`, as "YYYY-MM-DD".
export const getPuzzleDate = (now = new Date()) => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: PUZZLE_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(now);
    const get = (type) => parts.find(p => p.type === type).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
};

// Whole days from the epoch to the Chicago date. Both are taken as UTC
// midnights, so time zones and DST can't shift the count.
export const getPuzzleDayIndex = (now = new Date()) => {
    const [y, m, d] = getPuzzleDate(now).split('-').map(Number);
    return Math.round((Date.UTC(y, m - 1, d) - PUZZLE_EPOCH_UTC) / MS_PER_DAY);
};

// Puzzle IDs run 1..totalPuzzles and repeat.
export const getPuzzleID = (totalPuzzles, now = new Date()) => {
    const day = getPuzzleDayIndex(now);
    return (((day % totalPuzzles) + totalPuzzles) % totalPuzzles) + 1;
};

export const formatTime = (seconds) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
};

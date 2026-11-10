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

// Weekday of puzzle day 0 (21 May 2024), Monday = 0.
const EPOCH_WEEKDAY = (new Date(PUZZLE_EPOCH_UTC).getUTCDay() + 6) % 7;
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// The weekday a puzzle ID falls on (Monday = 0). It is the same every time
// the list comes round, as long as the number of puzzles is a multiple of 7.
export const weekdayForPuzzleID = (id) => (EPOCH_WEEKDAY + id - 1) % 7;

// Puzzle IDs run 1..totalPuzzles and repeat.
export const getPuzzleID = (totalPuzzles, now = new Date()) => {
    const day = getPuzzleDayIndex(now);
    return (((day % totalPuzzles) + totalPuzzles) % totalPuzzles) + 1;
};

// Whole days from date string a to date string b ("YYYY-MM-DD").
export const daysBetween = (a, b) => {
    const toUTC = (s) => {
        const [y, m, d] = s.split('-').map(Number);
        return Date.UTC(y, m - 1, d);
    };
    return Math.round((toUTC(b) - toUTC(a)) / MS_PER_DAY);
};

// Hours, minutes and seconds on the Chicago clock at `date`.
const chicagoClock = (date) => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: PUZZLE_TIME_ZONE, hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23'
    }).formatToParts(date);
    const get = (type) => Number(parts.find(p => p.type === type).value);
    return { h: get('hour'), m: get('minute'), s: get('second') };
};

// Milliseconds until the next puzzle (midnight in Chicago). Days with a DST
// change are 23 or 25 hours long, so the first guess is checked and
// corrected by an hour if it doesn't land on midnight.
export const msUntilNextPuzzle = (now = new Date()) => {
    const { h, m, s } = chicagoClock(now);
    const secondsToday = h * 3600 + m * 60 + s;
    let target = now.getTime() - now.getMilliseconds() + (24 * 3600 - secondsToday) * 1000;
    const landed = chicagoClock(new Date(target)).h;
    if (landed === 23) target += 3600 * 1000;      // 25-hour day: one more hour to go
    else if (landed === 1) target -= 3600 * 1000;  // 23-hour day: midnight came an hour sooner
    return target - now.getTime();
};

// 4h 05m 09s
export const formatCountdown = (ms) => {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}h ${pad(m)}m ${pad(s)}s` : `${m}m ${pad(s)}s`;
};

export const formatTime = (seconds) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
};

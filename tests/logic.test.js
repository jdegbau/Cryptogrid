import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { checkRule, describeRule, ruleChecks } from '../js/rules.js';
import { countSolutions } from '../js/solver.js';
import { encodeAnswer, decodeAnswer, getAnswerGrid } from '../js/encoding.js';
import {
    getPuzzleDate, getPuzzleDayIndex, getPuzzleID, formatTime, msUntilNextPuzzle, formatCountdown,
    daysBetween, weekdayForPuzzleID
} from '../js/date.js';
import {
    readGameState, writeGameState, clearGameState, readStats, recordResult, summarizeStats, currentStreak, GAME_KEY, STATS_KEY, STATS_VERSION,
    bestStreak, guessDistribution, dailySeries, encodeStatsBackup, decodeStatsBackup, mergeStats, importStatsBackup
} from '../js/storage.js';
import { verifyPuzzles } from '../gridGenerator.js';

const puzzles = JSON.parse(readFileSync(new URL('../grids.json', import.meta.url), 'utf8'));

class MemoryStorage {
    constructor() { this.data = new Map(); }
    getItem(k) { return this.data.has(k) ? this.data.get(k) : null; }
    setItem(k, v) { this.data.set(k, String(v)); }
    removeItem(k) { this.data.delete(k); }
}

test('rules: clue checks match their wording', () => {
    assert.ok(checkRule([1, 2, 2, 1], { rule: 'palindromic' }));
    assert.ok(checkRule([1, 1, 2, 5], { rule: 'increasing' }), 'repeats allowed');
    assert.ok(!checkRule([2, 1, 3, 4], { rule: 'increasing' }));
    assert.ok(checkRule([1, 2, 3, 4], { rule: 'alternating_parity' }));
    assert.ok(!checkRule([2, 1, 4, 3], { rule: 'alternating_parity' }), 'must start odd');
    assert.ok(checkRule([2, 4, 6, 8], { rule: 'majority_even' }), 'all 4 counts as at least 3');
    assert.ok(!checkRule([2, 4, 1, 3], { rule: 'majority_even' }));
    assert.ok(checkRule([6, 7, 8, 9], { rule: 'above_threshold', target: 5 }));
    assert.ok(checkRule([1, 2, 3, 4], { rule: 'sum', target: 10 }));
    assert.ok(!checkRule([1, 2, 3, 4], { rule: 'nonsense' }));
});

test('rules: every rule has wording', () => {
    for (const rule of Object.keys(ruleChecks)) {
        assert.notEqual(describeRule({ rule, target: 5 }), 'Unknown rule', rule);
    }
    assert.equal(describeRule({ rule: 'majority_odd' }), 'At least 3 of the numbers are odd');
});

test('solver: counts solutions', () => {
    const sumRule = (t) => ({ rule: 'sum', target: t });
    const full = [[1, 2], [3, 4]];
    assert.equal(countSolutions(full, [sumRule(3), sumRule(7)], [sumRule(4), sumRule(6)]), 1);
    // One blank, constrained to a single value
    assert.equal(countSolutions([[1, null], [3, 4]], [sumRule(3), sumRule(7)], [sumRule(4), sumRule(6)]), 1);
    // Loose clues: many solutions, stops at the limit
    const loose = { rule: 'sum_even' };
    assert.equal(countSolutions([[null, null], [null, null]], [loose, loose], [loose, loose], 5), 5);
    // Impossible
    assert.equal(countSolutions([[1, 2], [3, 4]], [sumRule(4), sumRule(7)], [sumRule(4), sumRule(6)]), 0);
});

test('encoding: round-trips and hides the digits', () => {
    const grid = [[7, 8, 1, 8], [2, 9, 6, 4], [3, 5, 6, 3], [3, 1, 3, 3]];
    const encoded = encodeAnswer(grid, 42);
    assert.deepEqual(decodeAnswer(encoded, 42), grid);
    assert.ok(!encoded.includes('7,8'), 'not plain text');
    assert.notEqual(encodeAnswer(grid, 43), encoded, 'depends on puzzle id');
    assert.deepEqual(getAnswerGrid({ id: 42, answer: encoded }), grid);
    assert.deepEqual(getAnswerGrid({ id: 42, answerGrid: grid }), grid, 'legacy saves');
});

test('grids.json: every puzzle has exactly one solution and no plain answers', () => {
    assert.equal(puzzles.length % 7, 0, 'a multiple of 7 keeps puzzles on their weekday');
    assert.ok(puzzles.every(p => !('answerGrid' in p) && typeof p.answer === 'string'));
    assert.deepEqual(puzzles.map(p => p.id), puzzles.map((_, i) => i + 1));
    assert.ok(verifyPuzzles(puzzles, () => {}));
});

test('date: puzzle day follows the Chicago calendar', () => {
    // 23:30 and 00:30 Chicago time either side of midnight
    assert.equal(getPuzzleDate(new Date('2026-11-10T05:30:00Z')), '2026-11-09');
    assert.equal(getPuzzleDate(new Date('2026-11-10T06:30:00Z')), '2026-11-10');
    assert.equal(getPuzzleDayIndex(new Date('2024-05-21T12:00:00Z')), 0);
    // Across both DST changes the count goes up by exactly one per day
    for (const [a, b] of [['2026-10-31T17:00:00Z', '2026-11-01T17:00:00Z'], ['2026-11-01T17:00:00Z', '2026-11-02T17:00:00Z'],
        ['2026-03-07T17:00:00Z', '2026-03-08T17:00:00Z'], ['2026-03-08T17:00:00Z', '2026-03-09T17:00:00Z']]) {
        assert.equal(getPuzzleDayIndex(new Date(b)) - getPuzzleDayIndex(new Date(a)), 1, `${a} -> ${b}`);
    }
});

test('grids.json: 7-8 blanks each, difficulty rises through the week', () => {
    const levels = ['Easy', 'Easy', 'Medium', 'Medium', 'Hard', 'Hard', 'Expert'];
    for (const p of puzzles) {
        const blanks = p.displayGrid.flat().filter(v => v === null).length;
        assert.ok(blanks === 7 || blanks === 8, `puzzle ${p.id} has ${blanks} blanks`);
        assert.equal(p.difficulty, levels[weekdayForPuzzleID(p.id)], `puzzle ${p.id}`);
    }
});

test('date: weekday of a puzzle ID', () => {
    assert.equal(weekdayForPuzzleID(1), 1); // 21 May 2024 was a Tuesday (Monday = 0)
    assert.equal(weekdayForPuzzleID(7), 0);
    // With 154 puzzles, the ID on a given date always falls on that date's weekday
    for (const iso of ['2025-03-03T18:00:00Z', '2026-11-15T18:00:00Z', '2027-06-20T18:00:00Z']) {
        const d = new Date(iso);
        assert.equal(weekdayForPuzzleID(getPuzzleID(154, d)), (d.getUTCDay() + 6) % 7, iso);
    }
});

test('date: countdown to the next puzzle', () => {
    // 22:00 CST -> 2 hours
    assert.equal(msUntilNextPuzzle(new Date('2026-11-10T04:00:00Z')), 2 * 3600e3);
    // 23:59:30.250 CST -> 29.75 s
    assert.equal(msUntilNextPuzzle(new Date('2026-11-10T05:59:30.250Z')), 29750);
    // DST ends 1 Nov 2026 (25-hour day): from 00:30 CDT it is 24.5 hours to midnight
    assert.equal(msUntilNextPuzzle(new Date('2026-11-01T05:30:00Z')), 24.5 * 3600e3);
    // DST starts 8 Mar 2026 (23-hour day): from 00:30 CST it is 22.5 hours
    assert.equal(msUntilNextPuzzle(new Date('2026-03-08T06:30:00Z')), 22.5 * 3600e3);
    // The day before DST ends: 22:00 CDT -> 2 hours
    assert.equal(msUntilNextPuzzle(new Date('2026-10-31T03:00:00Z')), 2 * 3600e3);
    assert.equal(formatCountdown(2 * 3600e3 + 5 * 60e3 + 9e3), '2h 05m 09s');
    assert.equal(formatCountdown(29750), '0m 30s');
    assert.equal(daysBetween('2026-02-28', '2026-03-01'), 1);
});

test('date: puzzle IDs use the whole list and wrap', () => {
    assert.equal(getPuzzleID(150, new Date('2024-05-21T12:00:00Z')), 1);
    assert.equal(getPuzzleID(150, new Date('2024-10-17T12:00:00Z')), 150); // day 149
    assert.equal(getPuzzleID(150, new Date('2024-10-18T12:00:00Z')), 1);   // day 150
    assert.equal(getPuzzleID(150, new Date('2025-01-15T12:00:00Z')), 90);
    assert.equal(formatTime(65), '1:05');
});

test('storage: saved game only resumes for the same puzzle and day', () => {
    const storage = new MemoryStorage();
    writeGameState(storage, { currentPuzzle: { id: 3 }, puzzleID: 3, puzzleDate: '2026-11-10', guessesLeft: 4 });
    assert.equal(readGameState(storage, { puzzleID: 3, puzzleDate: '2026-11-10' }).guessesLeft, 4);
    assert.equal(readGameState(storage, { puzzleID: 3, puzzleDate: '2026-11-11' }), null);
    assert.equal(readGameState(storage, { puzzleID: 4, puzzleDate: '2026-11-10' }), null);
    storage.setItem(GAME_KEY, '{not json');
    assert.equal(readGameState(storage, { puzzleID: 3, puzzleDate: '2026-11-10' }), null);
    clearGameState(storage);
    assert.equal(storage.getItem(GAME_KEY), null);
});

test('storage: stats replace the entry for the same day and summarise', () => {
    const storage = new MemoryStorage();
    recordResult(storage, { date: '2026-11-09', win: false, guessesUsed: 5, timeSpent: 100, v: 2 });
    recordResult(storage, { date: '2026-11-10', win: true, guessesUsed: 1, timeSpent: 50, v: 2 });
    recordResult(storage, { date: '2026-11-10', win: true, guessesUsed: 2, timeSpent: 60, v: 2 });
    const history = readStats(storage);
    assert.equal(history.length, 2);
    const summary = summarizeStats(history);
    assert.equal(summary.played, 2);
    assert.equal(summary.wins, 1);
    assert.equal(summary.winRate, 50);
    assert.equal(summary.streak, 1);
    assert.equal(summary.avgGuesses, 3.5);
    assert.equal(summary.avgTime, 80);
    assert.deepEqual(summarizeStats([]).played, 0);
});

test('storage: old wins are corrected to count the winning guess, once', () => {
    const storage = new MemoryStorage();
    storage.setItem(STATS_KEY, JSON.stringify([
        { date: '2026-11-08', win: true, guessesUsed: 0, timeSpent: 30 },
        { date: '2026-11-09', win: false, guessesUsed: 5, timeSpent: 100 }
    ]));
    assert.deepEqual(readStats(storage).map(e => e.guessesUsed), [1, 5]);
    // Recording writes the corrected entries back; reading again leaves them alone.
    recordResult(storage, { date: '2026-11-10', win: true, guessesUsed: 3, timeSpent: 40, v: STATS_VERSION });
    assert.deepEqual(readStats(storage).map(e => e.guessesUsed), [1, 5, 3]);
    assert.deepEqual(readStats(storage).map(e => e.guessesUsed), [1, 5, 3]);
});

test('storage: streak needs consecutive days', () => {
    const e = (date, win = true) => ({ date, win, guessesUsed: 1, timeSpent: 10 });
    assert.equal(currentStreak([e('2026-11-08'), e('2026-11-09'), e('2026-11-10')], '2026-11-10'), 3);
    assert.equal(currentStreak([e('2026-11-08'), e('2026-11-09')], '2026-11-10'), 2, "today not played yet: still alive");
    assert.equal(currentStreak([e('2026-11-07'), e('2026-11-08')], '2026-11-10'), 0, 'missed yesterday');
    assert.equal(currentStreak([e('2026-11-06'), e('2026-11-08'), e('2026-11-09')], '2026-11-10'), 2, 'gap ends it');
    assert.equal(currentStreak([e('2026-11-08'), e('2026-11-09', false), e('2026-11-10')], '2026-11-10'), 1, 'loss ends it');
    assert.equal(currentStreak([e('2026-11-10', false)], '2026-11-10'), 0);
    assert.equal(currentStreak([], '2026-11-10'), 0);
});

test('share: guess line marks misses, the win and unused guesses', async () => {
    const { guessLine } = await import('../js/share.js');
    assert.equal(guessLine({ won: true, wrongGuesses: 0, total: 5 }), '✅⚪⚪⚪⚪ 1/5');
    assert.equal(guessLine({ won: true, wrongGuesses: 2, total: 5 }), '❌❌✅⚪⚪ 3/5');
    assert.equal(guessLine({ won: true, wrongGuesses: 4, total: 5 }), '❌❌❌❌✅ 5/5');
    assert.equal(guessLine({ won: false, wrongGuesses: 5, total: 5 }), '❌❌❌❌❌ X/5');
});

test('share: result text includes the streak only from 2 days', async () => {
    const { buildResultShare, withLink } = await import('../js/share.js');
    const base = { puzzleID: 12, difficulty: 'Hard', grid: '🟩🟦', won: true, wrongGuesses: 1, total: 5, timeSpent: 75, url: 'https://x.test/' };
    const one = buildResultShare({ ...base, streak: 1 });
    assert.equal(one.text, 'Pseudoku — #12 (Hard)\n\n🟩🟦\nGuesses: ❌✅⚪⚪⚪ 2/5\nTime: 1:15');
    assert.equal(one.url, 'https://x.test/');
    assert.ok(buildResultShare({ ...base, streak: 7 }).text.endsWith('\nStreak: 🔥 7'));
    assert.ok(withLink(one).endsWith('\nPlay: https://x.test/'));
});

test('share: stats text', async () => {
    const { buildStatsShare } = await import('../js/share.js');
    const summary = summarizeStats([
        { date: '2026-01-01', win: true, guessesUsed: 1, timeSpent: 90 },
        { date: '2026-01-02', win: true, guessesUsed: 0, timeSpent: 61 },
        { date: '2026-01-03', win: false, guessesUsed: 5, timeSpent: 200 },
        { date: '2026-01-04', win: true, guessesUsed: 2, timeSpent: 120 }
    ], '2026-01-04');
    const { text } = buildStatsShare(summary, { bestTime: 61, url: 'u' });
    assert.equal(text, 'My Pseudoku stats\n\nPlayed: 4\nWin rate: 75%\nStreak: 1 · Best: 2\nBest time: 1:01');
});

const game = (date, win = true, guessesUsed = 2, timeSpent = 60) => ({ date, win, guessesUsed, timeSpent, v: STATS_VERSION });

test('stats: best streak survives a loss and needs consecutive days', () => {
    assert.equal(bestStreak([]), 0);
    assert.equal(bestStreak([
        game('2026-01-01'), game('2026-01-02'), game('2026-01-03'),
        game('2026-01-04', false),
        game('2026-01-05'),
        game('2026-01-07'), game('2026-01-08')
    ]), 3);
    assert.equal(summarizeStats([game('2026-01-01'), game('2026-01-02'), game('2026-01-03', false)], '2026-01-03').bestStreak, 2);
});

test('stats: guess distribution counts wins by guess and losses', () => {
    const d = guessDistribution([game('2026-01-01', true, 1), game('2026-01-02', true, 3), game('2026-01-03', true, 3), game('2026-01-04', false, 5)]);
    assert.deepEqual(d, { wins: [1, 0, 2, 0, 0], losses: 1 });
});

test('stats: daily series fills skipped days with null', () => {
    const s = dailySeries([game('2026-02-27', true, 1, 10), game('2026-03-02', true, 1, 20)], 'timeSpent');
    assert.deepEqual(s.dates, ['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
    assert.deepEqual(s.values, [10, null, null, 20]);
    assert.deepEqual(dailySeries([], 'timeSpent'), { dates: [], values: [] });
});

test('backup: codes round-trip, reject junk and merge without overwriting', () => {
    const history = [game('2026-01-01', true, 1, 30), game('2026-01-02', false, 5, 99)];
    const code = encodeStatsBackup(history);
    assert.deepEqual(decodeStatsBackup(code), history);
    assert.deepEqual(decodeStatsBackup(`  ${code.slice(0, 20)}\n${code.slice(20)} `), history, 'whitespace from pasting is ignored');
    assert.equal(decodeStatsBackup('hello'), null);
    assert.equal(decodeStatsBackup('PSEUDOKU1:not-base64!!'), null);
    assert.equal(decodeStatsBackup('PSEUDOKU1:' + btoa('[["2026-01-01",1,9,30]]')), null, 'guesses out of range');

    const { history: merged, added } = mergeStats([game('2026-01-02', true, 2, 50)], history.concat(history));
    assert.equal(added, 1, 'duplicates and days already played are skipped');
    assert.equal(merged.find(e => e.date === '2026-01-02').win, true, 'local result kept');

    const storage = new MemoryStorage();
    recordResult(storage, game('2026-01-03'));
    assert.deepEqual(importStatsBackup(storage, code), { added: 2, total: 3 });
    assert.equal(importStatsBackup(storage, 'nope'), null);
    assert.equal(readStats(storage).length, 3);
});

test('share: hiding the timer leaves the time out', async () => {
    const { buildResultShare } = await import('../js/share.js');
    const base = { puzzleID: 1, grid: '🟦', won: true, wrongGuesses: 0, total: 5, timeSpent: 75, streak: 0, url: 'u' };
    assert.ok(buildResultShare(base).text.includes('Time: 1:15'));
    assert.ok(!buildResultShare({ ...base, showTime: false }).text.includes('Time'));
});

test('share: high-contrast squares are all different from each other', async () => {
    const { CELL_EMOJI } = await import('../js/share.js');
    for (const palette of Object.values(CELL_EMOJI)) {
        assert.equal(new Set(Object.values(palette)).size, Object.keys(palette).length);
    }
});

test('settings: defaults, and invalid saved values are ignored', async () => {
    const { readSettings, writeSettings, DEFAULT_SETTINGS, SETTINGS_KEY } = await import('../js/settings.js');
    const storage = new MemoryStorage();
    assert.deepEqual(readSettings(storage), DEFAULT_SETTINGS);
    writeSettings(storage, { theme: 'dark', highContrast: true, hideTimer: false });
    assert.deepEqual(readSettings(storage), { theme: 'dark', highContrast: true, hideTimer: false });
    storage.setItem(SETTINGS_KEY, JSON.stringify({ theme: 'purple', highContrast: 'yes' }));
    assert.deepEqual(readSettings(storage), DEFAULT_SETTINGS);
    storage.setItem(SETTINGS_KEY, '{not json');
    assert.deepEqual(readSettings(storage), DEFAULT_SETTINGS);
});

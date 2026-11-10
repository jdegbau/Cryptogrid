import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { checkRule, describeRule, ruleChecks } from '../js/rules.js';
import { countSolutions } from '../js/solver.js';
import { encodeAnswer, decodeAnswer, getAnswerGrid } from '../js/encoding.js';
import { getPuzzleDate, getPuzzleDayIndex, getPuzzleID, formatTime } from '../js/date.js';
import {
    readGameState, writeGameState, clearGameState, readStats, recordResult, summarizeStats, GAME_KEY
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
    assert.equal(puzzles.length, 150);
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
    recordResult(storage, { date: '2026-11-09', win: false, guessesUsed: 5, timeSpent: 100 });
    recordResult(storage, { date: '2026-11-10', win: true, guessesUsed: 1, timeSpent: 50 });
    recordResult(storage, { date: '2026-11-10', win: true, guessesUsed: 2, timeSpent: 60 });
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

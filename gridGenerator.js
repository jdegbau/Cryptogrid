// Pseudoku puzzle generator.
//
// Every puzzle it emits has exactly one solution: a solver counts the grids
// that satisfy the clues and the pre-filled cells, and the generator keeps
// revealing cells until that count is 1. Answers are written encoded
// (see js/encoding.js) so they can't be read at a glance.
//
// Usage:
//   node gridGenerator.js [count] [startId] > grids.json   generate puzzles (count: a multiple of 7)
//   node gridGenerator.js --verify [file]                   check a puzzle file
//   node gridGenerator.js --encode [file] > out.json        encode plain answerGrid entries

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { THRESHOLD, checkRule } from './js/rules.js';
import { weekdayForPuzzleID, WEEKDAYS } from './js/date.js';
import { countSolutions, MIN_CELL_VALUE, MAX_CELL_VALUE } from './js/solver.js';
import { encodeAnswer, getAnswerGrid } from './js/encoding.js';

const SIZE = 4;
const MIN_DISPLAY_CELLS = 8;   // pre-filled cells per puzzle (inclusive range),
const MAX_DISPLAY_CELLS = 9;   // so every puzzle has 7 or 8 blanks
const RANDOM_REVEALS = 5;      // reveal this many at random, then choose the rest greedily
const COUNT_CAP = 2000;        // stop counting solutions past this when comparing reveals
const MAX_ROW_COL_FILL = 3;    // every row and column keeps at least one blank
const SUM_RULE_MAX = 30;       // only offer "sum is N" when N is at most this
const MAX_SUM_RULES = 4;       // cap exact-sum clues per puzzle so clues stay varied

// Relative weights used when choosing which true clue to show for a line.
const weights = {
    palindromic: 0.1,
    sum_even: 0.05,
    sum_odd: 0.05,
    above_threshold: 0.1,
    below_threshold: 0.1,
    even: 0.05,
    odd: 0.05,
    increasing: 0.1,
    decreasing: 0.1,
    unique_digits: 0.05,
    alternating_parity: 0.1,
    majority_even: 0.05,
    majority_odd: 0.05,
    sum: 0.1
};

const sumOf = (arr) => arr.reduce((a, b) => a + b, 0);
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

const generateRandomGrid = (size) =>
    Array.from({ length: size }, () =>
        Array.from({ length: size }, () => randInt(MIN_CELL_VALUE, MAX_CELL_VALUE)));

// Pick one clue that is true for this line, weighted by `weights`.
const determineBestRule = (arr) => {
    const sum = sumOf(arr);
    const candidates = [
        { rule: 'palindromic' },
        { rule: 'sum_even' },
        { rule: 'sum_odd' },
        { rule: 'above_threshold', target: THRESHOLD },
        { rule: 'below_threshold', target: THRESHOLD },
        { rule: 'even' },
        { rule: 'odd' },
        { rule: 'increasing' },
        { rule: 'decreasing' },
        { rule: 'unique_digits' },
        { rule: 'alternating_parity' },
        { rule: 'majority_even' },
        { rule: 'majority_odd' },
        ...(sum <= SUM_RULE_MAX ? [{ rule: 'sum', target: sum }] : [])
    ].filter(r => checkRule(arr, r));

    if (candidates.length === 0) return { rule: 'sum', target: sum };

    const total = candidates.reduce((acc, r) => acc + weights[r.rule], 0);
    let roll = Math.random() * total;
    for (const r of candidates) {
        roll -= weights[r.rule];
        if (roll <= 0) return r;
    }
    return candidates[candidates.length - 1];
};

const determineRules = (grid) => {
    const rowRules = grid.map(row => determineBestRule(row));
    const colRules = grid[0].map((_, c) => determineBestRule(grid.map(row => row[c])));
    return { rowRules, colRules };
};

// Reveal answer cells (keeping at least one blank per row and column) until
// the puzzle has a single solution. The first few are random; after that each
// reveal is the cell that rules out the most solutions, so uniqueness comes
// with as few givens as possible. Returns null if it needs more than
// MAX_DISPLAY_CELLS.
const generateDisplayGrid = (answerGrid, rowRules, colRules) => {
    const size = answerGrid.length;
    const displayGrid = answerGrid.map(row => row.map(() => null));
    const rowFill = new Array(size).fill(0);
    const colFill = new Array(size).fill(0);
    const open = () => {
        const coords = [];
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (displayGrid[r][c] === null && rowFill[r] < MAX_ROW_COL_FILL && colFill[c] < MAX_ROW_COL_FILL) coords.push([r, c]);
            }
        }
        return shuffle(coords);
    };
    const reveal = ([r, c]) => {
        displayGrid[r][c] = answerGrid[r][c];
        rowFill[r]++;
        colFill[c]++;
    };

    for (let filled = 0; filled < MAX_DISPLAY_CELLS; filled++) {
        const options = open();
        if (options.length === 0) return null;
        let best = options[0];
        let bestCount = Infinity;
        if (filled >= RANDOM_REVEALS) {
            for (const [r, c] of options) {
                displayGrid[r][c] = answerGrid[r][c];
                const count = countSolutions(displayGrid, rowRules, colRules, COUNT_CAP);
                displayGrid[r][c] = null;
                if (count < bestCount) {
                    best = [r, c];
                    bestCount = count;
                }
                if (count === 1) break;
            }
        }
        reveal(best);
        if (filled + 1 >= MIN_DISPLAY_CELLS && countSolutions(displayGrid, rowRules, colRules) === 1) {
            return displayGrid;
        }
    }
    return null;
};

// How much searching the solver needs to prove the answer: more partial
// grids tried means the clues pin the answer down less directly.
const difficultyScore = (puzzle) => {
    const stats = {};
    countSolutions(puzzle.displayGrid, puzzle.rowRules, puzzle.colRules, 2, stats);
    const blanks = puzzle.displayGrid.flat().filter(v => v === null).length;
    return Math.log2(stats.nodes + 1) + blanks;
};

// Labels by weekday: Monday easiest, Sunday hardest.
const LEVELS = ['Easy', 'Easy', 'Medium', 'Medium', 'Hard', 'Hard', 'Expert'];

const generatePuzzle = (size) => {
    for (;;) {
        const answerGrid = generateRandomGrid(size);
        const { rowRules, colRules } = determineRules(answerGrid);
        const sumRules = [...rowRules, ...colRules].filter(r => r.rule === 'sum').length;
        if (sumRules > MAX_SUM_RULES) continue;
        const displayGrid = generateDisplayGrid(answerGrid, rowRules, colRules);
        if (displayGrid) return { answerGrid, displayGrid, rowRules, colRules };
    }
};

// Generate a pool, rank it by difficulty, and hand the easiest puzzles to
// Mondays and the hardest to Sundays (by the weekday each ID falls on).
export const generatePuzzles = (numPuzzles, size = SIZE, startId = 1, log = () => {}) => {
    const pool = [];
    for (let i = 0; i < numPuzzles; i++) {
        const puzzle = generatePuzzle(size);
        puzzle.score = difficultyScore(puzzle);
        pool.push(puzzle);
        if ((i + 1) % 10 === 0) log(`${i + 1}/${numPuzzles}`);
    }
    pool.sort((a, b) => a.score - b.score);

    const ids = Array.from({ length: numPuzzles }, (_, i) => startId + i);
    const idsByWeekday = WEEKDAYS.map((_, day) => ids.filter(id => weekdayForPuzzleID(id) === day));
    const puzzles = [];
    let next = 0;
    idsByWeekday.forEach((dayIds, day) => {
        const band = shuffle(pool.slice(next, next + dayIds.length));
        next += dayIds.length;
        dayIds.forEach((id, i) => {
            const { answerGrid, displayGrid, rowRules, colRules } = band[i];
            puzzles.push({ id, difficulty: LEVELS[day], answer: encodeAnswer(answerGrid, id), displayGrid, rowRules, colRules });
        });
    });
    return puzzles.sort((a, b) => a.id - b.id);
};

// Replace any plain answerGrid with an encoded answer.
export const encodePuzzles = (puzzles) => puzzles.map(({ answerGrid, ...rest }) => (
    answerGrid ? { id: rest.id, answer: encodeAnswer(answerGrid, rest.id), ...rest } : rest
));

// Confirm every puzzle has exactly one solution and that it matches its answer.
export const verifyPuzzles = (puzzles, log = console.error) => {
    let failures = 0;
    for (const p of puzzles) {
        const answer = getAnswerGrid(p);
        const answerOk = answer.every((row, r) => checkRule(row, p.rowRules[r])) &&
            p.colRules.every((rule, c) => checkRule(answer.map(row => row[c]), rule)) &&
            p.displayGrid.every((row, r) => row.every((v, c) => v === null || v === answer[r][c]));
        const solutions = countSolutions(p.displayGrid, p.rowRules, p.colRules, 2);
        if (!answerOk || solutions !== 1) {
            failures++;
            log(`Puzzle ${p.id}: ${!answerOk ? 'answer breaks its clues; ' : ''}` +
                `${solutions === 2 ? '2+' : solutions} solution(s)`);
        }
    }
    log(failures ? `${failures} of ${puzzles.length} puzzles failed.` : `All ${puzzles.length} puzzles have exactly one solution.`);
    return failures === 0;
};

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
    const args = process.argv.slice(2);
    const defaultFile = fileURLToPath(new URL('./grids.json', import.meta.url));
    const readPuzzles = (file) => JSON.parse(readFileSync(file || defaultFile, 'utf8'));
    if (args[0] === '--verify') {
        process.exit(verifyPuzzles(readPuzzles(args[1])) ? 0 : 1);
    } else if (args[0] === '--encode') {
        console.log(JSON.stringify(encodePuzzles(readPuzzles(args[1])), null, 2));
    } else {
        const count = parseInt(args[0], 10) || 154;
        const startId = parseInt(args[1], 10) || 1;
        if (count % 7 !== 0) console.error(`Note: ${count} is not a multiple of 7, so puzzles won't keep their weekday when the list repeats.`);
        console.log(JSON.stringify(generatePuzzles(count, SIZE, startId, console.error), null, 2));
    }
}

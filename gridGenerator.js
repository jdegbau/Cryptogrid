// Pseudoku puzzle generator.
//
// Every puzzle it emits has exactly one solution: a solver counts the grids
// that satisfy the clues and the pre-filled cells, and the generator keeps
// revealing cells until that count is 1.
//
// Usage:
//   node gridGenerator.js [count] [startId] > grids.json   generate puzzles
//   node gridGenerator.js --verify [file]                   check an existing file

const SIZE = 4;
const MIN_CELL_VALUE = 1;
const MAX_CELL_VALUE = 9;
const MIN_DISPLAY_CELLS = 8;   // pre-filled cells per puzzle (inclusive range)
const MAX_DISPLAY_CELLS = 10;
const MAX_ROW_COL_FILL = 3;    // every row and column keeps at least one blank
const THRESHOLD = 5;
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
const countEven = (arr) => arr.filter(n => n % 2 === 0).length;

// Single source of truth for what each clue means. The solver and the clue
// picker both use these, and the wording in crypticGrid.js must match them.
const ruleChecks = {
    palindromic: (arr) => arr.every((v, i) => v === arr[arr.length - 1 - i]),
    sum_even: (arr) => sumOf(arr) % 2 === 0,
    sum_odd: (arr) => sumOf(arr) % 2 === 1,
    above_threshold: (arr, t) => arr.every(n => n > t),
    below_threshold: (arr, t) => arr.every(n => n < t),
    even: (arr) => arr.every(n => n % 2 === 0),
    odd: (arr) => arr.every(n => n % 2 === 1),
    increasing: (arr) => arr.every((v, i) => i === 0 || v >= arr[i - 1]),
    decreasing: (arr) => arr.every((v, i) => i === 0 || v <= arr[i - 1]),
    unique_digits: (arr) => new Set(arr).size === arr.length,
    // First number odd, then alternating: odd, even, odd, even.
    alternating_parity: (arr) => arr.every((n, i) => n % 2 === (i % 2 === 0 ? 1 : 0)),
    // "At least 3 of the 4" (a strict majority).
    majority_even: (arr) => countEven(arr) > arr.length / 2,
    majority_odd: (arr) => arr.length - countEven(arr) > arr.length / 2,
    sum: (arr, t) => sumOf(arr) === t
};

const checkRule = (arr, rule) => ruleChecks[rule.rule](arr, rule.target);

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
    const size = grid.length;
    const rowRules = grid.map(row => determineBestRule(row));
    const colRules = [];
    for (let c = 0; c < size; c++) colRules.push(determineBestRule(grid.map(row => row[c])));
    return { rowRules, colRules };
};

// --- Solver ---------------------------------------------------------------

// All lines of length `size` that match the fixed cells (null = blank) and the rule.
const lineCandidates = (fixed, rule) => {
    const out = [];
    const line = new Array(fixed.length);
    const walk = (i) => {
        if (i === fixed.length) {
            if (checkRule(line, rule)) out.push(line.slice());
            return;
        }
        if (fixed[i] !== null) {
            line[i] = fixed[i];
            walk(i + 1);
            return;
        }
        for (let v = MIN_CELL_VALUE; v <= MAX_CELL_VALUE; v++) {
            line[i] = v;
            walk(i + 1);
        }
    };
    walk(0);
    return out;
};

// Count solutions of a puzzle, stopping once `limit` is reached.
const countSolutions = (displayGrid, rowRules, colRules, limit = 2) => {
    const size = displayGrid.length;
    const rowCands = displayGrid.map((row, r) => lineCandidates(row, rowRules[r]));
    if (rowCands.some(c => c.length === 0)) return 0;

    // For each column, the set of valid prefixes of every length, so partial
    // grids can be pruned as soon as a column goes wrong.
    const colPrefixes = [];
    for (let c = 0; c < size; c++) {
        const cands = lineCandidates(displayGrid.map(row => row[c]), colRules[c]);
        if (cands.length === 0) return 0;
        const prefixes = Array.from({ length: size + 1 }, () => new Set());
        for (const cand of cands) {
            for (let k = 1; k <= size; k++) prefixes[k].add(cand.slice(0, k).join(','));
        }
        colPrefixes.push(prefixes);
    }

    const chosen = [];
    let count = 0;
    const walk = (r) => {
        if (count >= limit) return;
        if (r === size) {
            count++;
            return;
        }
        for (const cand of rowCands[r]) {
            chosen[r] = cand;
            let ok = true;
            for (let c = 0; c < size && ok; c++) {
                const prefix = chosen.slice(0, r + 1).map(row => row[c]).join(',');
                ok = colPrefixes[c][r + 1].has(prefix);
            }
            if (ok) walk(r + 1);
            if (count >= limit) return;
        }
    };
    walk(0);
    return count;
};

// --- Generation -----------------------------------------------------------

// Reveal answer cells one at a time (in random order, keeping at least one
// blank per row and column) until the puzzle has a single solution.
// Returns null if that can't be done within MAX_DISPLAY_CELLS.
const generateDisplayGrid = (answerGrid, rowRules, colRules) => {
    const size = answerGrid.length;
    const displayGrid = answerGrid.map(row => row.map(() => null));
    const rowFill = new Array(size).fill(0);
    const colFill = new Array(size).fill(0);
    const coords = [];
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) coords.push([r, c]);
    shuffle(coords);

    let filled = 0;
    for (const [r, c] of coords) {
        if (rowFill[r] >= MAX_ROW_COL_FILL || colFill[c] >= MAX_ROW_COL_FILL) continue;
        displayGrid[r][c] = answerGrid[r][c];
        rowFill[r]++;
        colFill[c]++;
        filled++;
        if (filled >= MIN_DISPLAY_CELLS && countSolutions(displayGrid, rowRules, colRules) === 1) {
            return displayGrid;
        }
        if (filled >= MAX_DISPLAY_CELLS) return null;
    }
    return null;
};

const generatePuzzle = (id, size) => {
    for (;;) {
        const answerGrid = generateRandomGrid(size);
        const { rowRules, colRules } = determineRules(answerGrid);
        const sumRules = [...rowRules, ...colRules].filter(r => r.rule === 'sum').length;
        if (sumRules > MAX_SUM_RULES) continue;
        const displayGrid = generateDisplayGrid(answerGrid, rowRules, colRules);
        if (displayGrid) return { id, answerGrid, displayGrid, rowRules, colRules };
    }
};

const generatePuzzles = (numPuzzles, size, startId = 1) =>
    Array.from({ length: numPuzzles }, (_, i) => generatePuzzle(startId + i, size));

// Confirm every puzzle in a file has exactly one solution and that it matches answerGrid.
const verifyPuzzles = (puzzles) => {
    let failures = 0;
    for (const p of puzzles) {
        const answerOk = p.answerGrid.every((row, r) => checkRule(row, p.rowRules[r])) &&
            p.colRules.every((rule, c) => checkRule(p.answerGrid.map(row => row[c]), rule)) &&
            p.displayGrid.every((row, r) => row.every((v, c) => v === null || v === p.answerGrid[r][c]));
        const solutions = countSolutions(p.displayGrid, p.rowRules, p.colRules, 2);
        if (!answerOk || solutions !== 1) {
            failures++;
            console.error(`Puzzle ${p.id}: ${!answerOk ? 'answer breaks its clues; ' : ''}` +
                `${solutions === 2 ? '2+' : solutions} solution(s)`);
        }
    }
    console.error(failures ? `${failures} of ${puzzles.length} puzzles failed.` : `All ${puzzles.length} puzzles have exactly one solution.`);
    return failures === 0;
};

if (typeof module !== 'undefined' && require.main === module) {
    const args = process.argv.slice(2);
    if (args[0] === '--verify') {
        const file = args[1] || require('path').join(__dirname, 'grids.json');
        const puzzles = JSON.parse(require('fs').readFileSync(file, 'utf8'));
        process.exit(verifyPuzzles(puzzles) ? 0 : 1);
    } else {
        const count = parseInt(args[0], 10) || 150;
        const startId = parseInt(args[1], 10) || 1;
        console.log(JSON.stringify(generatePuzzles(count, SIZE, startId), null, 2));
    }
}

if (typeof module !== 'undefined') {
    module.exports = { countSolutions, checkRule, generatePuzzles, verifyPuzzles };
}

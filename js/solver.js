// Counts the grids that satisfy a puzzle's clues and pre-filled cells.
import { checkRule } from './rules.js';

export const MIN_CELL_VALUE = 1;
export const MAX_CELL_VALUE = 9;

// All lines that match the fixed cells (null = blank) and the rule.
export const lineCandidates = (fixed, rule) => {
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

// Count solutions, stopping once `limit` is reached. If `stats` is given,
// stats.nodes is set to the number of partial grids the search tried, a
// rough measure of how much searching (deduction) the puzzle takes.
export const countSolutions = (displayGrid, rowRules, colRules, limit = 2, stats = null) => {
    if (stats) stats.nodes = 0;
    const size = displayGrid.length;
    const rowCands = displayGrid.map((row, r) => lineCandidates(row, rowRules[r]));
    if (rowCands.some(c => c.length === 0)) return 0;

    // For each column, the valid prefixes of every length (as numbers, e.g.
    // 3,7 -> 37), so partial grids are pruned as soon as a column goes wrong.
    const colPrefixes = [];
    for (let c = 0; c < size; c++) {
        const cands = lineCandidates(displayGrid.map(row => row[c]), colRules[c]);
        if (cands.length === 0) return 0;
        const prefixes = Array.from({ length: size + 1 }, () => new Set());
        for (const cand of cands) {
            let code = 0;
            for (let k = 1; k <= size; k++) {
                code = code * 10 + cand[k - 1];
                prefixes[k].add(code);
            }
        }
        colPrefixes.push(prefixes);
    }

    let count = 0;
    // codes[r][c]: column c's prefix code after rows 0..r-1 are placed.
    const codes = Array.from({ length: size + 1 }, () => new Array(size).fill(0));
    const walk = (r) => {
        if (r === size) {
            count++;
            return;
        }
        const before = codes[r];
        const after = codes[r + 1];
        const allowed = colPrefixes.map(p => p[r + 1]);
        for (const cand of rowCands[r]) {
            if (stats) stats.nodes++;
            let ok = true;
            for (let c = 0; c < size; c++) {
                const code = before[c] * 10 + cand[c];
                if (!allowed[c].has(code)) {
                    ok = false;
                    break;
                }
                after[c] = code;
            }
            if (ok) walk(r + 1);
            if (count >= limit) return;
        }
    };
    walk(0);
    return count;
};

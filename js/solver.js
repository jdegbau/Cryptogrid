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

// Count solutions, stopping once `limit` is reached.
export const countSolutions = (displayGrid, rowRules, colRules, limit = 2) => {
    const size = displayGrid.length;
    const rowCands = displayGrid.map((row, r) => lineCandidates(row, rowRules[r]));
    if (rowCands.some(c => c.length === 0)) return 0;

    // For each column, the valid prefixes of every length, so partial grids
    // can be pruned as soon as a column goes wrong.
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

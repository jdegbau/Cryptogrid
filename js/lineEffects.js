// A short animation when a guess completes a row or column, themed on that
// line's clue: mirror arcs for a palindrome, a running total for a sum, a
// rising line for "increasing", and so on. The planning functions are pure
// (and tested); playLineEffects() draws them over the grid.
import { THRESHOLD } from './rules.js';

const SIZE = 4;

// The four values of a row or column.
export const lineValues = (grid, { kind, index }) =>
    kind === 'row' ? grid[index].slice() : grid.map(row => row[index]);

// Rows and columns whose cells are all solved. `solved` is a 4x4 grid of
// booleans (given or guessed correctly).
export const solvedLines = (solved) => {
    const lines = [];
    for (let i = 0; i < SIZE; i++) {
        if (solved[i].every(Boolean)) lines.push({ kind: 'row', index: i });
    }
    for (let i = 0; i < SIZE; i++) {
        if (solved.every(row => row[i])) lines.push({ kind: 'col', index: i });
    }
    return lines;
};

// Lines solved now that weren't before: the ones a guess just completed.
export const newlySolvedLines = (before, after) => {
    const had = new Set(solvedLines(before).map(l => `${l.kind}-${l.index}`));
    return solvedLines(after).filter(l => !had.has(`${l.kind}-${l.index}`));
};

const sumOf = (values) => values.reduce((a, b) => a + b, 0);
const isEven = (n) => n % 2 === 0;
const indexesWhere = (values, test) => values.map((v, i) => (test(v) ? i : -1)).filter(i => i >= 0);

// What to show for a solved line: an animation `type` and the text of the
// little label that pops up with it (null for none).
export const planLineEffect = (rule, values) => {
    const target = rule.target ?? THRESHOLD;
    switch (rule.rule) {
        case 'palindromic':
            return { type: 'mirror', label: null };
        case 'sum':
            return { type: 'sum', label: `= ${sumOf(values)}` };
        case 'sum_even':
            return { type: 'sum', label: `= ${sumOf(values)}, even` };
        case 'sum_odd':
            return { type: 'sum', label: `= ${sumOf(values)}, odd` };
        case 'above_threshold':
            return { type: 'rise', label: `All > ${target}` };
        case 'below_threshold':
            return { type: 'sink', label: `All < ${target}` };
        case 'even':
            return { type: 'pairs', label: 'All even' };
        case 'odd':
            return { type: 'solo', label: 'All odd' };
        case 'increasing':
            return { type: 'trend', label: values.join(' ≤ ') };
        case 'decreasing':
            return { type: 'trend', label: values.join(' ≥ ') };
        case 'unique_digits':
            return { type: 'unique', label: 'All different' };
        case 'alternating_parity':
            return { type: 'zigzag', label: 'Odd, even, odd, even' };
        case 'majority_even': {
            const match = indexesWhere(values, isEven);
            return { type: 'majority', match, label: `${match.length} of ${values.length} even` };
        }
        case 'majority_odd': {
            const match = indexesWhere(values, v => !isEven(v));
            return { type: 'majority', match, label: `${match.length} of ${values.length} odd` };
        }
        default:
            return { type: 'sweep', label: null };
    }
};

// --- Drawing ---

const SVG_NS = 'http://www.w3.org/2000/svg';
const START_MS = 900;     // after the guess has flipped in (see grid.js)
const STAGGER_MS = 1000;  // between lines completed by the same guess, so labels never overlap
const LIFETIME_MS = 1800; // how long one effect stays up (the fade starts at 1.4 s; see styles.css)

const svgEl = (tag, attrs) => {
    const el = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
};

const prefersReducedMotion = () =>
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Where the line's cells are, relative to the grid.
const measure = (grid, cells) => {
    const g = grid.getBoundingClientRect();
    return cells.map(cell => {
        const r = cell.getBoundingClientRect();
        return { x: r.left - g.left + r.width / 2, y: r.top - g.top + r.height / 2, w: r.width, h: r.height };
    });
};

// Restart a CSS animation class on a cell, `delay` ms in.
const animateCell = (cell, className, delay, vars = {}) => {
    cell.style.setProperty('--fx-delay', `${delay}ms`);
    Object.entries(vars).forEach(([k, v]) => cell.style.setProperty(k, v));
    cell.classList.remove(className);
    void cell.offsetWidth;
    cell.classList.add(className);
};

const FX_CLASSES = ['fx-pop', 'fx-rise', 'fx-sink', 'fx-up', 'fx-down', 'fx-ring', 'fx-dim'];

// A path drawn along the line, through a point per cell at `offset(i)`
// (in cell sizes) across it: up for rows, right for columns.
const linePath = (pts, isRow, offset) => pts.map((p, i) => {
    const o = offset(i) * (isRow ? p.h : p.w);
    const x = isRow ? p.x : p.x + o;
    const y = isRow ? p.y - o : p.y;
    return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
}).join(' ');

const drawPath = (svg, d, delay, extra = {}) => {
    const path = svgEl('path', { d, class: 'line-fx-stroke', pathLength: 1, ...extra });
    path.style.animationDelay = `${delay}ms`;
    svg.appendChild(path);
    return path;
};

const addChip = (layer, text, className, x, y, delay) => {
    const chip = document.createElement('div');
    chip.className = className;
    chip.textContent = text;
    chip.style.left = `${x}px`;
    chip.style.top = `${y}px`;
    chip.style.animationDelay = `${delay}ms`;
    layer.appendChild(chip);
    return chip;
};

const playOne = (grid, line, rule, values) => {
    const isRow = line.kind === 'row';
    const cells = Array.from({ length: SIZE }, (_, i) =>
        grid.querySelector(isRow
            ? `.grid-cell[data-row="${line.index}"][data-col="${i}"]`
            : `.grid-cell[data-row="${i}"][data-col="${line.index}"]`));
    if (cells.some(c => !c)) return;
    const plan = planLineEffect(rule, values);
    const pts = measure(grid, cells);
    const g = grid.getBoundingClientRect();

    const layer = document.createElement('div');
    layer.className = 'line-fx';
    layer.setAttribute('aria-hidden', 'true');
    const svg = svgEl('svg', { class: 'line-fx-svg', width: g.width, height: g.height, viewBox: `0 0 ${g.width} ${g.height}` });
    layer.appendChild(svg);
    grid.appendChild(layer);

    const label = grid.querySelector(isRow ? `.row-label[data-row="${line.index}"]` : `.column-label[data-col="${line.index}"]`);
    label?.classList.remove('label-solved');
    void label?.offsetWidth;
    label?.classList.add('label-solved');

    let labelAt = 450; // when the label chip pops in
    switch (plan.type) {
        case 'mirror': {
            // Arcs join the cells that mirror each other, outer pair first.
            [[0, 3, 0.45], [1, 2, 0.28]].forEach(([a, b, bulge], k) => {
                const A = pts[a], B = pts[b];
                const d = isRow
                    ? `M${A.x},${A.y - A.h * 0.32} C${A.x},${A.y - A.h * (0.32 + bulge * 1.4)} ${B.x},${B.y - B.h * (0.32 + bulge * 1.4)} ${B.x},${B.y - B.h * 0.32}`
                    : `M${A.x + A.w * 0.32},${A.y} C${A.x + A.w * (0.32 + bulge * 1.4)},${A.y} ${B.x + B.w * (0.32 + bulge * 1.4)},${B.y} ${B.x + B.w * 0.32},${B.y}`;
                drawPath(svg, d, k * 260);
                [A, B].forEach(P => {
                    const dot = svgEl('circle', {
                        class: 'line-fx-dot',
                        cx: isRow ? P.x : P.x + P.w * 0.32,
                        cy: isRow ? P.y - P.h * 0.32 : P.y,
                        r: 4
                    });
                    dot.style.animationDelay = `${k * 260}ms`;
                    svg.appendChild(dot);
                });
                animateCell(cells[a], 'fx-pop', k * 260 + 380);
                animateCell(cells[b], 'fx-pop', k * 260 + 380);
            });
            break;
        }
        case 'sum':
            // Add the cells up one at a time, then show the total.
            cells.forEach((cell, i) => animateCell(cell, 'fx-pop', i * 150));
            for (let i = 0; i < SIZE - 1; i++) {
                const x = (pts[i].x + pts[i + 1].x) / 2;
                const y = (pts[i].y + pts[i + 1].y) / 2;
                addChip(layer, '+', 'line-fx-plus', x, y, i * 150 + 90);
            }
            labelAt = 650;
            break;
        case 'rise':
        case 'sink': {
            const up = plan.type === 'rise';
            cells.forEach((cell, i) => {
                animateCell(cell, up ? 'fx-rise' : 'fx-sink', i * 90);
                const p = pts[i];
                const chip = addChip(layer, up ? '▲' : '▼', `line-fx-arrow ${up ? 'line-fx-arrow-up' : 'line-fx-arrow-down'}`, p.x, p.y + (up ? -p.h * 0.5 : p.h * 0.5), i * 90);
                chip.style.setProperty('--fx-travel', `${(up ? -1 : 1) * p.h * 0.45}px`);
            });
            break;
        }
        case 'pairs':
            // Even: the cells go two by two.
            cells.forEach((cell, i) => animateCell(cell, 'fx-pop', Math.floor(i / 2) * 260));
            break;
        case 'solo':
            // Odd: one at a time.
            cells.forEach((cell, i) => animateCell(cell, 'fx-pop', i * 150));
            break;
        case 'trend': {
            // A line through the cells at the height of each value.
            const min = Math.min(...values), max = Math.max(...values);
            const span = max - min || 1;
            const offset = (i) => ((values[i] - min) / span - 0.5) * 0.5;
            const path = drawPath(svg, linePath(pts, isRow, offset), 0, { 'marker-end': `url(#line-fx-head-${line.kind}-${line.index})` });
            const defs = svgEl('defs', {});
            const marker = svgEl('marker', { id: `line-fx-head-${line.kind}-${line.index}`, viewBox: '0 0 10 10', refX: 6, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' });
            marker.appendChild(svgEl('path', { d: 'M0,0 L10,5 L0,10 z', class: 'line-fx-head' }));
            defs.appendChild(marker);
            svg.insertBefore(defs, path);
            cells.forEach((cell, i) => animateCell(cell, 'fx-pop', i * 120 + 60));
            labelAt = 550;
            break;
        }
        case 'unique': {
            // Each cell lights up in a colour of its own.
            const colours = ['var(--accent)', 'var(--correct-text)', 'var(--hint-text)', 'var(--incorrect-text)'];
            cells.forEach((cell, i) => animateCell(cell, 'fx-ring', i * 130, { '--fx-colour': colours[i] }));
            break;
        }
        case 'zigzag':
            drawPath(svg, linePath(pts, isRow, i => (i % 2 === 0 ? 0.22 : -0.22)), 0);
            cells.forEach((cell, i) => animateCell(cell, i % 2 === 0 ? 'fx-up' : 'fx-down', i * 110));
            labelAt = 500;
            break;
        case 'majority':
            cells.forEach((cell, i) => (plan.match.includes(i)
                ? animateCell(cell, 'fx-ring', i * 110, { '--fx-colour': 'var(--accent)' })
                : animateCell(cell, 'fx-dim', 0)));
            break;
        default:
            cells.forEach((cell, i) => animateCell(cell, 'fx-pop', i * 90));
    }

    if (plan.label) {
        // Rows: just above the row. Columns: across the bottom of the column.
        const last = pts[SIZE - 1];
        const x = isRow ? (pts[0].x + last.x) / 2 : pts[0].x;
        const y = isRow ? pts[0].y - pts[0].h / 2 : last.y + last.h / 2;
        const chip = addChip(layer, plan.label, 'line-fx-label', x, y, labelAt);
        // Keep it inside the grid.
        const w = chip.offsetWidth;
        chip.style.left = `${Math.min(Math.max(x, w / 2), g.width - w / 2)}px`;
    }

    setTimeout(() => {
        layer.remove();
        label?.classList.remove('label-solved');
        cells.forEach(cell => cell.classList.remove(...FX_CLASSES));
    }, LIFETIME_MS);
};

// Play the effects for lines a guess just completed, one after another.
export const playLineEffects = (lines, { rowRules, colRules }, answerGrid) => {
    if (!lines.length || prefersReducedMotion()) return;
    const grid = document.getElementById('grid-cells');
    if (!grid) return;
    lines.forEach((line, k) => {
        const rule = (line.kind === 'row' ? rowRules : colRules)[line.index];
        if (!rule) return;
        setTimeout(() => playOne(grid, line, rule, lineValues(answerGrid, line)), START_MS + k * STAGGER_MS);
    });
};

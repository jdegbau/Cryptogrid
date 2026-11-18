// When a puzzle first opens, the numbers already on the grid flick through
// random digits in place, slowing down until each lands on its real value.
// Cells land in a wave from the top-left corner.
//
// The flicking digit is an overlay beside .grid-cell-content, not inside it,
// so the content's text (which readUserSolution reads) is the real number
// the whole time; it is only made transparent while the overlay covers it.

const prefersReducedMotion = () =>
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const BASE_MS = 650;       // how long the top-left cell flicks
const STEP_MS = 110;       // extra time per diagonal step, so cells land in a wave
const FIRST_TICK_MS = 45;  // digits change this fast at the start...
const LAST_TICK_MS = 150;  // ...and slow to this just before landing

// A digit from 1 to 9 other than the ones given.
const randomDigit = (...avoid) => {
    let d;
    do d = 1 + Math.floor(Math.random() * 9); while (avoid.includes(d));
    return d;
};

const rollCell = (cellDiv) => {
    const content = cellDiv.querySelector('.grid-cell-content');
    if (!content || content.querySelector('input')) return;
    const value = Number(content.textContent);
    if (!Number.isInteger(value) || value < 1 || value > 9) return;

    const step = Number(cellDiv.dataset.row) + Number(cellDiv.dataset.col);
    const duration = BASE_MS + step * STEP_MS;

    const overlay = document.createElement('div');
    overlay.className = 'cell-roll';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.color = getComputedStyle(content).color;
    let shown = randomDigit(value);
    overlay.textContent = shown;
    cellDiv.classList.add('rolling');
    cellDiv.appendChild(overlay);

    // Each change waits a little longer than the last, so it slows into the
    // landing. The real number only appears when it lands, and the same
    // digit never shows twice in a row.
    const start = performance.now();
    const tick = () => {
        const elapsed = performance.now() - start;
        if (elapsed >= duration || !overlay.isConnected) {
            overlay.remove();
            cellDiv.classList.remove('rolling');
            return;
        }
        shown = randomDigit(shown, value);
        overlay.textContent = shown;
        const t = elapsed / duration;
        const wait = FIRST_TICK_MS + (LAST_TICK_MS - FIRST_TICK_MS) * t * t;
        setTimeout(tick, Math.min(wait, duration - elapsed));
    };
    setTimeout(tick, FIRST_TICK_MS);
};

// Flick every cell that shows a number.
export const rollInNumbers = () => {
    if (prefersReducedMotion()) return;
    document.querySelectorAll('.grid-cell').forEach(rollCell);
};

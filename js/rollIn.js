// When the puzzle loads, the numbers already on the grid spin through a few
// digits like a slot-machine reel and land on their real value, stopping in
// a wave from the top-left corner.
//
// The reel is an overlay beside .grid-cell-content, not inside it, so the
// content's text (which readUserSolution reads) is the real number the whole
// time; it is only made transparent while the reel covers it.

const prefersReducedMotion = () =>
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const BASE_MS = 650;
const STEP_MS = 110;     // extra spin per diagonal step, so cells land in a wave
const STOP_MS = 300;     // the clean-up timer runs this long after the reel should land

const randomDigit = (avoid) => {
    let d;
    do d = 1 + Math.floor(Math.random() * 9); while (d === avoid);
    return d;
};

// Digits for one reel: a run of random ones (no number twice in a row),
// ending on the real value.
const reelDigits = (value, spins) => {
    const digits = [];
    let last = value;
    for (let i = 0; i < spins; i++) {
        last = randomDigit(last);
        digits.push(last);
    }
    // The digit just before the stop shouldn't match the value either.
    if (digits.at(-1) === value) digits[digits.length - 1] = randomDigit(value);
    digits.push(value);
    return digits;
};

const rollCell = (cellDiv) => {
    const content = cellDiv.querySelector('.grid-cell-content');
    if (!content || content.querySelector('input')) return;
    const value = Number(content.textContent);
    if (!Number.isInteger(value) || value < 1 || value > 9) return;

    const row = Number(cellDiv.dataset.row);
    const col = Number(cellDiv.dataset.col);
    const step = row + col;
    const digits = reelDigits(value, 6 + step);
    const duration = BASE_MS + step * STEP_MS;

    const reel = document.createElement('div');
    reel.className = 'cell-roll';
    reel.setAttribute('aria-hidden', 'true');
    reel.style.color = getComputedStyle(content).color;

    const strip = document.createElement('div');
    strip.className = 'cell-roll-strip';
    strip.style.setProperty('--roll-steps', digits.length - 1);
    // Line up the reel's window with the number's own text box, so it stops
    // exactly where the number sits and nothing jumps when the reel goes.
    const range = document.createRange();
    range.selectNodeContents(content);
    const text = range.getBoundingClientRect();
    const box = content.getBoundingClientRect();
    if (text.height > 0) {
        strip.style.setProperty('--roll-line', `${text.height}px`);
        strip.style.top = `${text.top - box.top}px`;
    }
    strip.style.animationDuration = `${duration}ms`;
    digits.forEach(d => {
        const span = document.createElement('span');
        span.textContent = d;
        strip.appendChild(span);
    });
    reel.appendChild(strip);

    cellDiv.classList.add('rolling');
    cellDiv.appendChild(reel);

    let done = false;
    const finish = () => {
        if (done) return;
        done = true;
        reel.remove();
        cellDiv.classList.remove('rolling');
    };
    strip.addEventListener('animationend', finish, { once: true });
    setTimeout(finish, duration + STOP_MS); // in case animationend never fires
};

// Roll every cell that shows a number.
export const rollInNumbers = () => {
    if (prefersReducedMotion()) return;
    document.querySelectorAll('.grid-cell').forEach(rollCell);
};

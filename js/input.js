// Cell inputs, the on-screen number pad and the guess-history popover.
import { editableInputs, clueId } from './grid.js';

const ALLOWED_KEYS = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];

// Touch screens use the number pad, so the phone keyboard stays closed and
// the grid stays in view. Pointer devices get hover popovers.
const isTouch = () => window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
const canHover = () => window.matchMedia && window.matchMedia('(hover: hover)').matches;

// How a past guess compares with the answer.
export const guessQuality = (guess, answer) => {
    const g = parseInt(guess, 10);
    if (g === answer) return 'correct';
    return Math.abs(g - answer) <= 2 ? 'hint' : 'incorrect';
};

// Flash a cell and show "Already guessed!" for a repeated value.
export const showDuplicateWarning = (cellDiv) => {
    if (cellDiv.classList.contains('duplicate')) return;
    cellDiv.classList.add('duplicate');
    const message = document.createElement('div');
    message.className = 'duplicate-message';
    message.setAttribute('role', 'alert');
    message.textContent = 'Already guessed!';
    cellDiv.appendChild(message);
    if (navigator.vibrate && isTouch()) navigator.vibrate(30);
    setTimeout(() => {
        cellDiv.classList.remove('duplicate');
        message.remove();
    }, 1600);
};

// The next empty input after (row, col), wrapping round to the start.
export const nextBlankInput = (row, col) => {
    const inputs = editableInputs().filter(i => !i.disabled);
    const current = inputs.findIndex(i => Number(i.dataset.row) === row && Number(i.dataset.col) === col);
    const ordered = [...inputs.slice(current + 1), ...inputs.slice(0, Math.max(current, 0))];
    return ordered.find(i => i.value === '') || null;
};

// Put `digit` in `input` unless it was already guessed there, then move on
// to the next blank cell. Returns whether the digit went in.
export const enterDigit = (input, digit, getGuesses) => {
    if (getGuesses().includes(digit)) {
        showDuplicateWarning(input.closest('.grid-cell'));
        return false;
    }
    input.value = digit;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    const next = nextBlankInput(Number(input.dataset.row), Number(input.dataset.col));
    if (next) next.focus();
    return true;
};

export const clearDigit = (input) => {
    input.value = '';
    input.dispatchEvent(new Event('change', { bubbles: true }));
};

// An input for a blank cell. `getGuesses()` returns the values already
// submitted for this cell; repeats are refused.
export const createCellInput = (row, col, { getGuesses }) => {
    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = isTouch() ? 'none' : 'numeric';
    input.maxLength = 1;
    input.pattern = '[1-9]';
    input.autocomplete = 'off';
    input.setAttribute('autocorrect', 'off');
    input.spellcheck = false;
    input.setAttribute('aria-describedby', `${clueId('row', row)} ${clueId('col', col)}`);
    input.dataset.row = row;
    input.dataset.col = col;

    // Digits 1-9 replace the current value unless already guessed.
    input.addEventListener('keydown', (e) => {
        if (/^[1-9]$/.test(e.key)) {
            e.preventDefault();
            enterDigit(input, e.key, getGuesses);
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
            e.preventDefault();
            clearDigit(input);
        } else if (e.key.startsWith('Arrow')) {
            e.preventDefault();
            moveFocus(row, col, e.key);
        } else if (!ALLOWED_KEYS.includes(e.key) && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
        }
    });

    // Paste and mobile keyboards that skip keydown end up here.
    let previous = '';
    input.addEventListener('change', () => { previous = input.value; });
    input.addEventListener('input', () => {
        const value = input.value.slice(-1);
        input.value = previous;
        if (/^[1-9]$/.test(value)) enterDigit(input, value, getGuesses);
    });

    // Select-all on focus so typing always replaces.
    input.addEventListener('focus', () => { previous = input.value; input.select(); });

    return input;
};

// Arrow keys move between open cells, skipping locked ones.
const moveFocus = (row, col, key) => {
    const [dr, dc] = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[key];
    for (let r = row + dr, c = col + dc; r >= 0 && r < 4 && c >= 0 && c < 4; r += dr, c += dc) {
        const target = document.querySelector(`.grid-cell input[data-row="${r}"][data-col="${c}"]`);
        if (target && !target.disabled) {
            target.focus();
            return;
        }
    }
};

// The on-screen number pad. `getTarget()` returns the input digits go to,
// and `getHistory(input)` returns [{ value, quality }] for that cell so
// the pad can mark numbers already tried.
export const setupKeypad = ({ getTarget, getHistory }) => {
    const pad = document.getElementById('keypad');
    pad.innerHTML = '';
    const keys = {};
    const addKey = (label, value, extraClass) => {
        const key = document.createElement('button');
        key.type = 'button';
        key.className = `key ${extraClass || ''}`.trim();
        key.dataset.value = value;
        if (value === 'erase') {
            key.setAttribute('aria-label', 'Erase');
            key.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6-7z"/><path d="m12.5 9.5 5 5m0-5-5 5"/></svg>';
        } else {
            key.textContent = label;
        }
        // Keep focus on the cell when a key is pressed with a mouse.
        key.addEventListener('mousedown', (e) => e.preventDefault());
        key.addEventListener('click', () => {
            const input = getTarget();
            if (!input) return;
            if (value === 'erase') clearDigit(input);
            else if (!enterDigit(input, value, () => getHistory(input).map(h => h.value))) input.focus();
            if (document.activeElement === key) input.focus({ preventScroll: true });
        });
        pad.appendChild(key);
        keys[value] = key;
    };
    for (let d = 1; d <= 9; d++) addKey(String(d), String(d));
    addKey('', 'erase', 'key-erase');

    const update = () => {
        const input = getTarget();
        pad.classList.toggle('inactive', !input);
        const history = input ? getHistory(input) : [];
        for (let d = 1; d <= 9; d++) {
            const key = keys[String(d)];
            const past = history.find(h => h.value === String(d));
            key.classList.toggle('key-incorrect', past?.quality === 'incorrect');
            key.classList.toggle('key-hint', past?.quality === 'hint');
            key.setAttribute('aria-label', past
                ? `${d}, already tried: ${past.quality === 'hint' ? 'close' : 'wrong'}`
                : String(d));
        }
    };
    update();
    return { update, hide: (hidden) => { pad.hidden = hidden; } };
};

// Popover listing the guesses already made for a cell, coloured by how
// close each was. Pointer devices only; touch screens see this on the pad.
export const attachGuessPopover = (cellDiv, popover, { getGuesses, getAnswer }) => {
    if (!canHover()) return;
    const show = () => {
        if (['correct', 'revealed', 'preset'].some(c => cellDiv.classList.contains(c))) return;
        const guesses = getGuesses();
        if (guesses.length === 0) return;
        popover.textContent = '';
        const answer = getAnswer();
        const chips = document.createElement('div');
        chips.className = 'chips-two-column';
        guesses.forEach(value => {
            const chip = document.createElement('span');
            chip.className = `guess-chip chip-${guessQuality(value, answer)}`;
            chip.textContent = value;
            chips.appendChild(chip);
        });
        popover.appendChild(chips);
        popover.hidden = false;
    };
    const hide = () => { popover.hidden = true; };

    cellDiv.addEventListener('mouseenter', show);
    cellDiv.addEventListener('mouseleave', hide);
};

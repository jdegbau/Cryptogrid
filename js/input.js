// Cell inputs and the guess-history popover.
import { editableInputs } from './grid.js';

const ALLOWED_KEYS = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];

// Flash a cell and show "Already guessed!" for a repeated value.
export const showDuplicateWarning = (cellDiv) => {
    cellDiv.classList.add('duplicate');
    const message = document.createElement('div');
    message.className = 'duplicate-message';
    message.setAttribute('role', 'alert');
    message.textContent = 'Already guessed!';
    cellDiv.appendChild(message);
    setTimeout(() => {
        cellDiv.classList.remove('duplicate');
        message.remove();
    }, 2000);
};

// The next empty input after (row, col), wrapping round to the start.
export const nextBlankInput = (row, col) => {
    const inputs = editableInputs();
    const current = inputs.findIndex(i => Number(i.dataset.row) === row && Number(i.dataset.col) === col);
    const ordered = [...inputs.slice(current + 1), ...inputs.slice(0, Math.max(current, 0))];
    return ordered.find(i => i.value === '') || null;
};

// An input for a blank cell. `getGuesses()` returns the values already
// submitted for this cell; repeats are refused.
export const createCellInput = (row, col, { getGuesses }) => {
    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.maxLength = 1;
    input.pattern = '[1-9]';
    input.autocomplete = 'off';
    input.dataset.row = row;
    input.dataset.col = col;

    // Digits 1-9 replace the current value unless already guessed.
    input.addEventListener('keydown', (e) => {
        if (/^[1-9]$/.test(e.key)) {
            e.preventDefault();
            if (getGuesses().includes(e.key)) {
                showDuplicateWarning(input.closest('.grid-cell'));
                return;
            }
            input.value = e.key;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        } else if (!ALLOWED_KEYS.includes(e.key) && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
        }
    });

    // Paste, mobile keyboards and the keydown handler above all end up here.
    input.addEventListener('input', () => {
        const value = input.value.slice(-1);
        if (!/^[1-9]$/.test(value)) {
            input.value = '';
            return;
        }
        if (getGuesses().includes(value)) {
            input.value = '';
            showDuplicateWarning(input.closest('.grid-cell'));
            return;
        }
        input.value = value;
        const next = nextBlankInput(row, col);
        if (next) next.focus();
    });

    return input;
};

// Popover listing the guesses already made for a cell, coloured by how
// close each was. Shown on hover, focus or tap.
export const attachGuessPopover = (cellDiv, popover, { getGuesses, getAnswer }) => {
    let hideTimer;
    const show = () => {
        if (['correct', 'revealed', 'preset'].some(c => cellDiv.classList.contains(c))) return;
        popover.textContent = '';
        const guesses = getGuesses();
        if (guesses.length === 0) {
            const empty = document.createElement('span');
            empty.className = 'guess-history-empty';
            empty.textContent = 'No guesses yet';
            popover.appendChild(empty);
        } else {
            const answer = getAnswer();
            const chips = document.createElement('div');
            chips.className = 'chips-two-column';
            guesses.forEach(value => {
                const chip = document.createElement('span');
                chip.className = 'guess-chip';
                chip.textContent = value;
                const guess = parseInt(value, 10);
                if (guess === answer) chip.classList.add('chip-correct');
                else if (Math.abs(guess - answer) <= 2) chip.classList.add('chip-hint');
                else chip.classList.add('chip-incorrect');
                chips.appendChild(chip);
            });
            popover.appendChild(chips);
        }
        popover.hidden = false;
        if ('ontouchstart' in window) {
            clearTimeout(hideTimer);
            hideTimer = setTimeout(() => { popover.hidden = true; }, 2500);
        }
    };
    const hide = () => { popover.hidden = true; };

    cellDiv.addEventListener('mouseenter', show);
    cellDiv.addEventListener('mouseleave', hide);
    cellDiv.addEventListener('focusin', show);
    cellDiv.addEventListener('focusout', hide);
    cellDiv.addEventListener('touchstart', show, { passive: true });
};

// One page-level listener: a tap anywhere hides the other cells' popovers.
let dismissInstalled = false;
export const installPopoverDismiss = () => {
    if (dismissInstalled) return;
    dismissInstalled = true;
    document.addEventListener('touchstart', (e) => {
        document.querySelectorAll('.guess-history-popover').forEach(popover => {
            if (!popover.parentElement.contains(e.target)) popover.hidden = true;
        });
    }, { passive: true });
};

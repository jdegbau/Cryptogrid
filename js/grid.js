// Drawing the grid and clues, reading the player's entries back, and
// marking guesses. Cells are found by their data-row / data-col attributes.
import { describeRule } from './rules.js';

export const COLUMN_LETTERS = ['A', 'B', 'C', 'D'];

export const cellKey = (row, col) => `${row}-${col}`;
export const cellAt = (row, col) => document.querySelector(`.grid-cell[data-row="${row}"][data-col="${col}"]`);
export const allCells = () => Array.from(document.querySelectorAll('.grid-cell'));
export const editableInputs = () => Array.from(document.querySelectorAll('.grid-cell input'));

export const cellName = (row, col) => `Row ${row + 1}, Column ${COLUMN_LETTERS[col]}`;

const STATUS_TEXT = {
    preset: 'given',
    correct: 'correct',
    revealed: 'answer revealed',
    incorrect: 'wrong',
    hint: 'within 2 of the answer'
};

const cellStatus = (cellDiv) =>
    ['preset', 'correct', 'revealed', 'incorrect', 'hint'].find(s => cellDiv.classList.contains(s)) || null;

// Keep screen-reader text in step with the cell's state. Inputs carry their
// own label; locked cells use a hidden text label read before the number.
export const updateCellLabel = (cellDiv) => {
    const row = Number(cellDiv.dataset.row);
    const col = Number(cellDiv.dataset.col);
    const name = cellName(row, col);
    const status = cellStatus(cellDiv);
    const input = cellDiv.querySelector('input');
    const label = cellDiv.querySelector('.cell-label');
    if (input) {
        const last = cellDiv.dataset.lastGuess;
        input.setAttribute('aria-label', status && last
            ? `${name}, last guess ${last} was ${STATUS_TEXT[status]}`
            : `${name}, enter a number from 1 to 9`);
        label.textContent = '';
    } else {
        label.textContent = `${name}, ${STATUS_TEXT[status] || 'locked'}: `;
    }
};

// A wrong or close cell whose number no longer matches the guess it was
// marked for is "edited": it has a new entry pending for the next submit.
export const updateEdited = (cellDiv) => {
    const input = cellDiv.querySelector('input');
    const marked = cellDiv.classList.contains('hint') || cellDiv.classList.contains('incorrect');
    const edited = Boolean(input && marked && cellDiv.dataset.lastGuess && input.value !== cellDiv.dataset.lastGuess);
    cellDiv.classList.toggle('edited', edited);
};

// Draws a 5x5 grid: column letters along the top, row numbers down the
// left, 4x4 cells in the middle. `createInput(row, col)` builds the input
// for each blank cell, and `setupCell(cellDiv, popover, row, col)` adds
// per-cell behaviour.
export const renderGrid = (displayGrid, { createInput, setupCell }) => {
    const container = document.getElementById('grid-cells');
    container.innerHTML = '';

    container.appendChild(document.createElement('div'));
    COLUMN_LETTERS.forEach((letter, col) => {
        const label = document.createElement('div');
        label.className = 'column-label';
        label.dataset.col = col;
        label.setAttribute('aria-hidden', 'true');
        label.textContent = letter;
        container.appendChild(label);
    });

    displayGrid.forEach((rowValues, row) => {
        const rowLabel = document.createElement('div');
        rowLabel.className = 'row-label';
        rowLabel.dataset.row = row;
        rowLabel.setAttribute('aria-hidden', 'true');
        rowLabel.textContent = String(row + 1);
        container.appendChild(rowLabel);

        rowValues.forEach((value, col) => {
            const cellDiv = document.createElement('div');
            cellDiv.className = 'grid-cell';
            cellDiv.dataset.row = row;
            cellDiv.dataset.col = col;

            const label = document.createElement('span');
            label.className = 'cell-label sr-only';

            const popover = document.createElement('div');
            popover.className = 'guess-history-popover';
            popover.setAttribute('aria-hidden', 'true');
            popover.hidden = true;

            const content = document.createElement('div');
            content.className = 'grid-cell-content';
            if (value !== null) {
                content.textContent = value;
                cellDiv.classList.add('preset');
            } else {
                content.appendChild(createInput(row, col));
            }

            cellDiv.append(label, popover, content);
            setupCell(cellDiv, popover, row, col);
            container.appendChild(cellDiv);
            updateCellLabel(cellDiv);
        });
    });
};

// IDs of the clue text, used for highlighting and as each input's
// description (so screen readers read a cell's two clues).
export const clueId = (kind, index) => `clue-${kind}-${index}`;

export const renderClues = (rowRules, colRules) => {
    const fill = (listId, kind, rules, badge, name) => {
        const list = document.getElementById(listId);
        list.innerHTML = '';
        rules.forEach((rule, i) => {
            const li = document.createElement('li');
            li.dataset.clue = `${kind}-${i}`;
            const tag = document.createElement('span');
            tag.className = 'clue-badge';
            tag.textContent = badge(i);
            const label = document.createElement('span');
            label.className = 'sr-only';
            label.textContent = `${name(i)}: `;
            const text = document.createElement('span');
            text.id = clueId(kind, i);
            text.textContent = describeRule(rule);
            li.append(tag, label, text);
            list.appendChild(li);
        });
    };
    fill('row-clues', 'row', rowRules, i => String(i + 1), i => `Row ${i + 1}`);
    fill('col-clues', 'col', colRules, i => COLUMN_LETTERS[i], i => `Column ${COLUMN_LETTERS[i]}`);
};

const ROW_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16M15 7l5 5-5 5"/></svg>';
const COL_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M7 15l5 5 5-5"/></svg>';

// Highlight the row and column for a cell: its clues in the list, its
// labels, the other cells in line with it, and the two clue cards above
// the grid. Pass null to clear the highlight. With `cards: false` the clue
// cards are left alone (hover previews), so the grid never shifts under the
// pointer.
export const highlightClues = (row, col, { cards = true } = {}) => {
    document.querySelectorAll('.clue-active, .label-active, .in-line')
        .forEach(el => el.classList.remove('clue-active', 'label-active', 'in-line'));
    const strip = document.getElementById('active-clues');
    if (row === null) {
        if (!cards) return;
        strip.innerHTML = '<div class="active-clue-empty">Tap a cell to see its clues.</div>';
        return;
    }
    document.querySelector(`li[data-clue="row-${row}"]`)?.classList.add('clue-active');
    document.querySelector(`li[data-clue="col-${col}"]`)?.classList.add('clue-active');
    document.querySelector(`.row-label[data-row="${row}"]`)?.classList.add('label-active');
    document.querySelector(`.column-label[data-col="${col}"]`)?.classList.add('label-active');
    allCells().forEach(cell => {
        const r = Number(cell.dataset.row);
        const c = Number(cell.dataset.col);
        if ((r === row) !== (c === col)) cell.classList.add('in-line');
    });
    if (!cards) return;

    const line = (label, icon, id) => {
        const div = document.createElement('div');
        div.className = 'active-clue';
        const head = document.createElement('span');
        head.className = 'active-clue-label';
        head.innerHTML = icon;
        head.append(label);
        const text = document.createElement('span');
        text.className = 'active-clue-text';
        text.textContent = document.getElementById(id)?.textContent || '';
        div.append(head, text);
        return div;
    };
    strip.textContent = '';
    strip.append(
        line(String(row + 1), ROW_ICON, clueId('row', row)),
        line(COLUMN_LETTERS[col], COL_ICON, clueId('col', col))
    );
};

// The grid as numbers: input values for open cells, text for locked ones.
// Blank inputs read as NaN.
export const readUserSolution = () => {
    const solution = [];
    allCells().forEach(cell => {
        const row = Number(cell.dataset.row);
        const col = Number(cell.dataset.col);
        solution[row] = solution[row] || [];
        const input = cell.querySelector('input');
        solution[row][col] = parseInt(input ? input.value : cell.querySelector('.grid-cell-content').textContent, 10);
    });
    return solution;
};

export const readCellStates = () => {
    const states = [];
    allCells().forEach(cell => {
        const row = Number(cell.dataset.row);
        const col = Number(cell.dataset.col);
        states[row] = states[row] || [];
        states[row][col] = cell.className.replace(/\b(shake|in-line|reveal-anim|duplicate|edited)\b/g, '').replace(/\s+/g, ' ').trim();
    });
    return states;
};

export const isSolved = (userSolution, answerGrid) =>
    answerGrid.every((row, r) => row.every((value, c) => userSolution[r][c] === value));

// Lock a cell to show `value` (used for correct and revealed cells).
const lockCell = (cellDiv, value) => {
    cellDiv.querySelector('.grid-cell-content').textContent = value;
};

// Flip a cell's colour in, staggered across the grid in reading order.
const flip = (cellDiv) => {
    const order = Number(cellDiv.dataset.row) * 4 + Number(cellDiv.dataset.col);
    cellDiv.style.setProperty('--delay', `${order * 40}ms`);
    cellDiv.classList.remove('reveal-anim');
    void cellDiv.offsetWidth; // restart the animation
    cellDiv.classList.add('reveal-anim');
    setTimeout(() => cellDiv.classList.remove('reveal-anim'), 1200);
};

// Colour each open cell by its guess: correct (locks it), hint (within 2) or incorrect.
export const markGuesses = (answerGrid) => {
    editableInputs().forEach(input => {
        const row = Number(input.dataset.row);
        const col = Number(input.dataset.col);
        const answer = answerGrid[row][col];
        const guess = parseInt(input.value, 10);
        const cellDiv = input.closest('.grid-cell');
        cellDiv.classList.remove('correct', 'incorrect', 'hint', 'edited');
        cellDiv.dataset.lastGuess = String(guess);
        flip(cellDiv);
        if (guess === answer) {
            cellDiv.classList.add('correct');
            lockCell(cellDiv, answer);
        } else if (Math.abs(guess - answer) <= 2) {
            cellDiv.classList.add('hint');
        } else {
            cellDiv.classList.add('incorrect');
        }
        updateCellLabel(cellDiv);
    });
};

export const revealAnswers = (answerGrid) => {
    editableInputs().forEach(input => {
        const row = Number(input.dataset.row);
        const col = Number(input.dataset.col);
        const cellDiv = input.closest('.grid-cell');
        cellDiv.classList.add('revealed');
        flip(cellDiv);
        lockCell(cellDiv, answerGrid[row][col]);
        updateCellLabel(cellDiv);
    });
};

// Put a saved game back: entered values, cell classes, locked answers.
// `lastGuessFor(row, col)` gives the last submitted guess for a cell, so a
// number changed since then still shows as edited.
export const restoreCells = (userSolution, cellStates, answerGrid, createInput, lastGuessFor) => {
    cellStates.forEach((rowStates, row) => {
        rowStates.forEach((className, col) => {
            const cellDiv = cellAt(row, col);
            if (!cellDiv) return;
            cellDiv.className = className;
            const content = cellDiv.querySelector('.grid-cell-content');
            if (cellDiv.classList.contains('correct') || cellDiv.classList.contains('revealed')) {
                lockCell(cellDiv, answerGrid[row][col]);
            } else if (!cellDiv.classList.contains('preset')) {
                const value = userSolution[row] && userSolution[row][col];
                let input = cellDiv.querySelector('input');
                if (!input) {
                    input = createInput(row, col);
                    content.textContent = '';
                    content.appendChild(input);
                }
                if (value) input.value = value;
                if (cellDiv.classList.contains('hint') || cellDiv.classList.contains('incorrect')) {
                    const last = lastGuessFor(row, col);
                    if (last) cellDiv.dataset.lastGuess = String(last);
                }
                updateEdited(cellDiv);
            }
            updateCellLabel(cellDiv);
        });
    });
};

// One emoji per cell for sharing; `emoji` maps each state to its square
// (see CELL_EMOJI in share.js).
export const gridEmojis = (answerGrid, emoji) =>
    answerGrid.map((rowValues, row) => rowValues.map((_, col) => {
        const cellDiv = cellAt(row, col);
        if (cellDiv.classList.contains('preset')) return emoji.preset;
        if (cellDiv.classList.contains('correct')) return emoji.correct;
        if (cellDiv.classList.contains('incorrect')) return emoji.incorrect;
        if (cellDiv.classList.contains('hint')) return emoji.hint;
        return emoji.empty;
    }).join('')).join('\n');

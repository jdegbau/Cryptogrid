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

// Draws a 6x6 grid: labels round the edge, 4x4 cells in the middle.
// `createInput(row, col)` builds the input for each blank cell, and
// `setupCell(cellDiv, popover, row, col)` adds per-cell behaviour.
export const renderGrid = (displayGrid, { createInput, setupCell }) => {
    const container = document.getElementById('grid-cells');
    container.innerHTML = '';

    const addColumnLabels = () => {
        container.appendChild(document.createElement('div'));
        COLUMN_LETTERS.forEach(letter => {
            const label = document.createElement('div');
            label.className = 'column-label';
            label.setAttribute('aria-hidden', 'true');
            label.textContent = letter;
            container.appendChild(label);
        });
        container.appendChild(document.createElement('div'));
    };
    const addRowLabel = (row) => {
        const label = document.createElement('div');
        label.className = 'row-label';
        label.setAttribute('aria-hidden', 'true');
        label.textContent = String(row + 1);
        container.appendChild(label);
    };

    addColumnLabels();
    displayGrid.forEach((rowValues, row) => {
        addRowLabel(row);
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
        addRowLabel(row);
    });
    addColumnLabels();
};

export const renderClues = (rowRules, colRules) => {
    const fill = (tbodyId, rules, name) => {
        const tbody = document.getElementById(tbodyId);
        tbody.innerHTML = '';
        rules.forEach((rule, i) => {
            const tr = document.createElement('tr');
            const labelCell = document.createElement('td');
            labelCell.textContent = name(i);
            const clueCell = document.createElement('td');
            clueCell.textContent = describeRule(rule);
            tr.append(labelCell, clueCell);
            tbody.appendChild(tr);
        });
    };
    fill('row-clues', rowRules, i => `Row ${i + 1}`);
    fill('col-clues', colRules, i => `Column ${COLUMN_LETTERS[i]}`);
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
        states[row][col] = cell.className.replace(/\bshake\b/, '').trim();
    });
    return states;
};

export const isSolved = (userSolution, answerGrid) =>
    answerGrid.every((row, r) => row.every((value, c) => userSolution[r][c] === value));

// Lock a cell to show `value` (used for correct and revealed cells).
const lockCell = (cellDiv, value) => {
    cellDiv.querySelector('.grid-cell-content').textContent = value;
};

// Colour each open cell by its guess: correct (locks it), hint (within 2) or incorrect.
export const markGuesses = (answerGrid) => {
    editableInputs().forEach(input => {
        const row = Number(input.dataset.row);
        const col = Number(input.dataset.col);
        const answer = answerGrid[row][col];
        const guess = parseInt(input.value, 10);
        const cellDiv = input.closest('.grid-cell');
        cellDiv.classList.remove('correct', 'incorrect', 'hint');
        cellDiv.dataset.lastGuess = String(guess);
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
        lockCell(cellDiv, answerGrid[row][col]);
        updateCellLabel(cellDiv);
    });
};

// Put a saved game back: entered values, cell classes, locked answers.
export const restoreCells = (userSolution, cellStates, answerGrid, createInput) => {
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
                if (value) {
                    input.value = value;
                    if (cellDiv.classList.contains('hint') || cellDiv.classList.contains('incorrect')) {
                        cellDiv.dataset.lastGuess = String(value);
                    }
                }
            }
            updateCellLabel(cellDiv);
        });
    });
};

export const gridEmojis = (answerGrid) =>
    answerGrid.map((rowValues, row) => rowValues.map((_, col) => {
        const cellDiv = cellAt(row, col);
        if (cellDiv.classList.contains('preset')) return '🟦';
        if (cellDiv.classList.contains('correct')) return '🟩';
        if (cellDiv.classList.contains('incorrect')) return '🟥';
        if (cellDiv.classList.contains('hint')) return '🟨';
        return '⬜';
    }).join('')).join('\n');

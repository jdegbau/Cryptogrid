// Entry point: game state, the submit/check flow, timer, saving and sharing.
import { getPuzzleDate, getPuzzleID, formatTime, msUntilNextPuzzle, formatCountdown } from './date.js';
import { getAnswerGrid } from './encoding.js';
import { readGameState, writeGameState, clearGameState, recordResult, readStats, summarizeStats, STATS_VERSION } from './storage.js';
import {
    cellKey, editableInputs, renderGrid, renderClues, readUserSolution, readCellStates,
    isSolved, markGuesses, revealAnswers, restoreCells, gridEmojis, highlightClues
} from './grid.js';
import { createCellInput, attachGuessPopover, setupKeypad, guessQuality } from './input.js';
import {
    setResultMessage, setEndResult, updateGuessIcons, setupDialog,
    playWinEffect, playLoseEffect, shake
} from './ui.js';
import { setupStatsDialog } from './stats.js';
import { buildResultShare, shareText, gameUrl, CELL_EMOJI } from './share.js';
import { setupSettingsDialog } from './settings.js';

const TOTAL_GUESSES = 5;
const WIN_MESSAGE = "Congratulations! You've solved the puzzle!";
const LOSE_MESSAGE = "Game over! You've used all your guesses.";
const LOAD_ERROR = "Sorry, today's puzzle couldn't be loaded.";

const storage = window.localStorage;
const HELP_SEEN_KEY = 'pseudokuSeenHelp';

const state = {
    puzzles: [],
    puzzleID: null,
    puzzleDate: null,
    puzzle: null,       // as stored in grids.json (answer encoded)
    answerGrid: null,   // decoded, kept in memory only
    guessesLeft: TOTAL_GUESSES,
    guessHistory: {},
    focusedCell: null   // [row, col] of the input with focus
};

const $ = (id) => document.getElementById(id);
const guessesFor = (row, col) => state.guessHistory[cellKey(row, col)] || [];

// --- Clock ---
// Time is worked out from timestamps rather than counted by setInterval,
// which browsers slow down in background tabs. It only runs while the page
// is visible, so time spent in another tab or app doesn't count.

const clock = { bankedMs: 0, since: null, running: false, tick: null };

const elapsedSeconds = () =>
    Math.floor((clock.bankedMs + (clock.since !== null ? Date.now() - clock.since : 0)) / 1000);

const showTime = () => { $('timer').textContent = formatTime(elapsedSeconds()); };

const pauseClock = () => {
    if (clock.since !== null) {
        clock.bankedMs += Date.now() - clock.since;
        clock.since = null;
    }
};

const resumeClock = () => {
    if (clock.running && clock.since === null && !document.hidden) clock.since = Date.now();
};

const startTimer = (fromSeconds = 0) => {
    clearInterval(clock.tick);
    clock.bankedMs = fromSeconds * 1000;
    clock.since = null;
    clock.running = true;
    resumeClock();
    showTime();
    clock.tick = setInterval(showTime, 250);
};

const stopTimer = () => {
    pauseClock();
    clock.running = false;
    clearInterval(clock.tick);
    showTime();
};

// --- Saving ---

const isGameOver = () => state.guessesLeft <= 0 || isSolved(readUserSolution(), state.answerGrid);

const saveGame = () => {
    if (!state.puzzle) return;
    writeGameState(storage, {
        guessesLeft: state.guessesLeft,
        timeSpent: elapsedSeconds(),
        guessHistory: state.guessHistory,
        currentPuzzle: state.puzzle,
        userSolution: readUserSolution(),
        cellStates: readCellStates(),
        gameOver: isGameOver(),
        puzzleID: state.puzzleID,
        puzzleDate: state.puzzleDate
    });
};

// --- Countdown to the next puzzle ---

let countdownTimer = null;
const stopCountdown = () => {
    clearInterval(countdownTimer);
    $('countdown').hidden = true;
};

const startCountdown = () => {
    const el = $('countdown');
    el.hidden = false;
    const update = () => {
        const ms = msUntilNextPuzzle();
        if (ms <= 1000 || getPuzzleDate() !== state.puzzleDate) {
            clearInterval(countdownTimer);
            el.textContent = '';
            const button = document.createElement('button');
            button.className = 'button primary';
            button.textContent = "Play today's puzzle";
            button.addEventListener('click', () => window.location.reload());
            el.appendChild(button);
            return;
        }
        el.textContent = 'Next puzzle in ';
        const time = document.createElement('strong');
        time.textContent = formatCountdown(ms);
        el.appendChild(time);
    };
    clearInterval(countdownTimer);
    update();
    countdownTimer = setInterval(update, 1000);
};

// --- Number pad ---

let keypad = null;

const inputAt = (row, col) => document.querySelector(`.grid-cell input[data-row="${row}"][data-col="${col}"]`);

// Digits from the pad go to the selected cell, if it is still open.
const keypadTarget = () => {
    if (!state.focusedCell) return null;
    const input = inputAt(...state.focusedCell);
    return input && !input.disabled ? input : null;
};

const keypadHistory = (input) => {
    const row = Number(input.dataset.row);
    const col = Number(input.dataset.col);
    return guessesFor(row, col).map(value => ({ value, quality: guessQuality(value, state.answerGrid[row][col]) }));
};

// Select the first open cell (blank ones first) so the pad works straight away.
const focusFirstOpenCell = () => {
    const inputs = editableInputs().filter(i => !i.disabled);
    const target = inputs.find(i => i.value === '') || inputs[0];
    if (target) target.focus({ preventScroll: true });
    else keypad?.update();
};

// --- Drawing ---

const makeInput = (row, col) => createCellInput(row, col, { getGuesses: () => guessesFor(row, col) });

// Clue highlight follows the focused cell; hovering a cell previews its
// clues in the list (pointer devices only).
const setupClueHighlight = (cellDiv, row, col) => {
    cellDiv.addEventListener('focusin', () => {
        state.focusedCell = [row, col];
        highlightClues(row, col);
        keypad?.update();
    });
    if (!window.matchMedia('(hover: hover)').matches) return;
    cellDiv.addEventListener('mouseenter', () => highlightClues(row, col, { cards: false }));
    cellDiv.addEventListener('mouseleave', () => {
        if (state.focusedCell) highlightClues(...state.focusedCell, { cards: false });
        else highlightClues(null, { cards: false });
    });
};

const drawPuzzle = () => {
    renderClues(state.puzzle.rowRules, state.puzzle.colRules);
    renderGrid(state.puzzle.displayGrid, {
        createInput: makeInput,
        setupCell: (cellDiv, popover, row, col) => {
            attachGuessPopover(cellDiv, popover, {
                getGuesses: () => guessesFor(row, col),
                getAnswer: () => state.answerGrid[row][col]
            });
            setupClueHighlight(cellDiv, row, col);
        }
    });
    updateGuessIcons(state.guessesLeft, TOTAL_GUESSES);
    const info = $('puzzle-info');
    info.textContent = `Puzzle #${state.puzzleID}`;
    if (state.puzzle.difficulty) {
        const chip = document.createElement('span');
        chip.className = 'difficulty';
        chip.textContent = state.puzzle.difficulty;
        info.append(chip);
    }
    $('keypad').hidden = false;
    $('active-clues').classList.remove('concealed');
    highlightClues(null);
};

// --- End of game ---

// `restoring` is true when reloading a game that already ended: show the
// final state without replaying the effects or recording stats again.
const endGame = (won, { restoring = false } = {}) => {
    stopTimer();
    $('check-button').hidden = true;
    const shareButton = $('share-button');
    shareButton.hidden = false;
    shareButton.classList.toggle('glow', !restoring);

    setEndResult(won ? WIN_MESSAGE : LOSE_MESSAGE, won ? '🎉' : '❌', restoring ? null : (won ? 'win' : 'lose'));
    editableInputs().forEach(input => { input.disabled = true; });
    $('keypad').hidden = true;
    $('active-clues').classList.add('concealed');
    highlightClues(null);
    state.focusedCell = null;
    if (document.activeElement && document.activeElement.closest?.('.grid-cell')) shareButton.focus({ preventScroll: true });
    startCountdown();

    // Submitted guesses that weren't the solution; a win adds the winning one.
    const wrongGuesses = TOTAL_GUESSES - state.guessesLeft;
    const guessesUsed = won ? wrongGuesses + 1 : wrongGuesses;
    const timeSpent = elapsedSeconds();
    if (!restoring) {
        if (won) playWinEffect(); else playLoseEffect();
        recordResult(storage, { date: state.puzzleDate, win: won, guessesUsed, timeSpent, v: STATS_VERSION });
    }

    // Built on click so it follows the current settings.
    const buildShare = () => {
        const { highContrast, hideTimer } = settings.get();
        return buildResultShare({
            puzzleID: state.puzzleID,
            difficulty: state.puzzle.difficulty,
            grid: gridEmojis(state.answerGrid, highContrast ? CELL_EMOJI.highContrast : CELL_EMOJI.standard),
            won,
            wrongGuesses,
            total: TOTAL_GUESSES,
            timeSpent,
            showTime: !hideTimer,
            streak: summarizeStats(readStats(storage), state.puzzleDate).streak,
            url: gameUrl()
        });
    };
    shareButton.onclick = () => shareText(buildShare(), shareButton);
};

// --- Submitting a guess ---

const refuseSubmit = (inputs, message) => {
    shake(inputs.map(input => input.closest('.grid-cell')));
    setResultMessage(message);
    inputs[0].focus();
};

const checkSolution = () => {
    const button = $('check-button');
    button.disabled = true;
    const enableAfter = (ms) => setTimeout(() => { button.disabled = false; }, ms);

    const inputs = editableInputs();
    const empty = inputs.filter(input => input.value === '');
    if (empty.length) {
        refuseSubmit(empty, 'Fill in every cell before submitting.');
        enableAfter(1000);
        return;
    }
    const repeats = inputs.filter(input => guessesFor(Number(input.dataset.row), Number(input.dataset.col)).includes(input.value));
    if (repeats.length) {
        refuseSubmit(repeats, 'You cannot submit with a previously guessed value!');
        enableAfter(1000);
        return;
    }

    inputs.forEach(input => {
        const key = cellKey(input.dataset.row, input.dataset.col);
        state.guessHistory[key] = state.guessHistory[key] || [];
        state.guessHistory[key].push(input.value);
    });
    markGuesses(state.answerGrid);

    if (isSolved(readUserSolution(), state.answerGrid)) {
        endGame(true);
    } else {
        state.guessesLeft--;
        updateGuessIcons(state.guessesLeft, TOTAL_GUESSES);
        if (state.guessesLeft <= 0) {
            revealAnswers(state.answerGrid);
            endGame(false);
        } else {
            const left = state.guessesLeft === 1 ? '1 guess left' : `${state.guessesLeft} guesses left`;
            setResultMessage(`Not quite. ${left}.`);
            focusFirstOpenCell();
        }
    }
    keypad?.update();
    enableAfter(3000);
    saveGame();
};

// --- Loading ---

const guessesLeftMessage = () =>
    state.guessesLeft === TOTAL_GUESSES
        ? `Fill the grid, then submit. You have ${TOTAL_GUESSES} guesses.`
        : `You have ${state.guessesLeft} guess${state.guessesLeft === 1 ? '' : 'es'} left.`;

const startPuzzle = (puzzle) => {
    state.puzzle = puzzle;
    state.answerGrid = getAnswerGrid(puzzle);
    state.focusedCell = null;
};

const resumeOrStart = () => {
    stopTimer();
    stopCountdown();
    const saved = readGameState(storage, { puzzleID: state.puzzleID, puzzleDate: state.puzzleDate });
    if (saved) {
        startPuzzle(saved.currentPuzzle);
        state.guessesLeft = saved.guessesLeft;
        state.guessHistory = saved.guessHistory || {};
        clock.bankedMs = (saved.timeSpent || 0) * 1000;
        drawPuzzle();
        restoreCells(saved.userSolution, saved.cellStates, state.answerGrid, makeInput);
        if (saved.gameOver) {
            endGame(state.guessesLeft > 0, { restoring: true });
        } else {
            setResultMessage(guessesLeftMessage());
            startTimer(saved.timeSpent || 0);
            focusFirstOpenCell();
        }
        return;
    }

    clearGameState(storage);
    const puzzle = state.puzzles.find(p => p.id === state.puzzleID);
    if (!puzzle) {
        setResultMessage(LOAD_ERROR);
        return;
    }
    startPuzzle(puzzle);
    state.guessesLeft = TOTAL_GUESSES;
    state.guessHistory = {};
    drawPuzzle();
    setResultMessage(guessesLeftMessage());
    startTimer(0);
    focusFirstOpenCell();
};

// Admin override: clear all saved data and start today's puzzle afresh.
// Only on a local copy, so it isn't sitting in every player's console.
const isLocal = ['localhost', '127.0.0.1', '[::1]', ''].includes(window.location.hostname);
if (isLocal) window.__PSEUDOKU_ADMIN_RESET = () => {
    try { storage.clear(); } catch (e) { }
    $('check-button').hidden = false;
    $('share-button').hidden = true;
    resumeOrStart();
    console.log('%cPseudoku: FULL game state and all saved data have been reset.', 'color: #6200ea; font-weight: bold;');
};

let settings = null;

const init = async () => {
    settings = setupSettingsDialog(storage, setupDialog);
    setupStatsDialog(storage, () => state.puzzleDate || getPuzzleDate());
    const help = setupDialog($('help-modal'), $('help-button'), [$('help-close'), $('help-start')]);
    keypad = setupKeypad({ getTarget: keypadTarget, getHistory: keypadHistory });
    $('check-button').addEventListener('click', checkSolution);

    // First visit: show how to play once.
    let seenHelp = true;
    try { seenHelp = storage.getItem(HELP_SEEN_KEY) === '1'; } catch (e) { }
    if (!seenHelp) {
        try { storage.setItem(HELP_SEEN_KEY, '1'); } catch (e) { }
        help.open(null);
        $('help-modal').addEventListener('close', focusFirstOpenCell, { once: true });
    }

    // Pause the clock and save when the page is hidden (switching tabs or
    // apps); on phones that's often the last chance before it is closed.
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            pauseClock();
            saveGame();
        } else {
            resumeClock();
            showTime();
        }
    });
    window.addEventListener('pagehide', saveGame);
    window.addEventListener('beforeunload', saveGame);

    try {
        const response = await fetch('grids.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        state.puzzles = await response.json();
    } catch (error) {
        console.error('Error loading puzzles:', error);
        setResultMessage(LOAD_ERROR);
        return;
    }
    // The puzzle list is needed first: today's ID depends on its length.
    state.puzzleDate = getPuzzleDate();
    state.puzzleID = getPuzzleID(state.puzzles.length);
    resumeOrStart();
};

init();

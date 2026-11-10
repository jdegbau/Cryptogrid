// Entry point: game state, the submit/check flow, timer, saving and sharing.
import { getPuzzleDate, getPuzzleID, formatTime } from './date.js';
import { getAnswerGrid } from './encoding.js';
import { readGameState, writeGameState, clearGameState, recordResult } from './storage.js';
import {
    cellKey, editableInputs, renderGrid, renderClues, readUserSolution, readCellStates,
    isSolved, markGuesses, revealAnswers, restoreCells, gridEmojis
} from './grid.js';
import { createCellInput, attachGuessPopover, installPopoverDismiss } from './input.js';
import {
    setResultMessage, setEndResult, showToast, updateGuessIcons, setupTabs,
    playWinEffect, playLoseEffect, shake
} from './ui.js';
import { setupStatsDialog } from './stats.js';

const TOTAL_GUESSES = 5;
const WIN_MESSAGE = "Congratulations! You've solved the puzzle!";
const LOSE_MESSAGE = "Game over! You've used all your guesses.";
const LOAD_ERROR = "Sorry, today's puzzle couldn't be loaded.";

const storage = window.localStorage;

const state = {
    puzzles: [],
    puzzleID: null,
    puzzleDate: null,
    puzzle: null,       // as stored in grids.json (answer encoded)
    answerGrid: null,   // decoded, kept in memory only
    guessesLeft: TOTAL_GUESSES,
    timeSpent: 0,
    guessHistory: {},
    timer: null
};

const $ = (id) => document.getElementById(id);
const guessesFor = (row, col) => state.guessHistory[cellKey(row, col)] || [];

// --- Timer ---

const showTime = () => { $('timer').textContent = `Time: ${formatTime(state.timeSpent)}`; };
const stopTimer = () => clearInterval(state.timer);
const startTimer = () => {
    stopTimer();
    showTime();
    state.timer = setInterval(() => {
        state.timeSpent++;
        showTime();
    }, 1000);
};

// --- Saving ---

const isGameOver = () => state.guessesLeft <= 0 || isSolved(readUserSolution(), state.answerGrid);

const saveGame = () => {
    if (!state.puzzle) return;
    writeGameState(storage, {
        guessesLeft: state.guessesLeft,
        timeSpent: state.timeSpent,
        guessHistory: state.guessHistory,
        currentPuzzle: state.puzzle,
        userSolution: readUserSolution(),
        cellStates: readCellStates(),
        gameOver: isGameOver(),
        puzzleID: state.puzzleID,
        puzzleDate: state.puzzleDate
    });
};

// --- Drawing ---

const makeInput = (row, col) => createCellInput(row, col, { getGuesses: () => guessesFor(row, col) });

const drawPuzzle = () => {
    renderGrid(state.puzzle.displayGrid, {
        createInput: makeInput,
        setupCell: (cellDiv, popover, row, col) => attachGuessPopover(cellDiv, popover, {
            getGuesses: () => guessesFor(row, col),
            getAnswer: () => state.answerGrid[row][col]
        })
    });
    renderClues(state.puzzle.rowRules, state.puzzle.colRules);
    updateGuessIcons(state.guessesLeft, TOTAL_GUESSES);
};

// --- End of game ---

const shareScore = async (text) => {
    if (navigator.share) {
        try {
            await navigator.share({ text });
        } catch (err) {
            if (err.name !== 'AbortError') showToast("Couldn't open the share menu.");
        }
        return;
    }
    try {
        await navigator.clipboard.writeText(text);
        showToast('Score copied to clipboard!');
    } catch (err) {
        showToast("Couldn't copy your score.");
    }
};

// `restoring` is true when reloading a game that already ended: show the
// final state without replaying the effects or recording stats again.
const endGame = (won, { restoring = false } = {}) => {
    stopTimer();
    showTime();
    $('check-button').hidden = true;
    const shareButton = $('share-button');
    shareButton.hidden = false;
    shareButton.classList.toggle('glow', !restoring);

    setEndResult(won ? WIN_MESSAGE : LOSE_MESSAGE, won ? '🎉' : '❌', restoring ? null : (won ? 'win' : 'lose'));
    editableInputs().forEach(input => { input.disabled = true; });

    const guessesUsed = TOTAL_GUESSES - state.guessesLeft;
    if (!restoring) {
        if (won) playWinEffect(); else playLoseEffect();
        recordResult(storage, { date: state.puzzleDate, win: won, guessesUsed, timeSpent: state.timeSpent });
    }

    const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
    const guessStatus = numberEmojis.map((emoji, i) => (i < guessesUsed ? '❌' : emoji)).join('');
    const url = window.location.origin + window.location.pathname;
    const shareText = `Pseudoku — #${state.puzzleID}\n\n${gridEmojis(state.answerGrid)}\nGuesses: ${guessStatus}\nTime: ${formatTime(state.timeSpent)}\nPlay: ${url}`;
    shareButton.onclick = () => shareScore(shareText);
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
            setResultMessage(`Incorrect! You have ${state.guessesLeft} guesses left.`);
        }
    }
    enableAfter(3000);
    saveGame();
};

// --- Loading ---

const startPuzzle = (puzzle) => {
    state.puzzle = puzzle;
    state.answerGrid = getAnswerGrid(puzzle);
};

const resumeOrStart = () => {
    stopTimer();
    const saved = readGameState(storage, { puzzleID: state.puzzleID, puzzleDate: state.puzzleDate });
    if (saved) {
        startPuzzle(saved.currentPuzzle);
        state.guessesLeft = saved.guessesLeft;
        state.timeSpent = saved.timeSpent;
        state.guessHistory = saved.guessHistory || {};
        drawPuzzle();
        restoreCells(saved.userSolution, saved.cellStates, state.answerGrid, makeInput);
        if (saved.gameOver) {
            endGame(state.guessesLeft > 0, { restoring: true });
        } else {
            setResultMessage(`You have ${state.guessesLeft} guesses left.`);
            startTimer();
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
    state.timeSpent = 0;
    state.guessHistory = {};
    drawPuzzle();
    setResultMessage(`You have ${state.guessesLeft} guesses left.`);
    startTimer();
};

// Admin override: clear all saved data and start today's puzzle afresh.
window.__PSEUDOKU_ADMIN_RESET = () => {
    try { storage.clear(); } catch (e) { }
    $('check-button').hidden = false;
    $('share-button').hidden = true;
    resumeOrStart();
    console.log('%cPseudoku: FULL game state and all saved data have been reset.', 'color: #6200ea; font-weight: bold;');
};

const init = async () => {
    setupTabs();
    setupStatsDialog(storage);
    installPopoverDismiss();
    $('check-button').addEventListener('click', checkSolution);
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

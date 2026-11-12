// Entry point: game state, the submit/check flow, timer, saving and sharing.
import { getPuzzleDate, getPuzzleID, formatTime, msUntilNextPuzzle, formatCountdown, weekdayForPuzzleID, WEEKDAYS } from './date.js';
import { getAnswerGrid } from './encoding.js';
import { readGameState, readAnyGameState, writeGameState, clearGameState, recordResult, readStats, summarizeStats, STATS_VERSION } from './storage.js';
import {
    cellKey, editableInputs, renderGrid, renderClues, readUserSolution, readCellStates,
    isSolved, markGuesses, revealAnswers, restoreCells, gridEmojis, highlightClues, updateEdited
} from './grid.js';
import { createCellInput, attachGuessPopover, setupKeypad, guessQuality } from './input.js';
import {
    setResultMessage, setEndResult, updateGuessIcons, setupDialog,
    playWinEffect, playLoseEffect, shake
} from './ui.js';
import { setupStatsDialog } from './stats.js';
import { buildResultShare, shareText, gameUrl, CELL_EMOJI } from './share.js';
import { setupSettingsDialog } from './settings.js';
import { track, EVENTS, setContextProvider, inputDevice, displayMode, ruleList, seconds } from './analytics.js';

const TOTAL_GUESSES = 5;
const WIN_MESSAGE = "Congratulations! You've solved the puzzle!";
const LOSE_MESSAGE = "Game over! You've used all your guesses.";
const LOAD_ERROR = "Sorry, today's puzzle couldn't be loaded.";

const storage = window.localStorage;
const HELP_SEEN_KEY = 'pseudokuSeenHelp';
// The puzzle this tab is on. sessionStorage lasts as long as the tab, through
// reloads (including a phone reloading a tab it had unloaded in the
// background), but not into new tabs.
const TAB_PUZZLE_KEY = 'pseudokuTabPuzzle';

const state = {
    puzzles: [],
    puzzleID: null,
    puzzleDate: null,
    puzzle: null,       // as stored in grids.json (answer encoded)
    answerGrid: null,   // decoded, kept in memory only
    guessesLeft: TOTAL_GUESSES,
    guessHistory: {},
    focusedCell: null,  // [row, col] of the input with focus
    started: false,     // a digit has been entered (puzzle_start sent)
    firstVisit: false   // first time this browser has opened the game
};

// Per-guess counters for analytics, reset after each submit.
const entryCounts = { keyboard: 0, keypad: 0, refused: 0 };
let lastGuessAt = null;  // elapsed ms at the previous submit (or the start)
let lastSavedAt = 0;     // savedAt of the save this tab last wrote or loaded
let shownAt = 0;         // performance.now() when the puzzle was drawn

const $ = (id) => document.getElementById(id);
const guessesFor = (row, col) => state.guessHistory[cellKey(row, col)] || [];

// --- Clock ---
// Wall-clock time from the first digit entered to the end of the game. It
// keeps running while the page is hidden or closed, so the time is the
// same whichever tab or device-wake it is read from. setInterval only
// refreshes the display; the time itself comes from the start timestamp.

const clock = { startedAt: null, finalMs: null, tick: null };

const elapsedMs = () => clock.finalMs ??
    (clock.startedAt !== null ? Math.max(0, Date.now() - clock.startedAt) : 0);
const elapsedSeconds = () => Math.floor(elapsedMs() / 1000);

const showTime = () => { $('timer').textContent = formatTime(elapsedSeconds()); };

// startedAt is an epoch ms timestamp, or null if no digit is in yet.
const startTimer = (startedAt) => {
    clearInterval(clock.tick);
    clock.startedAt = startedAt;
    clock.finalMs = null;
    showTime();
    if (startedAt !== null) clock.tick = setInterval(showTime, 250);
};

const stopTimer = () => {
    if (clock.finalMs === null) clock.finalMs = elapsedMs();
    clearInterval(clock.tick);
    showTime();
};

const resetClock = () => {
    clearInterval(clock.tick);
    clock.startedAt = null;
    clock.finalMs = null;
};

// --- Saving ---

const isGameOver = () => state.guessesLeft <= 0 || isSolved(readUserSolution(), state.answerGrid);

// --- Analytics context ---
// Sent with every data-layer event; see js/analytics.js and docs/tracking.md.

const openCellCount = () => state.puzzle ? state.puzzle.displayGrid.flat().filter(v => v === null).length : 0;
const solvedCellCount = () => document.querySelectorAll('.grid-cell.correct').length;

// Submitted guesses so far: every submit adds one to each cell still open,
// so the longest history is the number of submits.
const guessesSubmitted = () => Math.max(0, ...Object.values(state.guessHistory).map(h => h.length));

const gameStatus = () => {
    if (!state.puzzle || !state.answerGrid) return 'loading';
    if (state.guessesLeft <= 0) return 'lost';
    if (isSolved(readUserSolution(), state.answerGrid)) return 'won';
    return state.started ? 'in_progress' : 'not_started';
};

const analyticsContext = () => {
    const today = state.puzzleDate || getPuzzleDate();
    const summary = summarizeStats(readStats(storage), today);
    const prefs = settings?.get() || {};
    const p = state.puzzle;
    return {
        puzzle: p ? {
            puzzle_id: state.puzzleID,
            puzzle_date: state.puzzleDate,
            difficulty: p.difficulty || null,
            weekday: WEEKDAYS[weekdayForPuzzleID(state.puzzleID)],
            row_rules: ruleList(p.rowRules),
            col_rules: ruleList(p.colRules),
            cells_open: openCellCount()
        } : null,
        game: {
            status: gameStatus(),
            guesses_submitted: guessesSubmitted(),
            guesses_left: state.guessesLeft,
            guesses_total: TOTAL_GUESSES,
            cells_solved: solvedCellCount(),
            time_spent_sec: seconds(elapsedMs())
        },
        player: {
            first_visit: state.firstVisit,
            games_played: summary.played,
            games_won: summary.wins,
            win_rate: Math.round(summary.winRate),
            current_streak: summary.streak,
            best_streak: summary.bestStreak,
            theme: prefs.theme ?? null,
            high_contrast: prefs.highContrast ?? null,
            hide_timer: prefs.hideTimer ?? null
        },
        app: {
            input_device: inputDevice(),
            display_mode: displayMode()
        }
    };
};

// A digit typed or tapped into a cell. The first one starts the puzzle.
const onEntry = (e) => {
    const { source, accepted } = e.detail;
    if (!accepted) { entryCounts.refused++; return; }
    entryCounts[source] = (entryCounts[source] || 0) + 1;
    if (!state.started && gameStatus() === 'not_started') {
        state.started = true;
        if (clock.startedAt === null) startTimer(Date.now());
        track(EVENTS.PUZZLE_START, { entry_source: source, seconds_to_first_entry: seconds(performance.now() - shownAt) });
        saveGame();  // so the start time survives the page being closed
    }
};

// The saved game for today's puzzle, if any.
const readSaved = () => readGameState(storage, { puzzleID: state.puzzleID, puzzleDate: state.puzzleDate });

// Another tab has saved this puzzle since this one last saved or loaded,
// so this tab's board and clock are out of date.
const isStale = (saved) => Boolean(saved) && (saved.savedAt || 0) > lastSavedAt;

// The save slot holds a later day's puzzle, started in another tab while
// this one carried on with an earlier day's. Don't overwrite it.
const laterDaySaved = () => {
    const any = readAnyGameState(storage);
    return Boolean(any && typeof any.puzzleDate === 'string' && any.puzzleDate > state.puzzleDate);
};

// Saved time in ms; older saves only kept whole seconds.
const savedTimeMs = (saved) => Number.isFinite(saved.timeSpentMs) ? saved.timeSpentMs : (saved.timeSpent || 0) * 1000;

const saveGame = () => {
    if (!state.puzzle) return;
    // Never overwrite a newer save from another tab with this tab's older
    // board and clock; this tab picks the newer one up when it is shown.
    if (isStale(readSaved()) || laterDaySaved()) return;
    lastSavedAt = Math.max(Date.now(), lastSavedAt + 1);
    writeGameState(storage, {
        guessesLeft: state.guessesLeft,
        timeSpent: elapsedSeconds(),
        timeSpentMs: Math.round(elapsedMs()),
        startedAt: clock.startedAt,
        savedAt: lastSavedAt,
        guessHistory: state.guessHistory,
        currentPuzzle: state.puzzle,
        userSolution: readUserSolution(),
        cellStates: readCellStates(),
        gameOver: isGameOver(),
        puzzleID: state.puzzleID,
        puzzleDate: state.puzzleDate,
        started: state.started
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
            button.addEventListener('click', () => {
                track(EVENTS.NEXT_PUZZLE_CLICK, {});
                try { sessionStorage.removeItem(TAB_PUZZLE_KEY); } catch (e) { }
                window.location.reload();
            });
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
            cellDiv.addEventListener('change', () => updateEdited(cellDiv));
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
        // After recordResult, so the player context includes this game.
        track(EVENTS.PUZZLE_COMPLETE, {
            result: won ? 'win' : 'loss',
            guesses_used: guessesUsed,
            wrong_guesses: wrongGuesses,
            time_spent_sec: timeSpent,
            cells_solved: solvedCellCount(),
            cells_open: openCellCount()
        });
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
    shareButton.onclick = async () => {
        const method = await shareText(buildShare(), shareButton);
        track(EVENTS.SHARE, { content_type: 'result', method, result: won ? 'win' : 'loss' });
    };
};

// --- Submitting a guess ---

const refuseSubmit = (inputs, message, reason) => {
    track(EVENTS.GUESS_REJECTED, { reason, cells_affected: inputs.length, guess_number: guessesSubmitted() + 1 });
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
        refuseSubmit(empty, 'Fill in every cell before submitting.', 'incomplete');
        enableAfter(1000);
        return;
    }
    const repeats = inputs.filter(input => guessesFor(Number(input.dataset.row), Number(input.dataset.col)).includes(input.value));
    if (repeats.length) {
        refuseSubmit(repeats, 'You cannot submit with a previously guessed value!', 'repeated_value');
        enableAfter(1000);
        return;
    }

    inputs.forEach(input => {
        const key = cellKey(input.dataset.row, input.dataset.col);
        state.guessHistory[key] = state.guessHistory[key] || [];
        state.guessHistory[key].push(input.value);
    });
    // How this guess scored, counted before the correct cells lock.
    const scored = { correct: 0, hint: 0, incorrect: 0 };
    inputs.forEach(input => {
        scored[guessQuality(input.value, state.answerGrid[Number(input.dataset.row)][Number(input.dataset.col)])]++;
    });
    markGuesses(state.answerGrid);
    const now = elapsedMs();
    const guessData = {
        guess_number: guessesSubmitted(),
        cells_checked: inputs.length,
        cells_correct: scored.correct,
        cells_close: scored.hint,
        cells_wrong: scored.incorrect,
        seconds_since_last_guess: seconds(now - (lastGuessAt ?? 0)),
        keyboard_entries: entryCounts.keyboard,
        keypad_entries: entryCounts.keypad,
        refused_entries: entryCounts.refused
    };
    lastGuessAt = now;
    Object.keys(entryCounts).forEach(k => { entryCounts[k] = 0; });

    const solved = isSolved(readUserSolution(), state.answerGrid);
    if (!solved) state.guessesLeft--;
    // Sent before puzzle_complete, so the guess comes first in reports.
    track(EVENTS.GUESS_SUBMIT, { ...guessData, result: solved ? 'solved' : 'not_solved' });

    if (solved) {
        endGame(true);
    } else {
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
    Object.keys(entryCounts).forEach(k => { entryCounts[k] = 0; });
};

const resumeOrStart = () => {
    resetClock();
    stopCountdown();
    shownAt = performance.now();
    const saved = readSaved();
    if (saved) {
        lastSavedAt = saved.savedAt || 0;
        startPuzzle(saved.currentPuzzle);
        state.guessesLeft = saved.guessesLeft;
        state.guessHistory = saved.guessHistory || {};
        // Saves from before analytics have no flag: any guess means started.
        state.started = saved.started === true || Object.keys(state.guessHistory).length > 0;
        lastGuessAt = savedTimeMs(saved);
        drawPuzzle();
        restoreCells(saved.userSolution, saved.cellStates, state.answerGrid, makeInput, (row, col) => guessesFor(row, col).at(-1));
        if (saved.gameOver) {
            clock.finalMs = savedTimeMs(saved);
            endGame(state.guessesLeft > 0, { restoring: true });
            return 'resumed_finished';
        }
        $('check-button').hidden = false;
        $('share-button').hidden = true;
        setResultMessage(guessesLeftMessage());
        // Saves from before the wall clock have no start time: work one
        // out from the time they had counted.
        startTimer(Number.isFinite(saved.startedAt) ? saved.startedAt
            : state.started ? Date.now() - savedTimeMs(saved) : null);
        focusFirstOpenCell();
        return 'resumed';
    }

    // Only clear an earlier day's save; a later day's (from another tab)
    // is left alone, and this tab won't save over it.
    if (!laterDaySaved()) clearGameState(storage);
    lastSavedAt = 0;
    const puzzle = state.puzzles.find(p => p.id === state.puzzleID);
    if (!puzzle) {
        setResultMessage(LOAD_ERROR);
        return null;
    }
    startPuzzle(puzzle);
    state.guessesLeft = TOTAL_GUESSES;
    state.guessHistory = {};
    state.started = false;
    lastGuessAt = 0;
    drawPuzzle();
    setResultMessage(guessesLeftMessage());
    startTimer(null);
    focusFirstOpenCell();
    return 'new';
};

// Load today's game and report how it opened.
const loadGame = () => {
    const loadState = resumeOrStart();
    if (loadState) {
        track(EVENTS.GAME_LOAD, { load_state: loadState, load_time_ms: Math.round(performance.now()) });
    } else {
        track(EVENTS.PUZZLE_LOAD_ERROR, { error_type: 'puzzle_missing', error_message: `No puzzle with id ${state.puzzleID}` });
    }
};

// Admin override: clear all saved data and start today's puzzle afresh.
// Only on a local copy, so it isn't sitting in every player's console.
const isLocal = ['localhost', '127.0.0.1', '[::1]', ''].includes(window.location.hostname);
if (isLocal) window.__PSEUDOKU_ADMIN_RESET = () => {
    try { storage.clear(); } catch (e) { }
    $('check-button').hidden = false;
    $('share-button').hidden = true;
    loadGame();
    console.log('%cPseudoku: FULL game state and all saved data have been reset.', 'color: #6200ea; font-weight: bold;');
};

let settings = null;

// On phones the "All clues" panel would push the page past one screen, so
// it is hidden there and opened as a sheet instead. The clue list moves into
// the sheet while it is open and back afterwards, so highlighting still works.
const setupCluesSheet = () => {
    const dialog = $('clues-modal');
    const groups = document.querySelector('.clues-panel .clue-groups');
    const panel = groups.parentElement;
    setupDialog(dialog, $('clues-button'), [$('clues-close')], () => $('clues-sheet-body').append(groups));
    dialog.addEventListener('close', () => panel.append(groups));
};

// Today's puzzle, unless this tab was already playing an earlier day's
// puzzle that isn't finished: then it carries on with that one, so the
// new day doesn't take a game away mid-play. The page itself never switches
// puzzle while open; this covers it being reloaded.
const choosePuzzle = () => {
    // The puzzle list is needed first: today's ID depends on its length.
    state.puzzleDate = getPuzzleDate();
    state.puzzleID = getPuzzleID(state.puzzles.length);
    let pinned = null;
    try { pinned = JSON.parse(sessionStorage.getItem(TAB_PUZZLE_KEY)); } catch (e) { }
    if (pinned && pinned.puzzleDate !== state.puzzleDate) {
        const saved = readGameState(storage, pinned);
        if (saved && !saved.gameOver) {
            state.puzzleDate = pinned.puzzleDate;
            state.puzzleID = pinned.puzzleID;
        }
    }
    try {
        sessionStorage.setItem(TAB_PUZZLE_KEY, JSON.stringify({ puzzleDate: state.puzzleDate, puzzleID: state.puzzleID }));
    } catch (e) { }
};

const init = async () => {
    setContextProvider(analyticsContext);
    settings = setupSettingsDialog(storage, setupDialog);
    setupStatsDialog(storage, () => state.puzzleDate || getPuzzleDate());
    const help = setupDialog($('help-modal'), $('help-button'), [$('help-close'), $('help-start')]);
    setupCluesSheet();
    keypad = setupKeypad({ getTarget: keypadTarget, getHistory: keypadHistory });
    $('check-button').addEventListener('click', checkSolution);

    // First visit: show how to play once.
    let seenHelp = true;
    try { seenHelp = storage.getItem(HELP_SEEN_KEY) === '1'; } catch (e) { }
    state.firstVisit = !seenHelp;
    if (!seenHelp) {
        try { storage.setItem(HELP_SEEN_KEY, '1'); } catch (e) { }
        help.open(null);
        $('help-modal').addEventListener('close', focusFirstOpenCell, { once: true });
    }

    // Save when the page is hidden (switching tabs or apps); on phones
    // that's often the last chance before it is closed.
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            saveGame();
        } else if (state.puzzle && isStale(readSaved())) {
            // Played on in another tab meanwhile: carry on from there.
            resumeOrStart();
        } else {
            showTime();
        }
    });
    window.addEventListener('pagehide', () => {
        saveGame();
        // Leaving part-way through: the drop-off point for the funnel.
        if (gameStatus() === 'in_progress') track(EVENTS.PUZZLE_EXIT, { exit_type: 'pagehide' });
    });
    document.addEventListener('pseudoku:entry', onEntry);
    window.addEventListener('beforeunload', saveGame);

    try {
        const response = await fetch('grids.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        state.puzzles = await response.json();
    } catch (error) {
        console.error('Error loading puzzles:', error);
        setResultMessage(LOAD_ERROR);
        track(EVENTS.PUZZLE_LOAD_ERROR, { error_type: 'fetch_failed', error_message: String(error?.message || error) });
        return;
    }
    choosePuzzle();
    loadGame();
};

init();

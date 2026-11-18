// Admin mode: a hidden panel for testing on the live site. Turn it on by
// opening the page with ?admin (remembered on that device) and off with
// ?admin=off. It only hides the panel from players: the site is static, so
// anyone reading this file can find it. Nothing here touches other players.
//
// In admin mode, ?puzzle=N opens puzzle N for practice: it isn't saved,
// doesn't record stats, and leaves the real game for today alone.
import { setupDialog, showToast } from './ui.js';

const ADMIN_KEY = 'pseudokuAdmin';

// Read ?admin / ?admin=off, remember the choice, and say whether admin mode
// is on. The admin flag is then taken out of the address bar.
export const readAdminMode = (storage, location = window.location) => {
    const params = new URLSearchParams(location.search);
    const asked = params.has('admin') ? params.get('admin') !== 'off' : null;
    let on = asked === true;
    try {
        if (asked === true) storage.setItem(ADMIN_KEY, '1');
        if (asked === false) storage.removeItem(ADMIN_KEY);
        on = storage.getItem(ADMIN_KEY) === '1';
    } catch (e) { }
    if (asked !== null) {
        params.delete('admin');
        const query = params.toString();
        try { history.replaceState(null, '', location.pathname + (query ? `?${query}` : '') + location.hash); } catch (e) { }
    }
    return on;
};

// The puzzle number in ?puzzle=N, if it is a real puzzle.
export const practicePuzzleID = (location, totalPuzzles) => {
    const raw = new URLSearchParams(location.search).get('puzzle');
    const id = Number(raw);
    return raw !== null && Number.isInteger(id) && id >= 1 && id <= totalPuzzles ? id : null;
};

const urlWith = (params) => {
    const url = new URL(window.location.href);
    url.search = '';
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return url.toString();
};

const el = (tag, props = {}, children = []) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children);
    return node;
};

const button = (label, onClick, extra = '') =>
    el('button', { type: 'button', className: `button ${extra}`.trim(), textContent: label, onclick: onClick });

// Small answer tags in the corner of each open cell.
const setAnswersShown = (show, answerGrid) => {
    document.querySelectorAll('.admin-answer').forEach(tag => tag.remove());
    if (!show || !answerGrid) return;
    document.querySelectorAll('.grid-cell:not(.preset)').forEach(cell => {
        const value = answerGrid[Number(cell.dataset.row)][Number(cell.dataset.col)];
        cell.appendChild(el('span', { className: 'admin-answer', textContent: value, ariaHidden: 'true' }));
    });
};

// Build the panel and its button. `game` gives what the panel needs:
//   todayID, currentID, totalPuzzles, practice (bool), answerGrid(),
//   rollIn(), playLines(), lineDemos, playLine(rule), playWin(), playLose(),
//   wipeToday(), clearStats()
export const setupAdmin = (game) => {
    const titleId = 'admin-title';
    const close = el('button', { type: 'button', className: 'icon-button sheet-close', ariaLabel: 'Close admin' });
    close.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

    const status = el('p', { className: 'admin-status' });
    status.textContent = game.practice
        ? `Practicing puzzle #${game.currentID}: not saved, no stats. Today's is #${game.todayID}.`
        : `Today's puzzle is #${game.todayID} of ${game.totalPuzzles}.`;

    const dialog = el('dialog', { id: 'admin-modal', className: 'sheet admin' });
    dialog.setAttribute('aria-labelledby', titleId);

    // Effects play once the panel has closed, so they can be seen.
    const after = (fn) => () => {
        dialog.close();
        setTimeout(fn, 250);
    };

    const answersToggle = el('input', { type: 'checkbox', role: 'switch' });
    answersToggle.addEventListener('change', () => setAnswersShown(answersToggle.checked, game.answerGrid()));

    const puzzleInput = el('input', {
        type: 'number', min: 1, max: game.totalPuzzles, value: game.currentID,
        className: 'admin-number', inputMode: 'numeric', ariaLabel: 'Puzzle number'
    });
    const openPuzzle = () => {
        const id = Number(puzzleInput.value);
        if (!Number.isInteger(id) || id < 1 || id > game.totalPuzzles) {
            showToast(`Pick a puzzle from 1 to ${game.totalPuzzles}.`);
            return;
        }
        window.location.href = urlWith({ puzzle: id });
    };
    puzzleInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') openPuzzle(); });

    const body = el('div', { className: 'sheet-body' }, [
        status,

        el('h3', { textContent: 'Effects' }),
        el('div', { className: 'admin-actions' }, [
            button('Roll in numbers', after(game.rollIn)),
            button('All line effects', after(game.playLines)),
            button('Win', after(game.playWin)),
            button('Lose', after(game.playLose))
        ]),

        el('h3', { textContent: 'Line effects' }),
        el('p', { className: 'admin-help', textContent: "Plays on a line with that kind of clue, or on row 1 if this puzzle hasn't got one." }),
        el('div', { className: 'admin-actions admin-actions-compact' },
            game.lineDemos.map(({ rule, name }) => button(name, after(() => {
                const where = game.playLine(rule);
                showToast(where ? `${name}: ${where}` : `${name}: row 1 (not in this puzzle)`);
            })))),

        el('h3', { textContent: 'Answers' }),
        el('label', { className: 'setting setting-toggle' }, [
            el('span', { className: 'setting-text' }, [
                el('span', { className: 'setting-name', textContent: 'Show answers on the grid' }),
                el('span', { className: 'setting-help', textContent: 'A small tag in the corner of each open cell.' })
            ]),
            answersToggle
        ]),

        el('h3', { textContent: 'Puzzle' }),
        el('div', { className: 'admin-row' }, [puzzleInput, button('Practice', openPuzzle)]),
        el('div', { className: 'admin-actions' }, [
            button(`Practice today's (#${game.todayID})`, () => { window.location.href = urlWith({ puzzle: game.todayID }); }),
            ...(game.practice ? [button('Back to the real game', () => { window.location.href = urlWith({}); }, 'primary')] : [])
        ]),

        el('h3', { textContent: 'Reset' }),
        el('div', { className: 'admin-actions' }, [
            button("Wipe today's save", () => {
                if (!confirm("Wipe today's game and start it over? Finishing it again replaces today's result in your stats.")) return;
                game.wipeToday();
                window.location.href = urlWith({});
            }),
            button('Clear all stats', () => {
                if (!confirm('Delete your whole stats history on this device?')) return;
                game.clearStats();
                showToast('Stats cleared.');
            })
        ]),

        el('div', { className: 'admin-footer' }, [
            button('Turn off admin mode', () => { window.location.href = urlWith({ admin: 'off' }); })
        ])
    ]);

    dialog.append(
        el('div', { className: 'sheet-header' }, [el('h2', { id: titleId, tabIndex: -1, autofocus: true, textContent: 'Admin' }), close]),
        body
    );

    const opener = el('button', { type: 'button', className: 'admin-fab', textContent: game.practice ? 'Admin · practice' : 'Admin' });
    opener.setAttribute('aria-haspopup', 'dialog');
    document.body.append(dialog, opener);
    document.body.classList.add('admin-mode'); // room at the bottom for the button
    setupDialog(dialog, opener, [close]);
};

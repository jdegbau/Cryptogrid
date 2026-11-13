// Small page-level UI pieces: result line, toast and dialogs. End-game
// effects live in effects.js.
import { track, EVENTS } from './analytics.js';
import { createResultBadge } from './effects.js';

export { playWinEffect, playLoseEffect } from './effects.js';

export const prefersReducedMotion = () =>
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const setResultMessage = (message) => {
    const result = document.getElementById('result');
    result.classList.remove('result-end');
    result.textContent = message;
};

// Result card with a badge on top. `kind` is 'win' or 'lose'; `animate` is
// false when restoring a finished game, so it shows without the entrance.
export const setEndResult = (message, kind, animate) => {
    const result = document.getElementById('result');
    result.classList.add('result-end');
    result.classList.toggle('result-enter', Boolean(animate));
    result.textContent = '';
    const text = document.createElement('span');
    text.className = 'result-text';
    text.textContent = message;
    result.append(createResultBadge(kind, animate), text);
};

let toastTimer;
export const showToast = (message, duration = 2500) => {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), duration);
};

// One dot per guess; used guesses fade out.
export const updateGuessIcons = (guessesLeft, totalGuesses) => {
    const used = totalGuesses - guessesLeft;
    const guesses = document.getElementById('errors');
    guesses.textContent = '';
    for (let i = 0; i < totalGuesses; i++) {
        const pip = document.createElement('span');
        pip.className = i < used ? 'guess-pip used' : 'guess-pip';
        pip.setAttribute('aria-hidden', 'true');
        guesses.appendChild(pip);
    }
    const label = document.createElement('span');
    label.className = 'sr-only';
    label.textContent = `${guessesLeft} of ${totalGuesses} guesses left`;
    guesses.appendChild(label);
    guesses.title = `${guessesLeft} of ${totalGuesses} guesses left`;
};

// 'help', 'stats', 'settings', 'clues' or 'copy', from the dialog's id.
export const dialogName = (dialog) => dialog.id.replace(/-modal$/, '');

// Wire up a <dialog>: open from `openButton`, close from the close button,
// a tap on the backdrop, or Escape; focus goes back to the opener.
export const setupDialog = (dialog, openButton, closeButtons, onOpen) => {
    let opener = null;
    // `from` is null when the game opens it itself (help on a first visit).
    const open = (from = openButton) => {
        opener = from;
        dialog.showModal();
        onOpen?.();
        track(EVENTS.DIALOG_OPEN, {
            dialog_name: dialogName(dialog),
            trigger: from === null ? 'auto' : from === openButton ? 'button' : 'fallback'
        });
    };
    openButton?.addEventListener('click', () => open(openButton));
    closeButtons.forEach(btn => btn.addEventListener('click', () => dialog.close()));
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => opener?.focus?.());
    return { open };
};

export const shake = (elements) => {
    elements.forEach(el => {
        el.classList.add('shake');
        setTimeout(() => el.classList.remove('shake'), 500);
    });
};

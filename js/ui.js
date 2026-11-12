// Small page-level UI pieces: result line, toast, dialogs and end-game effects.
import { track, EVENTS } from './analytics.js';

export const prefersReducedMotion = () =>
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const setResultMessage = (message) => {
    const result = document.getElementById('result');
    result.classList.remove('result-end');
    result.textContent = message;
};

// Result line with a leading emoji; `animation` is 'win', 'lose' or null.
export const setEndResult = (message, signifier, animation) => {
    const result = document.getElementById('result');
    result.classList.add('result-end');
    result.textContent = '';
    const icon = document.createElement('span');
    icon.className = 'result-signifier';
    if (animation) icon.classList.add(`result-animate-${animation}`);
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = signifier;
    const text = document.createElement('span');
    text.textContent = message;
    result.append(icon, text);
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

const removeAfter = (el, ms) => setTimeout(() => el.remove(), ms);

export const playWinEffect = () => {
    if (prefersReducedMotion()) return;
    document.querySelector('.emoji-rain')?.remove();
    const rain = document.createElement('div');
    rain.className = 'emoji-rain';
    rain.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 28; i++) {
        const drop = document.createElement('span');
        drop.className = 'emoji-raindrop';
        drop.textContent = '🎉';
        drop.style.left = `${Math.random() * 90 + 5}%`;
        drop.style.animationDuration = `${1.2 + Math.random() * 0.9}s`;
        drop.style.animationDelay = `${Math.random() * 0.7}s`;
        drop.style.fontSize = `${1.5 + Math.random() * 1.2}em`;
        rain.appendChild(drop);
    }
    document.body.appendChild(rain);
    removeAfter(rain, 2200);
};

export const playLoseEffect = () => {
    if (prefersReducedMotion()) return;
    document.querySelector('.emoji-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'emoji-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    const inner = document.createElement('span');
    inner.className = 'emoji-overlay-inner';
    inner.textContent = '❌';
    overlay.appendChild(inner);
    document.body.appendChild(overlay);
    removeAfter(overlay, 2200);
};

export const shake = (elements) => {
    elements.forEach(el => {
        el.classList.add('shake');
        setTimeout(() => el.classList.remove('shake'), 500);
    });
};

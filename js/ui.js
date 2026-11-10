// Small page-level UI pieces: result line, toast, tabs and end-game effects.

export const prefersReducedMotion = () =>
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const setResultMessage = (message) => {
    const result = document.getElementById('result');
    result.textContent = message;
};

// Result line with a leading emoji; `animation` is 'win', 'lose' or null.
export const setEndResult = (message, signifier, animation) => {
    const result = document.getElementById('result');
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

export const updateGuessIcons = (guessesLeft, totalGuesses) => {
    const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
    const used = totalGuesses - guessesLeft;
    const errors = document.getElementById('errors');
    errors.textContent = 'Guesses: ';
    for (let i = 0; i < totalGuesses; i++) {
        const icon = document.createElement('span');
        icon.className = 'guess-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = i < used ? '❌' : numberEmojis[i];
        errors.appendChild(icon);
    }
    const label = document.createElement('span');
    label.className = 'sr-only';
    label.textContent = `${guessesLeft} of ${totalGuesses} remaining`;
    errors.appendChild(label);
};

export const setupTabs = () => {
    const tabs = [
        { button: document.getElementById('clues-tab'), panel: document.getElementById('clues-table') },
        { button: document.getElementById('rules-tab'), panel: document.getElementById('game-rules-container') }
    ];
    const select = (active) => {
        tabs.forEach(({ button, panel }) => {
            const on = button === active.button;
            button.classList.toggle('active', on);
            button.setAttribute('aria-selected', String(on));
            panel.hidden = !on;
        });
    };
    tabs.forEach(tab => tab.button.addEventListener('click', () => select(tab)));
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

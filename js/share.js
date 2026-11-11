// Sharing: the text of a result or stats summary, and getting it out of the
// page. Phones get the system share sheet; everything else copies to the
// clipboard, and if that is blocked the text is shown to copy by hand.
import { formatTime } from './date.js';
import { showToast, setupDialog } from './ui.js';

// Squares for the shared grid. High contrast matches the in-game colours:
// blue correct, orange close, black wrong (and white for given cells, so
// they can't be mistaken for blue).
export const CELL_EMOJI = {
    standard: { preset: '🟦', correct: '🟩', incorrect: '🟥', hint: '🟨', empty: '⬜' },
    highContrast: { preset: '⬜', correct: '🟦', incorrect: '⬛', hint: '🟧', empty: '▫️' }
};

export const GUESS_EMOJI = { wrong: '❌', right: '✅', unused: '⚪' };

const streakText = (streak) => (streak >= 2 ? `🔥 ${streak}` : null);

// One emoji per guess: misses, then the winning guess, then guesses not needed.
// `wrongGuesses` counts the submitted guesses that weren't the solution.
export const guessLine = ({ won, wrongGuesses, total }) => {
    const wrong = Math.min(wrongGuesses, total);
    const right = won ? 1 : 0;
    const unused = Math.max(total - wrong - right, 0);
    const emojis = GUESS_EMOJI.wrong.repeat(wrong) + GUESS_EMOJI.right.repeat(right) + GUESS_EMOJI.unused.repeat(unused);
    const score = won ? `${wrong + 1}/${total}` : `X/${total}`;
    return `${emojis} ${score}`;
};

// The result of one game. The link is kept apart so the share sheet can pass
// it as a URL (giving a link preview); `withLink` joins them for copying.
// `showTime: false` leaves the time out (the player hid the timer).
export const buildResultShare = ({ puzzleID, difficulty, grid, won, wrongGuesses, total, timeSpent, streak, url, showTime = true }) => {
    const level = difficulty ? ` (${difficulty})` : '';
    const lines = [
        `Pseudoku — #${puzzleID}${level}`,
        '',
        grid,
        `Guesses: ${guessLine({ won, wrongGuesses, total })}`
    ];
    if (showTime) lines.push(`Time: ${formatTime(timeSpent)}`);
    const streakLine = streakText(streak);
    if (streakLine) lines.push(`Streak: ${streakLine}`);
    return { text: lines.join('\n'), url };
};

// The player's overall record, from summarizeStats().
export const buildStatsShare = (summary, { bestTime = null, url }) => {
    const lines = [
        'My Pseudoku stats',
        '',
        `Played: ${summary.played}`,
        `Win rate: ${Math.round(summary.winRate)}%`,
        `Streak: ${streakText(summary.streak) || summary.streak} · Best: ${summary.bestStreak}`
    ];
    if (bestTime !== null) lines.push(`Best time: ${formatTime(Math.round(bestTime))}`);
    return { text: lines.join('\n'), url };
};

export const withLink = ({ text, url }) => (url ? `${text}\nPlay: ${url}` : text);

export const gameUrl = () => window.location.origin + window.location.pathname;

// --- Getting the text out ---

// The share sheet suits phones and tablets; on a computer most people
// want the text on their clipboard to paste into a chat.
const useShareSheet = () =>
    typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches;

// execCommand('copy') is deprecated but still works in many in-app browsers
// where the async clipboard API is missing or blocked.
const legacyCopy = (text) => {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch (e) { }
    area.remove();
    return copied;
};

const copyText = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (e) {
        return legacyCopy(text);
    }
};

// Briefly swap the button's label to confirm the copy.
const flashLabel = (button, label) => {
    const span = button?.querySelector('.button-label');
    if (!span) return;
    span.dataset.label ??= span.textContent;
    span.textContent = label;
    clearTimeout(Number(span.dataset.timer));
    span.dataset.timer = String(setTimeout(() => { span.textContent = span.dataset.label; }, 2000));
};

// Last resort: show the text, selected, for the player to copy themselves.
let copyDialog = null;
const showCopyDialog = (text, opener) => {
    const dialog = document.getElementById('copy-modal');
    const area = document.getElementById('copy-text');
    if (!copyDialog) {
        copyDialog = setupDialog(dialog, null, [document.getElementById('copy-close')], () => {
            area.focus();
            area.select();
        });
        document.getElementById('copy-again').addEventListener('click', () => {
            area.focus();
            area.select();
            if (legacyCopy(area.value)) {
                showToast('Copied to clipboard!');
                dialog.close();
            } else {
                showToast('Select the text and copy it yourself.');
            }
        });
    }
    area.value = text;
    area.rows = Math.min(text.split('\n').length, 14);
    copyDialog.open(opener);
};

// Share `{ text, url }` from `button` (used to confirm and to return focus).
export const shareText = async (share, button) => {
    if (useShareSheet()) {
        try {
            await navigator.share(share.url ? { text: share.text, url: share.url } : { text: share.text });
            return;
        } catch (err) {
            if (err.name === 'AbortError') return;
            // Share sheet failed to open: fall through to copying.
        }
    }
    await copyOrShow(withLink(share), button);
};

// Copy `text`, or show it to copy by hand if the browser won't.
export const copyOrShow = async (text, button) => {
    if (await copyText(text)) {
        flashLabel(button, 'Copied ✓');
        showToast('Copied to clipboard!');
    } else {
        showCopyDialog(text, button);
    }
};

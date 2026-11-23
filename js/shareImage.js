// Share cards: a picture of a result or the stats, drawn on a canvas so it can
// be posted where text can't go (Instagram and TikTok stories, photo posts).
// The grid shows only the colors of each cell, never the numbers, so the
// picture gives nothing away. Everything else in the share text (puzzle,
// difficulty, guesses, time, streak and the link) is drawn on it too.
import { formatTime } from './date.js';

// Sizes in pixels. Stories, Reels and TikTok are 9:16; Instagram feed posts
// are 4:5 portrait.
export const CARD_FORMATS = {
    story: { width: 1080, height: 1920, label: 'Story', ratio: '9:16' },
    post: { width: 1080, height: 1350, label: 'Post', ratio: '4:5' }
};

// Space to keep clear of each app's own buttons and captions. Story apps
// cover about the top 250px and bottom 340px; TikTok also puts its buttons
// down the right edge, so the sides get room too.
const SAFE_AREA = {
    story: { top: 250, bottom: 360, side: 110 },
    post: { top: 70, bottom: 70, side: 70 }
};

// Fixed colors, not the page theme: a shared picture should look the same
// for everyone. Dark, to sit well in stories.
const INK = {
    bgTop: '#17142b',
    bgBottom: '#0b0a12',
    glowA: 'rgba(106, 72, 238, 0.55)',
    glowB: 'rgba(34, 169, 90, 0.22)',
    panel: 'rgba(255, 255, 255, 0.05)',
    panelEdge: 'rgba(255, 255, 255, 0.10)',
    text: '#f3f2fa',
    muted: '#aeabc4',
    accent: '#b9a8ff',
    chip: 'rgba(255, 255, 255, 0.08)'
};

// Cell fills, matching CELL_EMOJI in share.js: high contrast swaps green and
// red for blue and gray. `mark` is the light or dark glyph on top.
export const CARD_CELL_COLORS = {
    standard: {
        preset: { fill: '#3a3168', mark: null },
        correct: { fill: '#2fb867', mark: '#ffffff' },
        hint: { fill: '#f5b82e', mark: '#3a2600' },
        incorrect: { fill: '#e2564d', mark: '#ffffff' },
        empty: { fill: '#2a2838', mark: null }
    },
    highContrast: {
        preset: { fill: '#e8e6f2', mark: null },
        correct: { fill: '#2c66cc', mark: '#ffffff' },
        hint: { fill: '#f59b23', mark: '#241400' },
        incorrect: { fill: '#55546a', mark: '#ffffff' },
        empty: { fill: '#2a2838', mark: null }
    }
};

const GUESS_COLORS = { wrong: '#e2564d', right: '#2fb867', unused: 'rgba(255, 255, 255, 0.16)' };
const GUESS_COLORS_HC = { wrong: '#55546a', right: '#2c66cc', unused: 'rgba(255, 255, 255, 0.16)' };

const FONT = "'Outfit', ui-rounded, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const font = (weight, size) => `${weight} ${size}px ${FONT}`;

// --- What goes on the card (no canvas here, so it can be tested) ---

// "jdegbau.com/Cryptogrid" from the full game URL.
export const displayUrl = (url) => (url || '').replace(/^https?:\/\//, '').replace(/\/+$/, '').replace(/\/index\.html$/, '');

// "Mon, Nov 23" from "2026-11-23", read as a calendar date (no time zone).
export const shortPuzzleDate = (date) => {
    if (!date) return '';
    const [y, m, d] = date.split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
        .format(new Date(Date.UTC(y, m - 1, d)));
};

// The guess dots: misses, the winning guess, then guesses not needed.
export const guessDots = ({ won, wrongGuesses, total }) => {
    const wrong = Math.min(wrongGuesses, total);
    const right = won ? 1 : 0;
    return [
        ...Array(wrong).fill('wrong'),
        ...Array(right).fill('right'),
        ...Array(Math.max(total - wrong - right, 0)).fill('unused')
    ];
};

export const resultHeadline = ({ won, wrongGuesses }) => {
    if (!won) return 'Stumped this time';
    const used = wrongGuesses + 1;
    return used === 1 ? 'Solved first try!' : `Solved in ${used} guesses`;
};

// Everything drawn on a result card, from the same fields as buildResultShare.
// `cells` is a 4×4 array of cell states ('preset', 'correct', ...).
export const describeResultCard = ({ puzzleID, puzzleDate, difficulty, cells, won, wrongGuesses, total, timeSpent, streak, url, showTime = true }) => {
    const chips = [];
    if (showTime) chips.push({ label: 'Time', value: formatTime(timeSpent) });
    if (streak >= 2) chips.push({ label: 'Streak', value: `🔥 ${streak}` });
    return {
        kind: 'result',
        subtitle: [`#${puzzleID}`, difficulty, shortPuzzleDate(puzzleDate)].filter(Boolean).join('  ·  '),
        headline: resultHeadline({ won, wrongGuesses }),
        cells,
        dots: guessDots({ won, wrongGuesses, total }),
        score: won ? `${Math.min(wrongGuesses, total) + 1}/${total}` : `X/${total}`,
        chips,
        cta: won ? 'Can you beat me?' : 'Can you solve it?',
        url: displayUrl(url)
    };
};

// Everything drawn on a stats card, from summarizeStats().
export const describeStatsCard = (summary, { bestTime = null, url }) => ({
    kind: 'stats',
    subtitle: 'My stats',
    headline: summary.streak >= 2 ? `🔥 ${summary.streak}-day streak` : `${summary.played} ${summary.played === 1 ? 'puzzle' : 'puzzles'} played`,
    tiles: [
        { label: 'Played', value: String(summary.played) },
        { label: 'Win rate', value: `${Math.round(summary.winRate)}%` },
        { label: 'Streak', value: String(summary.streak) },
        { label: 'Best streak', value: String(summary.bestStreak) }
    ],
    chips: bestTime !== null ? [{ label: 'Best time', value: formatTime(Math.round(bestTime)) }] : [],
    cta: 'Play the daily puzzle',
    url: displayUrl(url)
});

// --- Drawing ---

const roundRect = (ctx, x, y, w, h, r) => {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
};

const drawBackground = (ctx, width, height) => {
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, INK.bgTop);
    bg.addColorStop(1, INK.bgBottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    const glow = (x, y, r, color) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, color);
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
    };
    glow(width * 0.15, height * 0.12, width * 0.9, INK.glowA);
    glow(width * 0.95, height * 0.92, width * 0.8, INK.glowB);
};

// The four-square logo from icons/favicon.svg.
const drawLogo = (ctx, x, y, size) => {
    const s = size / 64;
    roundRect(ctx, x, y, 64 * s, 64 * s, 14 * s);
    ctx.fillStyle = '#1c1a29';
    ctx.fill();
    const squares = [[10, 10, '#a995ff', 1], [34, 10, '#8fe3aa', 1], [10, 34, '#ffdf7a', 0.85], [34, 34, '#a995ff', 0.45]];
    squares.forEach(([sx, sy, color, alpha]) => {
        ctx.globalAlpha = alpha;
        roundRect(ctx, x + sx * s, y + sy * s, 20 * s, 20 * s, 6 * s);
        ctx.fillStyle = color;
        ctx.fill();
    });
    ctx.globalAlpha = 1;
};

// A glyph for each state, so the card reads without telling colors apart.
const drawMark = (ctx, state, cx, cy, size, color) => {
    if (!color) return;
    const r = size * 0.2;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = size * 0.075;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    if (state === 'correct') {
        ctx.moveTo(cx - r, cy + r * 0.05);
        ctx.lineTo(cx - r * 0.3, cy + r * 0.7);
        ctx.lineTo(cx + r, cy - r * 0.65);
    } else if (state === 'incorrect') {
        const k = r * 0.8;
        ctx.moveTo(cx - k, cy - k); ctx.lineTo(cx + k, cy + k);
        ctx.moveTo(cx + k, cy - k); ctx.lineTo(cx - k, cy + k);
    } else if (state === 'hint') {
        [-0.38, 0.38].forEach(dy => {
            const y = cy + r * dy;
            ctx.moveTo(cx - r, y);
            ctx.bezierCurveTo(cx - r * 0.4, y - r * 0.55, cx + r * 0.4, y + r * 0.55, cx + r, y);
        });
    }
    ctx.stroke();
    ctx.restore();
};

const drawGrid = (ctx, cells, palette, x, y, size) => {
    const pad = size * 0.045;
    roundRect(ctx, x, y, size, size, size * 0.07);
    ctx.fillStyle = INK.panel;
    ctx.fill();
    ctx.strokeStyle = INK.panelEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
    const gap = size * 0.03;
    const n = cells.length;
    const cell = (size - pad * 2 - gap * (n - 1)) / n;
    cells.forEach((row, r) => row.forEach((state, c) => {
        const colors = palette[state] || palette.empty;
        const cx = x + pad + c * (cell + gap);
        const cy = y + pad + r * (cell + gap);
        roundRect(ctx, cx, cy, cell, cell, cell * 0.2);
        ctx.fillStyle = colors.fill;
        ctx.fill();
        drawMark(ctx, state, cx + cell / 2, cy + cell / 2, cell, colors.mark);
    }));
};

// Chips side by side, centered on `cx`. Each is a small label over a value.
const drawChips = (ctx, chips, cx, y, height) => {
    if (!chips.length) return 0;
    const gap = 24;
    const widths = chips.map(chip => {
        ctx.font = font(700, 54);
        const v = ctx.measureText(chip.value).width;
        ctx.font = font(500, 28);
        const l = ctx.measureText(chip.label.toUpperCase()).width;
        return Math.max(v, l) + 88;
    });
    const total = widths.reduce((a, b) => a + b, 0) + gap * (chips.length - 1);
    let x = cx - total / 2;
    chips.forEach((chip, i) => {
        roundRect(ctx, x, y, widths[i], height, 28);
        ctx.fillStyle = INK.chip;
        ctx.fill();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = INK.muted;
        ctx.font = font(500, 28);
        ctx.fillText(chip.label.toUpperCase(), x + widths[i] / 2, y + 46);
        ctx.fillStyle = INK.text;
        ctx.font = font(700, 54);
        ctx.fillText(chip.value, x + widths[i] / 2, y + height - 30);
        x += widths[i] + gap;
    });
    return height;
};

const drawText = (ctx, text, x, y, weight, size, color, align = 'center') => {
    ctx.font = font(weight, size);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, x, y);
};

// Shrink a line's font until it fits `maxWidth`.
const fitSize = (ctx, text, weight, size, maxWidth) => {
    let s = size;
    ctx.font = font(weight, s);
    while (s > 20 && ctx.measureText(text).width > maxWidth) {
        s -= 2;
        ctx.font = font(weight, s);
    }
    return s;
};

// The card's content is laid out on a 900-wide column, then scaled to fit
// the format's safe area and centered in it.
const COLUMN = 900;

const layoutResult = (card) => [
    { h: 84, draw: (ctx) => drawHeader(ctx) },
    { h: 30 },
    { h: 44, draw: (ctx) => drawText(ctx, card.subtitle, COLUMN / 2, 36, 500, 38, INK.muted) },
    { h: 36 },
    { h: 96, draw: (ctx) => drawText(ctx, card.headline, COLUMN / 2, 80, 700, fitSize(ctx, card.headline, 700, 86, COLUMN), INK.text) },
    { h: 44 },
    { h: 640, draw: (ctx) => drawGrid(ctx, card.cells, card.palette, (COLUMN - 640) / 2, 0, 640) },
    { h: 48 },
    { h: 64, draw: (ctx) => drawDots(ctx, card) },
    { h: card.chips.length ? 40 : 0 },
    { h: card.chips.length ? 136 : 0, draw: (ctx) => drawChips(ctx, card.chips, COLUMN / 2, 0, 136) },
    { h: 64 },
    { h: 110, draw: (ctx) => drawFooter(ctx, card) }
];

const layoutStats = (card) => [
    { h: 84, draw: (ctx) => drawHeader(ctx) },
    { h: 30 },
    { h: 44, draw: (ctx) => drawText(ctx, card.subtitle, COLUMN / 2, 36, 500, 38, INK.muted) },
    { h: 36 },
    { h: 96, draw: (ctx) => drawText(ctx, card.headline, COLUMN / 2, 80, 700, fitSize(ctx, card.headline, 700, 86, COLUMN), INK.text) },
    { h: 52 },
    { h: 520, draw: (ctx) => drawTiles(ctx, card.tiles) },
    { h: card.chips.length ? 40 : 0 },
    { h: card.chips.length ? 136 : 0, draw: (ctx) => drawChips(ctx, card.chips, COLUMN / 2, 0, 136) },
    { h: 64 },
    { h: 110, draw: (ctx) => drawFooter(ctx, card) }
];

const drawHeader = (ctx) => {
    ctx.font = font(700, 72);
    const word = 'Pseudoku';
    const wordWidth = ctx.measureText(word).width;
    const logo = 80;
    const gap = 22;
    const x = (COLUMN - logo - gap - wordWidth) / 2;
    drawLogo(ctx, x, 2, logo);
    drawText(ctx, word, x + logo + gap, 68, 700, 72, INK.text, 'left');
};

const drawDots = (ctx, card) => {
    const colors = card.highContrast ? GUESS_COLORS_HC : GUESS_COLORS;
    const d = 52;
    const gap = 20;
    ctx.font = font(700, 54);
    const scoreWidth = ctx.measureText(card.score).width;
    const total = card.dots.length * d + (card.dots.length - 1) * gap + 32 + scoreWidth;
    let x = (COLUMN - total) / 2;
    card.dots.forEach(kind => {
        ctx.beginPath();
        ctx.arc(x + d / 2, 32, d / 2, 0, Math.PI * 2);
        ctx.fillStyle = colors[kind];
        ctx.fill();
        if (kind !== 'unused') drawMark(ctx, kind === 'right' ? 'correct' : 'incorrect', x + d / 2, 32, d * 1.6, '#ffffff');
        x += d + gap;
    });
    drawText(ctx, card.score, x - gap + 32, 51, 700, 54, INK.text, 'left');
};

const drawTiles = (ctx, tiles) => {
    const gap = 28;
    const w = (COLUMN - gap) / 2;
    const h = (520 - gap) / 2;
    tiles.forEach((tile, i) => {
        const x = (i % 2) * (w + gap);
        const y = Math.floor(i / 2) * (h + gap);
        roundRect(ctx, x, y, w, h, 36);
        ctx.fillStyle = INK.panel;
        ctx.fill();
        ctx.strokeStyle = INK.panelEdge;
        ctx.lineWidth = 2;
        ctx.stroke();
        drawText(ctx, tile.value, x + w / 2, y + h / 2 + 34, 700, 108, INK.text);
        drawText(ctx, tile.label.toUpperCase(), x + w / 2, y + h - 34, 500, 30, INK.muted);
    });
};

const drawFooter = (ctx, card) => {
    drawText(ctx, card.cta, COLUMN / 2, 40, 500, 40, INK.muted);
    if (card.url) drawText(ctx, card.url, COLUMN / 2, 100, 700, fitSize(ctx, card.url, 700, 50, COLUMN), INK.accent);
};

// Draw `card` (from describeResultCard or describeStatsCard) on a new canvas
// in `format` ('story' or 'post'). `highContrast` follows the setting.
export const drawShareCard = (card, { format = 'story', highContrast = false } = {}) => {
    const { width, height } = CARD_FORMATS[format];
    const safe = SAFE_AREA[format];
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    drawBackground(ctx, width, height);

    const full = { ...card, highContrast, palette: highContrast ? CARD_CELL_COLORS.highContrast : CARD_CELL_COLORS.standard };
    const rows = full.kind === 'stats' ? layoutStats(full) : layoutResult(full);
    const contentHeight = rows.reduce((sum, row) => sum + row.h, 0);
    const areaW = width - safe.side * 2;
    const areaH = height - safe.top - safe.bottom;
    const scale = Math.min(1, areaW / COLUMN, areaH / contentHeight);
    const left = (width - COLUMN * scale) / 2;
    let top = safe.top + (areaH - contentHeight * scale) / 2;
    rows.forEach(row => {
        if (row.draw) {
            ctx.save();
            ctx.translate(left, top);
            ctx.scale(scale, scale);
            row.draw(ctx);
            ctx.restore();
        }
        top += row.h * scale;
    });
    return canvas;
};

// The web font is loaded lazily by the page; wait for it (briefly) so the
// card isn't drawn in a fallback font.
export const loadCardFonts = () => {
    if (!document.fonts?.load) return Promise.resolve();
    const fonts = Promise.all([document.fonts.load(font(700, 72)), document.fonts.load(font(500, 38))]).catch(() => { });
    return Promise.race([fonts, new Promise(resolve => setTimeout(resolve, 1500))]);
};

export const canvasToBlob = (canvas) => new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Could not make the image'))), 'image/png');
});

// End-of-game effects: the result badge, a celebration across the grid,
// canvas confetti for a win, and a quieter reveal for a loss.

const prefersReducedMotion = () =>
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const SVG_NS = 'http://www.w3.org/2000/svg';

const svgEl = (tag, attrs) => {
    const el = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
};

// A round badge with a check (win) or a cross (loss). The strokes draw in
// when `animate` is set; otherwise it shows finished.
export const createResultBadge = (kind, animate) => {
    const svg = svgEl('svg', { viewBox: '0 0 64 64', class: `result-badge result-badge-${kind}`, 'aria-hidden': 'true', focusable: 'false' });
    if (animate) svg.classList.add('result-badge-animate');

    if (kind === 'win') {
        const rays = svgEl('g', { class: 'badge-rays' });
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
            rays.appendChild(svgEl('line', {
                x1: 32 + Math.cos(a) * 25, y1: 32 + Math.sin(a) * 25,
                x2: 32 + Math.cos(a) * 30, y2: 32 + Math.sin(a) * 30
            }));
        }
        svg.appendChild(rays);
    }
    svg.appendChild(svgEl('circle', { class: 'badge-disc', cx: 32, cy: 32, r: 22 }));
    svg.appendChild(svgEl('circle', { class: 'badge-ring', cx: 32, cy: 32, r: 22, pathLength: 1 }));
    if (kind === 'win') {
        svg.appendChild(svgEl('path', { class: 'badge-mark', d: 'M22 32.5l7 7 13-15', pathLength: 1 }));
    } else {
        svg.appendChild(svgEl('path', { class: 'badge-mark', d: 'M25 25l14 14', pathLength: 1 }));
        svg.appendChild(svgEl('path', { class: 'badge-mark badge-mark-2', d: 'M39 25L25 39', pathLength: 1 }));
    }
    return svg;
};

// --- Grid ---

// Each cell takes a turn, in a diagonal wave from the top-left corner.
const waveGrid = (className, step) => {
    const grid = document.getElementById('grid-cells');
    if (!grid) return;
    const cells = grid.querySelectorAll('.grid-cell');
    cells.forEach(cell => {
        const order = Number(cell.dataset.row) + Number(cell.dataset.col);
        cell.style.setProperty('--wave-delay', `${order * step}ms`);
        cell.classList.remove(className);
        void cell.offsetWidth;
        cell.classList.add(className);
    });
    setTimeout(() => cells.forEach(cell => cell.classList.remove(className)), 7 * step + 1400);
};

// --- Confetti ---

const cssVar = (name, fallback) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

const confettiColours = () => [
    cssVar('--accent', '#6236e8'),
    cssVar('--primary-bg', '#6236e8'),
    cssVar('--brand-green', '#11612f'),
    '#2fbf71',
    '#ffc93c',
    '#ff7a59',
    '#ff5fa2',
    '#4cc9f0'
];

const rand = (min, max) => min + Math.random() * (max - min);

let activeConfetti = null;

const launchConfetti = (bursts) => {
    activeConfetti?.stop();

    const canvas = document.createElement('canvas');
    canvas.className = 'confetti-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) { canvas.remove(); return; }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
        canvas.width = Math.round(window.innerWidth * dpr);
        canvas.height = Math.round(window.innerHeight * dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const colours = confettiColours();
    const particles = [];
    const scale = Math.min(1.25, Math.max(0.75, window.innerWidth / 700));

    // `burst`: where, which way, how wide a spread, how many, how fast, and when.
    bursts.forEach(({ x, y, angle, spread, count, speed, delay = 0 }) => {
        for (let i = 0; i < count; i++) {
            const a = angle + rand(-spread / 2, spread / 2);
            const v = speed * scale * rand(0.45, 1);
            const shape = Math.random();
            particles.push({
                x, y,
                vx: Math.cos(a) * v,
                vy: Math.sin(a) * v,
                delay: delay + rand(0, 60),
                kind: shape < 0.55 ? 'rect' : shape < 0.8 ? 'ribbon' : 'dot',
                w: rand(7, 12) * scale,
                h: rand(4, 7) * scale,
                colour: colours[(Math.random() * colours.length) | 0],
                rot: rand(0, Math.PI * 2),
                vrot: rand(-8, 8),
                flip: rand(0, Math.PI * 2),
                vflip: rand(6, 14),
                sway: rand(0, Math.PI * 2),
                drag: rand(0.968, 0.978),
                fall: rand(150, 240) * scale,
                life: rand(3.2, 4.4)
            });
        }
    });

    const gravity = 1100 * scale;
    let last = performance.now();
    let elapsed = 0;
    let frame;

    const stop = () => {
        cancelAnimationFrame(frame);
        window.removeEventListener('resize', resize);
        canvas.remove();
        if (activeConfetti?.canvas === canvas) activeConfetti = null;
    };

    const tick = (now) => {
        const dt = Math.min((now - last) / 1000, 1 / 30);
        last = now;
        elapsed += dt * 1000;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

        let alive = 0;
        for (const p of particles) {
            if (elapsed < p.delay) { alive++; continue; }
            const t = (elapsed - p.delay) / 1000;
            if (t > p.life || p.y > window.innerHeight + 40) continue;
            alive++;

            // Air drag slows the launch, then pieces flutter down at a
            // capped speed instead of dropping like stones.
            const drag = Math.pow(p.drag, dt * 60);
            p.vx *= drag;
            p.vy = (p.vy + gravity * dt) * drag;
            p.vy = Math.min(p.vy, p.fall);
            p.sway += dt * 3;
            p.x += (p.vx + Math.sin(p.sway) * 30 * scale) * dt;
            p.y += p.vy * dt;
            p.rot += p.vrot * dt;
            p.flip += p.vflip * dt;

            const fade = Math.min(1, (p.life - t) / 0.6);
            const facing = Math.cos(p.flip);
            ctx.save();
            ctx.globalAlpha = Math.max(0, fade);
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = p.colour;
            ctx.strokeStyle = p.colour;
            if (p.kind === 'dot') {
                ctx.scale(1, Math.abs(facing) * 0.6 + 0.4);
                ctx.beginPath();
                ctx.arc(0, 0, p.h * 0.6, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.kind === 'ribbon') {
                ctx.lineWidth = p.h * 0.45;
                ctx.lineCap = 'round';
                ctx.beginPath();
                const len = p.w * 1.6;
                ctx.moveTo(-len / 2, 0);
                ctx.bezierCurveTo(-len / 6, -p.h * 1.4 * facing, len / 6, p.h * 1.4 * facing, len / 2, 0);
                ctx.stroke();
            } else {
                ctx.scale(1, facing);
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                // The back face catches less light.
                if (facing < 0) {
                    ctx.fillStyle = 'rgba(0,0,0,0.18)';
                    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                }
            }
            ctx.restore();
        }

        if (alive === 0) stop();
        else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    activeConfetti = { canvas, stop };
};

// --- Public ---

const FLIP_SETTLE_MS = 900; // the guess flip across the grid (see grid.js)

export const playWinEffect = () => {
    if (prefersReducedMotion()) return;
    setTimeout(() => {
        waveGrid('cell-celebrate', 70);
        const grid = document.getElementById('grid-cells');
        const r = grid?.getBoundingClientRect();
        const cx = r ? r.left + r.width / 2 : window.innerWidth / 2;
        const cy = r ? r.top + r.height / 2 : window.innerHeight / 2;
        const w = window.innerWidth;
        const h = window.innerHeight;
        launchConfetti([
            // A pop from the middle of the grid...
            { x: cx, y: cy, angle: -Math.PI / 2, spread: Math.PI * 2, count: 70, speed: 650, delay: 180 },
            // ...then two cannons from the bottom corners.
            { x: -10, y: h + 10, angle: -Math.PI / 2 + 0.55, spread: 0.7, count: 70, speed: 1500, delay: 380 },
            { x: w + 10, y: h + 10, angle: -Math.PI / 2 - 0.55, spread: 0.7, count: 70, speed: 1500, delay: 380 }
        ]);
    }, FLIP_SETTLE_MS);
};

export const playLoseEffect = () => {
    if (prefersReducedMotion()) return;
    const grid = document.getElementById('grid-cells');
    grid?.classList.remove('grid-defeat');
    void grid?.offsetWidth;
    grid?.classList.add('grid-defeat');
    setTimeout(() => grid?.classList.remove('grid-defeat'), 1800);

    document.querySelector('.defeat-vignette')?.remove();
    const vignette = document.createElement('div');
    vignette.className = 'defeat-vignette';
    vignette.setAttribute('aria-hidden', 'true');
    document.body.appendChild(vignette);
    setTimeout(() => vignette.remove(), 2000);

    // Once the answers have flipped in, light them up one after another.
    setTimeout(() => waveGrid('cell-spotlight', 90), FLIP_SETTLE_MS);
};

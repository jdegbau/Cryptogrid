// The share sheet: a preview of the share card with ways to get it out.
// Phones get "Share image", which hands the picture to the system share menu
// (where Instagram, TikTok, Messages and the rest are listed); anywhere the
// browser can't share files, "Save image" downloads it. The text version is
// still a tap away with "Copy text".
import { showToast, setupDialog } from './ui.js';
import { copyOrShow, withLink } from './share.js';
import { CARD_FORMATS, drawShareCard, loadCardFonts, canvasToBlob } from './shareImage.js';

const FORMAT_KEY = 'pseudokuShareFormat';

const readFormat = () => {
    try {
        const saved = localStorage.getItem(FORMAT_KEY);
        if (saved in CARD_FORMATS) return saved;
    } catch (e) { }
    return 'story';
};

const saveFormat = (format) => {
    try { localStorage.setItem(FORMAT_KEY, format); } catch (e) { }
};

// Whether this browser can hand a PNG to the share menu. Checked with a tiny
// file, since canShare() needs a real File to answer.
let fileShareSupport = null;
const canShareFiles = () => {
    if (fileShareSupport === null) {
        try {
            const probe = new File([new Uint8Array(1)], 'probe.png', { type: 'image/png' });
            fileShareSupport = typeof navigator.share === 'function'
                && typeof navigator.canShare === 'function'
                && navigator.canShare({ files: [probe] });
        } catch (e) {
            fileShareSupport = false;
        }
    }
    return fileShareSupport;
};

const canCopyImage = () => typeof window.ClipboardItem === 'function' && typeof navigator.clipboard?.write === 'function';

let sheet = null;

const setupSheet = () => {
    const dialog = document.getElementById('share-modal');
    const preview = document.getElementById('share-preview');
    const frame = document.getElementById('share-frame');
    const shareButton = document.getElementById('share-image');
    const saveButton = document.getElementById('share-save');
    const copyImageButton = document.getElementById('share-copy-image');
    const copyTextButton = document.getElementById('share-copy-text');
    const tip = document.getElementById('share-tip');
    const formatButtons = [...dialog.querySelectorAll('[data-format]')];

    let source = null;     // what's being shared (see openShareSheet)
    let format = readFormat();
    let current = null;    // { format, blob, file, url } for the picture shown
    let renderToken = 0;

    const fileShare = canShareFiles();
    shareButton.hidden = !fileShare;
    saveButton.classList.toggle('primary', !fileShare);
    copyImageButton.hidden = fileShare || !canCopyImage();
    const TIPS = {
        story: fileShare
            ? 'Pick Instagram or TikTok to add it to your story. The link to play is on the picture.'
            : 'Save it and add it to your Instagram or TikTok story. The link to play is on the picture.',
        post: fileShare
            ? 'Pick Instagram, TikTok or a chat to post it. The link to play is on the picture.'
            : 'Save it and post it to Instagram, TikTok or a chat. The link to play is on the picture.'
    };

    const setBusy = (busy) => {
        frame.classList.toggle('loading', busy);
        [shareButton, saveButton, copyImageButton].forEach(b => { b.disabled = busy; });
    };

    // Draw the card ahead of the tap: the share menu has to open straight
    // from the tap, and some browsers refuse it after a wait.
    const render = async () => {
        const token = ++renderToken;
        setBusy(true);
        formatButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.format === format)));
        frame.dataset.format = format;
        tip.textContent = TIPS[format];
        try {
            await loadCardFonts();
            const canvas = drawShareCard(source.card, { format, highContrast: source.highContrast });
            const blob = await canvasToBlob(canvas);
            if (token !== renderToken) return;
            if (current?.url) URL.revokeObjectURL(current.url);
            const name = `${source.fileName}-${format}.png`;
            current = { format, blob, file: new File([blob], name, { type: 'image/png' }), url: URL.createObjectURL(blob) };
            preview.src = current.url;
            setBusy(false);
        } catch (err) {
            if (token !== renderToken) return;
            showToast("Sorry, the picture couldn't be made. You can still copy the text.");
            frame.classList.remove('loading');
        }
    };

    formatButtons.forEach(button => button.addEventListener('click', () => {
        if (button.dataset.format === format) return;
        format = button.dataset.format;
        saveFormat(format);
        render();
    }));

    const report = (method, extra = {}) => source?.onShare?.(method, extra);
    const imageFields = () => ({ image_format: current?.format || format });

    shareButton.addEventListener('click', async () => {
        if (!current) return;
        try {
            await navigator.share({ files: [current.file], title: source.title });
            report('image_share_sheet', imageFields());
        } catch (err) {
            if (err.name === 'AbortError') {
                report('image_share_cancelled', imageFields());
                return;
            }
            download();
        }
    });

    const download = () => {
        if (!current) return;
        const link = document.createElement('a');
        link.href = current.url;
        link.download = current.file.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        showToast('Image saved');
        report('image_download', imageFields());
    };
    saveButton.addEventListener('click', download);

    copyImageButton.addEventListener('click', async () => {
        if (!current) return;
        try {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': current.blob })]);
            showToast('Image copied to clipboard!');
            report('image_clipboard', imageFields());
        } catch (e) {
            showToast("This browser wouldn't copy the image. Save it instead.");
        }
    });

    copyTextButton.addEventListener('click', async () => {
        const method = await copyOrShow(withLink(source.text), copyTextButton);
        report(method);
    });

    dialog.addEventListener('close', () => { renderToken++; });

    const { open } = setupDialog(dialog, null, [document.getElementById('share-close')]);

    return {
        open: (next, opener) => {
            source = next;
            document.getElementById('share-title').textContent = next.heading;
            preview.alt = next.alt;
            open(opener, 'button');
            render();
        }
    };
};

// Open the share sheet from `opener`. `share` is:
//   heading   the sheet's title ("Share your score")
//   card      from describeResultCard / describeStatsCard
//   text      { text, url } for "Copy text"
//   fileName  start of the image's file name ("pseudoku-14")
//   title     passed to the share menu
//   alt       the preview's alt text
//   highContrast  draw with the high-contrast colors
//   onShare(method, extraFields)  called after each share, for analytics
export const openShareSheet = (share, opener) => {
    sheet ??= setupSheet();
    sheet.open(share, opener);
};

// Player settings: theme, high-contrast colours and hiding the timer.
// Saved in storage and applied as attributes on <html>, which the CSS reads.
// A small inline script in index.html applies them before first paint.
import { track, EVENTS } from './analytics.js';

export const SETTINGS_KEY = 'pseudokuSettings';
export const THEMES = ['system', 'light', 'dark'];
export const DEFAULT_SETTINGS = { theme: 'system', highContrast: false, hideTimer: false };

// Saved settings, with anything missing or invalid replaced by the default.
export const readSettings = (storage) => {
    let saved = null;
    try { saved = JSON.parse(storage.getItem(SETTINGS_KEY)); } catch (e) { }
    if (!saved || typeof saved !== 'object') return { ...DEFAULT_SETTINGS };
    return {
        theme: THEMES.includes(saved.theme) ? saved.theme : DEFAULT_SETTINGS.theme,
        highContrast: saved.highContrast === true,
        hideTimer: saved.hideTimer === true
    };
};

// Names used in analytics.
const SETTING_NAMES = { theme: 'theme', highContrast: 'high_contrast', hideTimer: 'hide_timer' };

export const writeSettings = (storage, settings) => {
    try { storage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { }
};

// The browser's toolbar colour should match the theme that is showing.
const THEME_COLORS = { light: '#f6f5fb', dark: '#0f0e17' };
const updateThemeColor = (theme) => {
    document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
        meta.dataset.systemContent ??= meta.content;
        meta.content = theme === 'system' ? meta.dataset.systemContent : THEME_COLORS[theme];
    });
};

export const applySettings = (settings, root = document.documentElement) => {
    if (settings.theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = settings.theme;
    if (settings.highContrast) root.dataset.contrast = 'high';
    else delete root.dataset.contrast;
    if (settings.hideTimer) root.dataset.hideTimer = '';
    else delete root.dataset.hideTimer;
    updateThemeColor(settings.theme);
};

// Wire up the settings dialog. Changes apply and save straight away.
export const setupSettingsDialog = (storage, setupDialog) => {
    const dialog = document.getElementById('settings-modal');
    const form = document.getElementById('settings-form');
    let settings = readSettings(storage);
    applySettings(settings);

    const fill = () => {
        form.elements.theme.value = settings.theme;
        form.elements.highContrast.checked = settings.highContrast;
        form.elements.hideTimer.checked = settings.hideTimer;
    };

    form.addEventListener('change', () => {
        const before = settings;
        settings = {
            theme: form.elements.theme.value,
            highContrast: form.elements.highContrast.checked,
            hideTimer: form.elements.hideTimer.checked
        };
        writeSettings(storage, settings);
        applySettings(settings);
        Object.keys(settings).forEach(key => {
            if (settings[key] !== before[key]) track(EVENTS.SETTING_CHANGE, { setting_name: SETTING_NAMES[key], setting_value: String(settings[key]) });
        });
    });
    form.addEventListener('submit', (e) => e.preventDefault());

    setupDialog(dialog, document.getElementById('settings-button'), [document.getElementById('settings-close')], fill);
    return { get: () => settings };
};

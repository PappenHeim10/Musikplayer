/**
 * utils.js — Reine Hilfsfunktionen (kein DOM-, kein Zustandsbezug).
 * Wird als erstes Renderer-Skript geladen und stellt `window.MP.utils` bereit.
 */
window.MP = window.MP || {};

window.MP.utils = {
    /**
     * Formatiert eine Zeit in Sekunden als "m:ss" (z. B. 83 → "1:23").
     * @param {number} seconds
     * @returns {string}
     */
    formatTime(seconds) {
        if (!isFinite(seconds) || seconds < 0) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    /**
     * Maskiert HTML-Sonderzeichen, damit Dateinamen sicher per innerHTML
     * eingefügt werden können (z. B. ein "&" oder "<" im Namen).
     * @param {string} text
     * @returns {string}
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Begrenzt `n` auf den Bereich [min, max].
     * @param {number} n
     * @param {number} min
     * @param {number} max
     * @returns {number}
     */
    clamp(n, min, max) {
        return Math.max(min, Math.min(max, n));
    },
};

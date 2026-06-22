/**
 * ui.js — View-Schicht: bündelt alle DOM-Referenzen und das Rendern/Anzeigen.
 * Kennt keinen Player-Zustand; bekommt alle Werte als Parameter übergeben.
 * Stellt `window.MP.ui` bereit. `init()` muss nach DOMContentLoaded laufen.
 */
window.MP = window.MP || {};

window.MP.ui = (function () {
    const { formatTime, escapeHtml, clamp } = window.MP.utils;

    // Zentrale DOM-Referenzen (gefüllt in init()).
    const dom = {};

    function init() {
        dom.playButton = document.getElementById('playButton');
        dom.prevButton = document.getElementById('prevButton');
        dom.nextButton = document.getElementById('nextButton');
        dom.stopButton = document.getElementById('stopTrackButton');
        dom.volumeSlider = document.getElementById('volumeControl');
        dom.progressBar = document.getElementById('progressBar');
        dom.currentTime = document.getElementById('currentTime');
        dom.duration = document.getElementById('duration');
        dom.eqBars = document.getElementById('eqBars');
        dom.openFolderButton = document.getElementById('openFolderButton');
        dom.songList = document.getElementById('songList')?.querySelector('ul');
        dom.emptyList = document.getElementById('leereSongListe');
        dom.nowPlaying = document.getElementById('nowPlaying');
        dom.errorMessage = document.getElementById('errorMessage');
    }

    /** Setzt die Amber-Füllung eines Pegel-Sliders (CSS-Variable --val). */
    function setMeter(meter, percent) {
        if (meter) meter.style.setProperty('--val', `${clamp(percent, 0, 100)}%`);
    }

    function showError(message) {
        if (dom.errorMessage) dom.errorMessage.textContent = message;
    }
    function clearError() {
        showError('');
    }

    function setNowPlaying(text) {
        if (dom.nowPlaying) dom.nowPlaying.textContent = text;
    }

    /** Ladezustand der Liste anzeigen. */
    function showLoading() {
        clearError();
        setNowPlaying('Lade Liste...');
        if (dom.emptyList) {
            dom.emptyList.textContent = 'Lade Liste...';
            dom.emptyList.style.display = 'block';
        }
        if (dom.songList) dom.songList.innerHTML = '';
    }

    /** Leeren Zustand (kein Ordner / keine Treffer / Fehler) anzeigen. */
    function showEmpty(emptyText, nowPlayingText) {
        if (dom.emptyList) {
            dom.emptyList.textContent = emptyText;
            dom.emptyList.style.display = 'block';
        }
        if (nowPlayingText) setNowPlaying(nowPlayingText);
        if (dom.songList) dom.songList.innerHTML = '';
    }

    /** Trackliste rendern: Track-Nummer + (maskierter) Dateiname. */
    function renderTrackList(tracks) {
        if (!dom.songList) return;
        if (dom.emptyList) dom.emptyList.style.display = 'none';
        dom.songList.innerHTML = tracks.map((filename, index) => {
            const no = String(index + 1).padStart(2, '0');
            return `<li data-index="${index}"><span class="track__no">${no}</span><span class="track__name">${escapeHtml(filename)}</span></li>`;
        }).join('');
    }

    /** Den aktuell geladenen Track in der Liste hervorheben. */
    function setActiveTrack(index) {
        if (!dom.songList) return;
        dom.songList.querySelectorAll('li').forEach((item, i) => {
            item.classList.toggle('active', i === index);
        });
    }

    /** Play/Pause-Glyph + EQ-Animation an den Wiedergabestatus anpassen. */
    function setPlaying(isPlaying) {
        if (dom.playButton) {
            dom.playButton.textContent = isPlaying ? '⏸' : '▶';
            dom.playButton.setAttribute('aria-label', isPlaying ? 'Pausieren' : 'Abspielen');
        }
        if (dom.eqBars) dom.eqBars.classList.toggle('eq--on', isPlaying);
    }

    /** Fortschrittsbalken (inkl. Füllung) und aktuelle Zeit aktualisieren. */
    function updateProgress(currentTime, duration) {
        let value = 0;
        if (duration) value = (currentTime / duration) * 100 || 0;
        if (dom.progressBar) {
            dom.progressBar.value = value;
            setMeter(dom.progressBar, value);
        }
        if (dom.currentTime) dom.currentTime.textContent = formatTime(currentTime);
    }

    function setDuration(duration) {
        if (dom.duration) dom.duration.textContent = formatTime(duration);
    }

    function resetProgress() {
        if (dom.progressBar) {
            dom.progressBar.value = 0;
            setMeter(dom.progressBar, 0);
        }
        if (dom.currentTime) dom.currentTime.textContent = '0:00';
        if (dom.duration) dom.duration.textContent = '0:00';
    }

    function setVolumeFill(value) {
        setMeter(dom.volumeSlider, value * 100);
    }

    return {
        dom, init,
        showError, clearError, setNowPlaying,
        showLoading, showEmpty, renderTrackList, setActiveTrack,
        setPlaying, updateProgress, setDuration, resetProgress, setVolumeFill,
    };
})();

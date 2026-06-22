/**
 * player.js — Audio-Engine. Kapselt das HTMLAudioElement, die Trackliste und
 * den aktuellen Index; stellt die Transport-Funktionen bereit. Hält keinen
 * eigenen "isPlaying"-Flag, sondern leitet ihn aus `audio.paused` ab.
 *
 * `MP.createPlayer(ui)` liefert eine Player-Instanz; `ui` ist die View-Schicht.
 */
window.MP = window.MP || {};

window.MP.createPlayer = function (ui) {
    const audio = new Audio();
    let tracks = [];
    let currentIndex = -1;
    let apiBaseUrl = 'http://localhost:3001';

    function setApiBaseUrl(url) { apiBaseUrl = url; }
    function setTracks(list) { tracks = list || []; currentIndex = -1; }
    function getTracks() { return tracks; }

    /** Lädt den Track an `index` (ohne automatisch abzuspielen). */
    function load(index) {
        if (index >= 0 && index < tracks.length) {
            const filename = tracks[index];
            const trackUrl = `${apiBaseUrl}/api/audio/${encodeURIComponent(filename)}`;
            console.log('Lade Track von API:', trackUrl);
            ui.clearError();
            audio.src = trackUrl;
            audio.load();
            currentIndex = index;
            ui.setNowPlaying(filename);
            ui.setActiveTrack(currentIndex);
        } else {
            console.warn('Ungültiger Index für load:', index);
            ui.setNowPlaying('Fehler beim Laden.');
            ui.showError('Fehler: Ungültiger Song-Index.');
        }
    }

    /** Lädt `index` und startet die Wiedergabe, falls `resume` true ist. */
    function playAt(index, resume) {
        load(index);
        if (resume) {
            // Kurze Verzögerung, bis die neue Quelle bereit ist.
            setTimeout(() => audio.play().catch((e) => console.error('Play fehlgeschlagen:', e)), 50);
        }
    }

    function toggle() {
        if (!audio.src || currentIndex < 0) {
            ui.showError('Kein Song geladen. Bitte Ordner wählen.');
            return;
        }
        if (!audio.paused) {
            audio.pause();
        } else {
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch((error) => {
                    console.error('Fehler beim Starten der Wiedergabe:', error);
                    ui.showError(`Fehler: ${error.message}`);
                    ui.setPlaying(false);
                });
            }
        }
    }

    function stop() {
        audio.pause();
        if (!isNaN(audio.duration) && audio.duration > 0) audio.currentTime = 0;
        ui.setNowPlaying('Gestoppt');
    }

    function next() {
        if (!tracks.length) return;
        const resume = !audio.paused;
        stop();
        playAt((currentIndex + 1) % tracks.length, resume);
    }

    function prev() {
        if (!tracks.length) return;
        const resume = !audio.paused;
        stop();
        playAt((currentIndex - 1 + tracks.length) % tracks.length, resume);
    }

    /** Track per Listenklick wählen (übernimmt den aktuellen Play-Zustand). */
    function selectTrack(index) {
        playAt(index, !audio.paused);
    }

    /** Springt entsprechend der Fortschrittsbalken-Position. */
    function seek() {
        if (audio.duration && currentIndex >= 0 && ui.dom.progressBar) {
            audio.currentTime = (ui.dom.progressBar.value / 100) * audio.duration;
        }
        ui.updateProgress(audio.currentTime, audio.duration);
    }

    function setVolume(value) {
        audio.volume = value;
        ui.setVolumeFill(value);
    }

    /** Lautstärke relativ ändern (für die Tastatursteuerung). */
    function changeVolume(delta) {
        const slider = ui.dom.volumeSlider;
        if (!slider) return;
        const next = window.MP.utils.clamp(parseFloat(slider.value) + delta, 0, 1);
        slider.value = next;
        setVolume(next);
    }

    /** Übernimmt die Lautstärke aus dem Slider (Init + 'input'-Event). */
    function applyVolumeFromSlider() {
        const slider = ui.dom.volumeSlider;
        if (slider) setVolume(parseFloat(slider.value));
    }

    /** Bindet die Events des Audio-Elements an die View. */
    function attachAudioEvents() {
        audio.addEventListener('play', () => ui.setPlaying(true));
        audio.addEventListener('pause', () => ui.setPlaying(false));
        audio.addEventListener('timeupdate', () => ui.updateProgress(audio.currentTime, audio.duration));
        audio.addEventListener('loadedmetadata', () => ui.setDuration(audio.duration));
        audio.addEventListener('durationchange', () => ui.setDuration(audio.duration));
        audio.addEventListener('ended', next);
        audio.addEventListener('canplay', () => ui.clearError());
        audio.addEventListener('loadstart', () => { ui.clearError(); ui.resetProgress(); });
        audio.addEventListener('error', () => {
            let detail = 'Unbekannter Fehler';
            if (audio.error) {
                switch (audio.error.code) {
                    case MediaError.MEDIA_ERR_ABORTED: detail = 'Laden abgebrochen.'; break;
                    case MediaError.MEDIA_ERR_NETWORK: detail = 'Netzwerkfehler.'; break;
                    case MediaError.MEDIA_ERR_DECODE: detail = 'Dekodierungsfehler.'; break;
                    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: detail = 'Format nicht unterstützt oder Quelle nicht gefunden.'; break;
                    default: detail = `Code ${audio.error.code}`;
                }
            }
            ui.showError(`Fehler beim Abspielen: ${detail}`);
            stop();
        });
    }

    return {
        setApiBaseUrl, setTracks, getTracks,
        load, toggle, stop, next, prev, selectTrack, seek,
        setVolume, changeVolume, applyVolumeFromSlider, attachAudioEvents,
    };
};

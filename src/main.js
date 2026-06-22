/**
 * main.js — Bootstrap/Controller des Renderers. Verdrahtet UI-Events mit der
 * Player-Engine, holt den API-Port, lädt die Songliste und reagiert auf die
 * Ordnerauswahl aus dem Main-Prozess. Wird als letztes Renderer-Skript geladen.
 */
document.addEventListener('DOMContentLoaded', async function () {
    const ui = window.MP.ui;
    ui.init();

    const player = window.MP.createPlayer(ui);
    player.attachAudioEvents();

    // Basis-URL der lokalen API; Port wird unten dynamisch ermittelt.
    let apiBaseUrl = 'http://localhost:3001';

    /** Lädt die Songliste von der lokalen API und aktualisiert die UI. */
    async function fetchAndDisplaySongs() {
        ui.showLoading();
        try {
            const response = await fetch(`${apiBaseUrl}/api/songs`);
            if (!response.ok) {
                let message = `Fehler beim Laden der Songliste: ${response.statusText}`;
                let noFolder = false;
                try {
                    const data = await response.json();
                    if (data && data.error) {
                        message = data.error;
                        // 404 "Musikordner nicht ausgewählt" ist kein echter Fehler,
                        // sondern der Normalzustand vor der ersten Ordnerwahl.
                        noFolder = response.status === 404;
                    }
                } catch (e) { /* JSON-Parsing-Fehler hier ignorieren */ }

                if (noFolder) {
                    player.setTracks([]);
                    ui.clearError();
                    ui.showEmpty('Bitte Ordner wählen.', 'Nichts ausgewählt');
                    return;
                }
                throw new Error(message);
            }

            const filenames = await response.json();
            const tracks = filenames || [];
            player.setTracks(tracks);

            if (tracks.length > 0) {
                ui.renderTrackList(tracks);
                ui.setNowPlaying('Wähle einen Song');
            } else {
                ui.showEmpty('Keine Audiodateien im Ordner.', 'Keine Songs');
            }
        } catch (error) {
            console.error('Fehler beim Holen der Songliste:', error);
            player.setTracks([]);
            ui.showError(`Fehler: ${error.message}`);
            ui.showEmpty('Fehler beim Laden der Liste.', 'Fehler');
        }
    }

    // --- Event-Verdrahtung ---

    // Klick auf einen Listeneintrag → Track laden/abspielen.
    ui.dom.songList?.addEventListener('click', (event) => {
        const li = event.target?.closest('li');
        if (li && li.dataset.index !== undefined) {
            const index = parseInt(li.dataset.index, 10);
            if (!isNaN(index)) player.selectTrack(index);
        }
    });

    // Transport-Buttons.
    ui.dom.playButton?.addEventListener('click', () => player.toggle());
    ui.dom.nextButton?.addEventListener('click', () => player.next());
    ui.dom.prevButton?.addEventListener('click', () => player.prev());
    ui.dom.stopButton?.addEventListener('click', () => player.stop());
    ui.dom.volumeSlider?.addEventListener('input', () => player.applyVolumeFromSlider());
    ui.dom.progressBar?.addEventListener('input', () => player.seek());

    // Tastatursteuerung: Leertaste = Play/Pause, ←/→ = Titel, ↑/↓ = Lautstärke.
    // Greift nicht, wenn ein Eingabefeld (Slider) fokussiert ist.
    document.addEventListener('keydown', (event) => {
        if (event.target instanceof HTMLInputElement) return;
        switch (event.code) {
            case 'Space': event.preventDefault(); player.toggle(); break;
            case 'ArrowRight': event.preventDefault(); player.next(); break;
            case 'ArrowLeft': event.preventDefault(); player.prev(); break;
            case 'ArrowUp': event.preventDefault(); player.changeVolume(0.05); break;
            case 'ArrowDown': event.preventDefault(); player.changeVolume(-0.05); break;
        }
    });

    // Ordnerauswahl.
    ui.dom.openFolderButton?.addEventListener('click', () => {
        ui.clearError();
        window.electronAPI?.openMusicFolderDialog();
    });

    if (window.electronAPI && typeof window.electronAPI.onMusicFolderSelected === 'function') {
        window.electronAPI.onMusicFolderSelected(() => {
            console.log('Ordnerauswahl bestätigt – lade Songliste neu.');
            player.stop();
            fetchAndDisplaySongs();
        });
    } else {
        console.error('window.electronAPI.onMusicFolderSelected nicht verfügbar – preload.js geladen?');
        ui.showError('Fehler: Verbindung zum Backend fehlt.');
    }

    // --- Initialisierung ---

    // Tatsächlichen API-Port vom Main-Prozess holen (kann von 3001 abweichen).
    try {
        if (window.electronAPI?.getApiPort) {
            const port = await window.electronAPI.getApiPort();
            if (port) apiBaseUrl = `http://localhost:${port}`;
        }
    } catch (e) {
        console.error('Konnte API-Port nicht ermitteln, nutze Fallback:', e);
    }
    player.setApiBaseUrl(apiBaseUrl);
    console.log('API-Basis-URL:', apiBaseUrl);

    player.applyVolumeFromSlider(); // initiale Lautstärke + Füllung
    fetchAndDisplaySongs();
});

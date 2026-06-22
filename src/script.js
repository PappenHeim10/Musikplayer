/**
 * Renderer-Prozess Skript (script.js) für den Electron Musik Player
 * Nutzt die lokale REST API (http://localhost:3001) zum Laden der Songliste und Audiodateien.
 */
document.addEventListener("DOMContentLoaded", async function () {
    // DOM-Elemente holen
    const playButton = document.getElementById("playButton");
    const nextButton = document.getElementById("nextButton");
    const prevButton = document.getElementById("prevButton");
    const stopButton = document.getElementById("stopTrackButton");
    const volumeSlider = document.getElementById("volumeControl");
    const progressBar = document.getElementById("progressBar");
    const currentTimeElement = document.getElementById("currentTime");
    const durationElement = document.getElementById("duration");
    const eqBars = document.getElementById("eqBars");
    const openFolderButton = document.getElementById("openFolderButton");
    const songListElement = document.getElementById("songList")?.querySelector('ul'); // Sicherstellen, dass UL existiert
    const leereListeElement = document.getElementById("leereSongListe");
    const nowPlayingElement = document.getElementById("nowPlaying");
    const errorMessageElement = document.getElementById("errorMessage");

    // Player-Zustand
    let audio = new Audio(); // Das HTMLAudioElement für die Wiedergabe
    let currentTrackIndex = -1; // Index des aktuellen Tracks in der 'tracks'-Liste, -1 für keinen
    let isPlaying = false; // Spielt gerade ein Track?
    let tracks = []; // Array zum Speichern der Dateinamen der Songs

    // Basis-URL für die lokale API. Der Port wird beim Start dynamisch vom
    // Main-Prozess geholt (kann vom Standard 3001 abweichen). Wert dient als Fallback.
    let API_BASE_URL = 'http://localhost:3001';

    // --- Kernfunktionen ---

    /**
     * Maskiert HTML-Sonderzeichen, damit Dateinamen sicher per innerHTML
     * eingefügt werden können (z. B. ein "&" oder "<" im Namen).
     * @param {string} text
     * @returns {string}
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Setzt die Amber-Füllung eines Pegel-Sliders (CSS-Variable --val).
     * @param {HTMLElement} meter
     * @param {number} percent - 0..100
     */
    function setMeterFill(meter, percent) {
        if (meter) meter.style.setProperty('--val', `${Math.max(0, Math.min(100, percent))}%`);
    }

    /**
     * Lädt die Songliste von der lokalen API und aktualisiert die UI.
     */
    async function fetchAndDisplaySongs() {
        console.log("Versuche Songliste von API zu laden...");
        errorMessageElement.textContent = ''; // Alte Fehler löschen
        nowPlayingElement.textContent = 'Lade Liste...';
        leereListeElement.textContent = 'Lade Liste...'; // Update Platzhaltertext
        leereListeElement.style.display = 'block';
        if (songListElement) songListElement.innerHTML = ''; // Liste leeren

        try {
            const response = await fetch(`${API_BASE_URL}/api/songs`);
            if (!response.ok) {
                // Versuch, eine Fehlermeldung vom Server zu bekommen
                let errorMsg = `Fehler beim Laden der Songliste: ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    if (errorData && errorData.error) {
                        errorMsg = errorData.error; // Z.B. "Musikordner nicht ausgewählt"
                    }
                } catch (e) { /* Ignoriere JSON-Parsing-Fehler hier */ }
                throw new Error(errorMsg);
            }

            const fetchedFilenames = await response.json();
            tracks = fetchedFilenames || []; // Speichere die Dateinamen

            console.log("Empfangene Dateinamen:", tracks);

            if (tracks.length > 0) {
                leereListeElement.style.display = 'none'; // Platzhalter ausblenden
                nowPlayingElement.textContent = 'Wähle einen Song';
                // Liste mit Dateinamen füllen
                if (songListElement) {
                    songListElement.innerHTML = tracks.map((filename, index) => {
                        // Track-Nummer (Position) + Dateiname; Name wird maskiert
                        const no = String(index + 1).padStart(2, '0');
                        return `<li data-index="${index}"><span class="track__no">${no}</span><span class="track__name">${escapeHtml(filename)}</span></li>`;
                    }).join('');
                    setupSongListClick(); // Klick-Listener für die Liste aktivieren
                }
                 // Ersten Track laden (optional, ohne Autoplay)
                 // loadTrack(0);
            } else {
                 leereListeElement.textContent = 'Keine Audiodateien im Ordner.';
                 nowPlayingElement.textContent = 'Keine Songs';
            }

        } catch (error) {
            console.error("Fehler beim Holen der Songliste:", error);
            errorMessageElement.textContent = `Fehler: ${error.message}`;
            leereListeElement.textContent = 'Fehler beim Laden der Liste.';
             leereListeElement.style.display = 'block';
            nowPlayingElement.textContent = 'Fehler';
            tracks = []; // Liste leeren im Fehlerfall
            if (songListElement) songListElement.innerHTML = '';
        }
    }

    /**
     * Lädt einen bestimmten Track basierend auf seinem Index in der 'tracks'-Liste.
     * Setzt die src des Audio-Elements auf die entsprechende API-URL.
     * @param {number} index - Der Index des zu ladenden Tracks im 'tracks'-Array.
     */
    function loadTrack(index) {
        if (index >= 0 && index < tracks.length) {
            const filename = tracks[index];
            // Wichtig: Dateiname korrekt für URL kodieren!
            const trackUrl = `${API_BASE_URL}/api/audio/${encodeURIComponent(filename)}`;

            console.log("Lade Track von API:", trackUrl);
            errorMessageElement.textContent = ''; // Alte Fehler löschen

            audio.src = trackUrl; // Die HTTP-URL setzen
            audio.load(); // load() aufrufen
            currentTrackIndex = index;

            // UI aktualisieren
            nowPlayingElement.textContent = `${filename}`;
            updateSongListHighlight();

        } else {
            console.warn("Ungültiger Index für loadTrack:", index);
            nowPlayingElement.textContent = 'Fehler beim Laden.';
            errorMessageElement.textContent = 'Fehler: Ungültiger Song-Index.';
        }
    }

    /**
     * Spielt den aktuell geladenen Track ab oder pausiert ihn.
     */
    function togglePlayPause() {
        if (!audio.src || currentTrackIndex < 0) {
            errorMessageElement.textContent = 'Kein Song geladen. Bitte Ordner wählen.';
            console.log("Kein Song zum Abspielen/Pausieren geladen.");
            return;
        }

        if (isPlaying) {
            audio.pause();
        } else {
            // audio.play() gibt ein Promise zurück
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    // Fehler beim Abspielen (z.B. Browser erfordert Nutzerinteraktion)
                    console.error("Fehler beim Starten der Wiedergabe:", error);
                    errorMessageElement.textContent = `Fehler: ${error.message}`;
                    isPlaying = false; // Sicherstellen, dass der Status korrekt ist
                    playButton.textContent = "▶";
                    playButton.setAttribute("aria-label", "Abspielen");
                    if (eqBars) eqBars.classList.remove("eq--on");
                });
            }
        }
    }

    /**
     * Stoppt die Wiedergabe und setzt die Zeit zurück.
     */
    function stopTrack() {
        audio.pause();
        // Nur zurücksetzen, wenn ein Track geladen ist
        if (!isNaN(audio.duration) && audio.duration > 0) {
             audio.currentTime = 0;
        }
        // isPlaying wird durch 'pause'-Event aktualisiert
        // progressBar.value = 0; // Wird durch 'timeupdate'-Event aktualisiert
        nowPlayingElement.textContent = 'Gestoppt';
        console.log("Gestoppt");
    }

    /**
     * Lädt und spielt den nächsten Track in der Liste.
     */
    function nextTrack() {
        if (tracks.length > 0) {
            const wasPlaying = isPlaying; // Merken, ob vorher gespielt wurde
            stopTrack(); // Aktuellen stoppen
            const nextIndex = (currentTrackIndex + 1) % tracks.length;
            loadTrack(nextIndex);
            // Wenn vorher gespielt wurde, den neuen Track direkt starten
            if (wasPlaying) {
                 // Kurze Verzögerung manchmal hilfreich
                 setTimeout(() => audio.play().catch(e => console.error("Play failed after next:", e)), 50);
            }
        } else {
             console.log("Keine Tracks in der Liste für 'Next'.");
        }
    }

    /**
     * Lädt und spielt den vorherigen Track in der Liste.
     */
    function prevTrack() {
        if (tracks.length > 0) {
             const wasPlaying = isPlaying;
             stopTrack();
            const prevIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
            loadTrack(prevIndex);
             if (wasPlaying) {
                 setTimeout(() => audio.play().catch(e => console.error("Play failed after prev:", e)), 50);
            }
        } else {
             console.log("Keine Tracks in der Liste für 'Prev'.");
        }
    }

    // --- UI Hilfsfunktionen ---

    /**
     * Formatiert eine Zeit in Sekunden als "m:ss" (z. B. 83 → "1:23").
     * @param {number} seconds
     * @returns {string}
     */
    function formatTime(seconds) {
        if (!isFinite(seconds) || seconds < 0) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Aktualisiert die Anzeige der Gesamtdauer (sobald Metadaten geladen sind).
     */
    function updateDurationDisplay() {
        if (durationElement) {
            durationElement.textContent = formatTime(audio.duration);
        }
    }

    /**
     * Aktualisiert die Lautstärke des Audio-Elements basierend auf dem Slider.
     */
    function updateVolume() {
        if (volumeSlider) {
            audio.volume = volumeSlider.value;
            setMeterFill(volumeSlider, volumeSlider.value * 100);
        }
    }

    /**
     * Ändert die Lautstärke um `delta` (geclamped auf 0..1) und hält Slider +
     * Audio synchron. Wird von der Tastatursteuerung genutzt.
     * @param {number} delta
     */
    function changeVolume(delta) {
        if (!volumeSlider) return;
        const next = Math.min(1, Math.max(0, parseFloat(volumeSlider.value) + delta));
        volumeSlider.value = next;
        updateVolume();
    }

    /**
     * Aktualisiert den Fortschrittsbalken (inkl. Amber-Füllung) und die
     * Zeitanzeige anhand der aktuellen Wiedergabezeit.
     */
    function updateProgressBar() {
        let value = 0;
        if (progressBar && audio.duration) { // Nur wenn Dauer bekannt ist
            value = (audio.currentTime / audio.duration) * 100 || 0;
        }
        if (progressBar) {
            progressBar.value = value;
            setMeterFill(progressBar, value);
        }
        if (currentTimeElement) {
            currentTimeElement.textContent = formatTime(audio.currentTime);
        }
    }

    /**
     * Verarbeitet das Springen im Track durch Klicken/Ziehen des Fortschrittsbalkens.
     */
    function seekTrack() {
         if (progressBar && audio.duration && currentTrackIndex >= 0) {
             const time = (progressBar.value / 100) * audio.duration;
             audio.currentTime = time;
         }
         if (progressBar) setMeterFill(progressBar, progressBar.value);
     }


    /**
     * Fügt Event-Listener zu den Listeneinträgen hinzu, um Tracks per Klick zu laden.
     */
    function setupSongListClick() {
        if (!songListElement) return;
        songListElement.addEventListener('click', (event) => {
            const targetLi = event.target?.closest('li'); // Klick auf LI oder Kindelement?
            if (targetLi && targetLi.dataset.index !== undefined) {
                const indexToPlay = parseInt(targetLi.dataset.index, 10);
                if (!isNaN(indexToPlay)) {
                    const wasPlaying = isPlaying;
                    // stopTrack(); // Nicht stoppen, loadTrack macht das implizit durch src-Änderung
                    loadTrack(indexToPlay);
                    if (wasPlaying) {
                         setTimeout(() => audio.play().catch(e => console.error("Play failed after list click:", e)), 50);
                    }
                }
            }
        });
    }

    /**
     * Hebt den aktuell geladenen Song in der Liste hervor.
     */
    function updateSongListHighlight() {
         if (!songListElement) return;
         const listItems = songListElement.querySelectorAll('li');
         listItems.forEach((item, index) => {
             item.classList.toggle('active', index === currentTrackIndex);
         });
     }


    // --- Event Listener Initialisierung ---

    // Player Controls
    if (playButton) playButton.addEventListener("click", togglePlayPause);
    if (nextButton) nextButton.addEventListener("click", nextTrack);
    if (prevButton) prevButton.addEventListener("click", prevTrack);
    if (stopButton) stopButton.addEventListener("click", stopTrack);
    if (volumeSlider) volumeSlider.addEventListener("input", updateVolume);
    if (progressBar) progressBar.addEventListener("input", seekTrack); // Listener für Seeking

    // Tastatursteuerung: Leertaste = Play/Pause, ← / → = Zurück / Weiter,
    // ↑ / ↓ = Lautstärke. Greift nicht, wenn ein Eingabefeld (z. B. ein Slider)
    // fokussiert ist, damit dessen Standardverhalten erhalten bleibt.
    document.addEventListener("keydown", (event) => {
        if (event.target instanceof HTMLInputElement) return;
        switch (event.code) {
            case "Space":
                event.preventDefault(); // verhindert Scrollen / erneutes Klicken eines fokussierten Buttons
                togglePlayPause();
                break;
            case "ArrowRight":
                event.preventDefault();
                nextTrack();
                break;
            case "ArrowLeft":
                event.preventDefault();
                prevTrack();
                break;
            case "ArrowUp":
                event.preventDefault();
                changeVolume(0.05);
                break;
            case "ArrowDown":
                event.preventDefault();
                changeVolume(-0.05);
                break;
        }
    });

    // Audio Element Events
    audio.addEventListener("play", () => {
        isPlaying = true;
        playButton.textContent = "⏸";
        playButton.setAttribute("aria-label", "Pausieren");
        if (eqBars) eqBars.classList.add("eq--on");
        console.log("Event: play");
    });

    audio.addEventListener("pause", () => {
        isPlaying = false;
        playButton.textContent = "▶";
        playButton.setAttribute("aria-label", "Abspielen");
        if (eqBars) eqBars.classList.remove("eq--on");
        console.log("Event: pause");
    });

    audio.addEventListener("timeupdate", updateProgressBar);
    // Gesamtdauer anzeigen, sobald die Metadaten geladen sind / sich ändern
    audio.addEventListener("loadedmetadata", updateDurationDisplay);
    audio.addEventListener("durationchange", updateDurationDisplay);
    audio.addEventListener("ended", nextTrack); // Zum nächsten Song springen, wenn einer endet

    audio.addEventListener("error", (e) => {
        console.error("Audio Wiedergabefehler:", audio.error, e);
        let errorDetail = 'Unbekannter Fehler';
        if (audio.error) {
            switch (audio.error.code) {
                case MediaError.MEDIA_ERR_ABORTED: errorDetail = 'Laden abgebrochen.'; break;
                case MediaError.MEDIA_ERR_NETWORK: errorDetail = 'Netzwerkfehler.'; break;
                case MediaError.MEDIA_ERR_DECODE: errorDetail = 'Dekodierungsfehler.'; break;
                case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: errorDetail = 'Format nicht unterstützt oder Quelle nicht gefunden.'; break;
                default: errorDetail = `Code ${audio.error.code}`;
            }
        }
        errorMessageElement.textContent = `Fehler beim Abspielen: ${errorDetail}`;
        stopTrack(); // Wiedergabe stoppen bei Fehler
    });

     audio.addEventListener("canplay", () => {
         // Track ist bereit zum Abspielen (genug Daten geladen)
         errorMessageElement.textContent = ''; // Alte Fehler löschen
         console.log("Event: canplay");
     });

     audio.addEventListener("loadstart", () => {
         // Beginnt mit dem Laden der Ressource
         console.log("Event: loadstart");
         errorMessageElement.textContent = ''; // Fehler löschen beim Starten eines neuen Ladevorgangs
          // Setze Progressbar und Zeitanzeige zurück, während geladen wird
          if (progressBar) { progressBar.value = 0; setMeterFill(progressBar, 0); }
          if (currentTimeElement) currentTimeElement.textContent = '0:00';
          if (durationElement) durationElement.textContent = '0:00';
     });

    // Ordnerauswahl
    if (openFolderButton) {
        openFolderButton.addEventListener('click', () => {
            console.log("Öffne Ordnerauswahl-Dialog...");
            errorMessageElement.textContent = ''; // Alte Fehler löschen
            // Ruft die Funktion im Main-Prozess auf
            window.electronAPI.openMusicFolderDialog();
            // Die Liste wird über den 'onMusicFolderSelected' Listener aktualisiert
        });
    } else {
         console.error("Button 'openFolderButton' nicht gefunden!");
    }

    // Listener für Bestätigung der Ordnerauswahl vom Main-Prozess
    if (window.electronAPI && typeof window.electronAPI.onMusicFolderSelected === 'function') {
        window.electronAPI.onMusicFolderSelected(() => {
            console.log("Main-Prozess hat Ordnerauswahl bestätigt. Lade Songliste neu.");
            // Wichtig: Nach Ordnerauswahl die Songliste neu laden
            fetchAndDisplaySongs();
            // Optional: Player zurücksetzen
            stopTrack();
            currentTrackIndex = -1;
            if (songListElement) songListElement.innerHTML = '';
            leereListeElement.style.display = 'block';
            leereListeElement.textContent = 'Lade Liste...';
        });
    } else {
        console.error("Fehler: window.electronAPI.onMusicFolderSelected ist nicht verfügbar! Wurde preload.js korrekt geladen?");
         errorMessageElement.textContent = "Fehler: Verbindung zum Backend fehlt.";
    }


    // --- Initialisierung beim Laden der Seite ---
    console.log("DOM geladen. Initialisiere Player.");

    // Tatsächlichen API-Port vom Main-Prozess holen (kann vom Standard 3001
    // abweichen, falls dieser belegt war). Bei Fehler bleibt der Fallback aktiv.
    try {
        if (window.electronAPI?.getApiPort) {
            const port = await window.electronAPI.getApiPort();
            if (port) API_BASE_URL = `http://localhost:${port}`;
        }
    } catch (e) {
        console.error("Konnte API-Port nicht ermitteln, nutze Fallback:", e);
    }
    console.log("API-Basis-URL:", API_BASE_URL);

    // Setze initiale Lautstärke
    updateVolume();
    // Versuche, die Songliste initial zu laden (falls schon ein Ordner im Backend gesetzt ist)
    fetchAndDisplaySongs();
    // Stelle sicher, dass der Platzhalter korrekt angezeigt wird, falls fetch fehlschlägt
    if (tracks.length === 0) {
        leereListeElement.style.display = 'block';
        leereListeElement.textContent = 'Bitte Ordner wählen.';
         nowPlayingElement.textContent = 'Nichts ausgewählt';
    }

}); // Ende DOMContentLoaded
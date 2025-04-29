/**
 * Renderer-Prozess Skript (script.js) für den Electron Musik Player
 * Nutzt die lokale REST API (http://localhost:3001) zum Laden der Songliste und Audiodateien.
 */
document.addEventListener("DOMContentLoaded", function () {
    // DOM-Elemente holen
    const playButton = document.getElementById("playButton");
    const nextButton = document.getElementById("nextButton");
    const prevButton = document.getElementById("prevButton");
    const stopButton = document.getElementById("stopTrackButton");
    const volumeSlider = document.getElementById("volumeControl");
    const progressBar = document.getElementById("progressBar");
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

    const API_BASE_URL = 'http://localhost:3001'; // Basis-URL für die lokale API

    // --- Kernfunktionen ---

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
                        // Einfacher Dateiname ohne Pfad wird angezeigt
                        return `<li data-index="${index}">${filename}</li>`;
                    }).join('');
                    setupSongListClick(); // Klick-Listener für die Liste aktivieren
                }
                 // Ersten Track laden (optional, ohne Autoplay)
                 // loadTrack(0);
            } else {
                 leereListeElement.textContent = 'Keine MP3s im Ordner gefunden.';
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
            nowPlayingElement.textContent = `Geladen: ${filename}`;
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
                    playButton.textContent = "Play";
                    playButton.classList.remove("playing");
                    playButton.classList.add("pausing");
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
     * Aktualisiert die Lautstärke des Audio-Elements basierend auf dem Slider.
     */
    function updateVolume() {
        if (volumeSlider) {
            audio.volume = volumeSlider.value;
        }
    }

    /**
     * Aktualisiert den Fortschrittsbalken basierend auf der aktuellen Wiedergabezeit.
     */
    function updateProgressBar() {
        if (progressBar && audio.duration) { // Nur wenn Dauer bekannt ist
            const value = (audio.currentTime / audio.duration) * 100;
            progressBar.value = value || 0;
        } else if (progressBar) {
            progressBar.value = 0; // Zurücksetzen, wenn keine Dauer
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
             if (index === currentTrackIndex) {
                 item.style.fontWeight = 'bold';
                 item.style.backgroundColor = '#e0e0e0'; // Beispiel-Hervorhebung
             } else {
                 item.style.fontWeight = 'normal';
                 item.style.backgroundColor = '';
             }
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

    // Audio Element Events
    audio.addEventListener("play", () => {
        isPlaying = true;
        playButton.textContent = "Pause";
        playButton.classList.remove("pausing");
        playButton.classList.add("playing");
        console.log("Event: play");
    });

    audio.addEventListener("pause", () => {
        isPlaying = false;
        playButton.textContent = "Play";
        playButton.classList.remove("playing");
        playButton.classList.add("pausing");
        console.log("Event: pause");
    });

    audio.addEventListener("timeupdate", updateProgressBar);
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
          // Setze Progressbar zurück, während geladen wird
          if (progressBar) progressBar.value = 0;
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
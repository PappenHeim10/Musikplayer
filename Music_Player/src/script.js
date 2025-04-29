document.addEventListener("DOMContentLoaded", function () {
    const playButton = document.getElementById("playButton");
    const nextButton = document.getElementById("nextButton"); // Korrigierte ID
    const prevButton = document.getElementById("prevButton"); // Korrigierte ID
    const stopButton = document.getElementById("stopTrackButton"); // Hinzugefügt
    const volumeSlider = document.getElementById("volumeControl");
    const progressBar = document.getElementById("progressBar");
    const openFolderButton = document.getElementById("openFolderButton");
    const songList = document.getElementById("songList").querySelector('ul'); // UL selektieren
    const leereListe = document.getElementById("leereSongListe");
    const nowPlayingElement = document.getElementById("nowPlaying");
    const errorMessageElement = document.getElementById("errorMessage");

    let audio = new Audio(); // Das dynamische Audio-Objekt ist gut
    let currentTrackIndex = -1; // Startet bei -1, da noch nichts geladen
    let isPlaying = false;
    let tracks = []; // Wird die Liste der 'safe-file://' URLs enthalten

    // --- Empfange die Musikdatei-URLs ---
    window.electronAPI.sendMusicFiles((data) => {
        console.log("Empfangene Song-URLs:", data.musicFiles);
        tracks = data.musicFiles || []; // Empfangene URLs speichern (oder leeres Array)
        errorMessageElement.textContent = ''; // Alte Fehler löschen

        if (tracks.length > 0) {
             leereListe.style.display = 'none'; // Platzhalter ausblenden
            // Liste mit Dateinamen füllen
            songList.innerHTML = tracks.map(trackUrl => {
                try {
                    // Extrahiere den Dateinamen aus der URL
                    const decodedPath = decodeURI(trackUrl.slice('safe-file://'.length));
                    const filename = decodedPath.split(/[\\/]/).pop(); // Funktioniert plattformübergreifend
                    return `<li data-url="${trackUrl}">${filename}</li>`; // URL als data-Attribut speichern
                } catch(e) {
                    console.error("Fehler beim Dekodieren/Anzeigen des Tracks:", trackUrl, e);
                    return `<li>Track konnte nicht angezeigt werden</li>`;
                }
            }).join('');
            // Optional: Ersten Track laden, aber noch nicht abspielen
             loadTrack(0);
             // Mache die Liste klickbar
             setupSongListClick();
        } else {
            songList.innerHTML = ''; // Liste leeren
             leereListe.style.display = 'block'; // Platzhalter anzeigen
             nowPlayingElement.textContent = 'Keine Songs gefunden.';
             audio.src = ''; // Audio-Quelle zurücksetzen
        }
    });

    // --- Track laden ---
    function loadTrack(index) {
        if (index >= 0 && index < tracks.length) {
            const trackUrl = tracks[index];
            console.log("Lade Track:", trackUrl);
            audio.src = trackUrl; // Die 'safe-file://' URL setzen
            audio.load(); // Wichtig: load() aufrufen nach src-Änderung
            currentTrackIndex = index;

            // Update "Now Playing" Anzeige
            try {
                 const decodedPath = decodeURI(trackUrl.slice('safe-file://'.length));
                 const filename = decodedPath.split(/[\\/]/).pop();
                 nowPlayingElement.textContent = `Geladen: ${filename}`;
            } catch(e) {
                 nowPlayingElement.textContent = `Geladen: Fehler`;
            }
             updateSongListHighlight(); // Markiere den aktuellen Song in der Liste


        } else {
            console.warn("Ungültiger Index für loadTrack:", index);
            nowPlayingElement.textContent = 'Fehler beim Laden.';
        }
    }

    // --- Track abspielen/pausieren (verbessert mit Promise) ---
    function togglePlayPause() {
        if (!audio.src || currentTrackIndex < 0) {
            errorMessageElement.textContent = 'Bitte zuerst einen Ordner wählen.';
            return;
        }

        if (isPlaying) {
            audio.pause();
            isPlaying = false;
            playButton.textContent = "Play";
            console.log("Pausiert");
        } else {
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    isPlaying = true;
                    playButton.textContent = "Pause";
                    console.log("Spielt");
                    errorMessageElement.textContent = ''; // Fehler löschen
                     // Update "Now Playing" auf "Spielt: ..."
                    try {
                        const decodedPath = decodeURI(audio.src.slice('safe-file://'.length));
                        const filename = decodedPath.split(/[\\/]/).pop();
                        nowPlayingElement.textContent = `Spielt: ${filename}`;
                   } catch(e) {
                        nowPlayingElement.textContent = `Spielt: Fehler`;
                   }

                }).catch(error => {
                    console.error("Fehler beim Abspielen:", error);
                    errorMessageElement.textContent = `Fehler: ${error.message}`;
                    isPlaying = false;
                    playButton.textContent = "Play";
                });
            }
        }
    }


    // --- Track stoppen ---
    function stopTrack() {
        audio.pause();
        audio.currentTime = 0; // Zeit zurücksetzen
        isPlaying = false;
        playButton.textContent = "Play";
        progressBar.value = 0; // Fortschrittsbalken zurücksetzen
        nowPlayingElement.textContent = 'Gestoppt';
        console.log("Gestoppt");
    }

    // --- Nächster Track ---
    function nextTrack() {
        if (tracks.length > 0) {
            const nextIndex = (currentTrackIndex + 1) % tracks.length;
            loadTrack(nextIndex);
            // Wenn vorher gespielt wurde, direkt weiter spielen
            if (isPlaying || playButton.textContent === "Pause") { // Check button text as fallback
                 // Kurze Verzögerung, damit 'load' Zeit hat, sonst schlägt play() manchmal fehl
                 setTimeout(() => togglePlayPause(), 50);
            }
        }
    }

    // --- Vorheriger Track ---
    function prevTrack() {
        if (tracks.length > 0) {
            const prevIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
            loadTrack(prevIndex);
             if (isPlaying || playButton.textContent === "Pause") {
                 setTimeout(() => togglePlayPause(), 50);
            }
        }
    }

    // --- Lautstärke aktualisieren ---
    function updateVolume() {
        audio.volume = volumeSlider.value;
    }

    // --- Fortschrittsbalken aktualisieren ---
    function updateProgressBar() {
        if (audio.duration) { // Nur wenn Dauer bekannt ist (NaN vermeiden)
            progressBar.value = (audio.currentTime / audio.duration) * 100;
        } else {
            progressBar.value = 0;
        }
    }

    // --- Springen im Track via Fortschrittsbalken ---
     progressBar.addEventListener('input', () => {
         if (audio.duration && currentTrackIndex >= 0) {
             const time = (progressBar.value / 100) * audio.duration;
             audio.currentTime = time;
         }
     });


    // --- Klick auf Song in der Liste ---
    function setupSongListClick() {
        songList.addEventListener('click', (event) => {
            if (event.target && event.target.nodeName === 'LI') {
                const urlToPlay = event.target.dataset.url;
                const indexToPlay = tracks.indexOf(urlToPlay);
                if (indexToPlay !== -1) {
                     loadTrack(indexToPlay);
                     // Wenn gerade pausiert war oder gestoppt, nur laden. Wenn gespielt -> direkt abspielen
                     if (isPlaying || playButton.textContent === "Pause"){
                          setTimeout(() => togglePlayPause(), 50); // Start playing
                     } else {
                          // Nur laden, nicht automatisch starten wenn pausiert/gestoppt war
                     }
                }
            }
        });
    }

     // --- Markiere aktuellen Song in der Liste ---
     function updateSongListHighlight() {
         const listItems = songList.querySelectorAll('li');
         listItems.forEach((item, index) => {
             if (index === currentTrackIndex) {
                 item.style.fontWeight = 'bold'; // Oder eine CSS-Klasse hinzufügen
                 item.style.backgroundColor = '#eee';
             } else {
                 item.style.fontWeight = 'normal';
                  item.style.backgroundColor = '';
             }
         });
     }


    // --- Event Listener ---
    playButton.addEventListener("click", togglePlayPause);
    nextButton.addEventListener("click", nextTrack);
    prevButton.addEventListener("click", prevTrack);
    if (stopButton) stopButton.addEventListener("click", stopTrack); // Listener für Stop
    volumeSlider.addEventListener("input", updateVolume);

    // Audio-Events
    audio.addEventListener("timeupdate", updateProgressBar);
    audio.addEventListener("ended", nextTrack); // Automatisch zum nächsten Titel springen
    audio.addEventListener("error", (e) => {
        console.error("Audio Wiedergabefehler:", audio.error, e);
        errorMessageElement.textContent = `Fehler beim Abspielen: ${audio.error?.message || 'Unbekannt'}`;
        stopTrack(); // Wiedergabe stoppen bei Fehler
    });
     audio.addEventListener("canplay", () => {
         // Track ist bereit zum Abspielen (genug Daten geladen)
         errorMessageElement.textContent = ''; // Fehler löschen, falls einer angezeigt wurde
     });


    // Ordnerauswahl starten
    openFolderButton.addEventListener('click', () => {
        console.log("Öffne Ordnerauswahl...");
        errorMessageElement.textContent = ''; // Alte Fehler löschen
        window.electronAPI.openMusicFolderDialog(); // Kein await nötig
    });

    // Initialer Zustand
     leereListe.style.display = 'block';
     songList.innerHTML = '';
     progressBar.value = 0;

}); // Ende DOMContentLoaded
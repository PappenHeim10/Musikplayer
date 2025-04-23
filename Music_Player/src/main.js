const { ipcRenderer } = require('electron'); //FIXME: Hier Wird immernoch ein -requier is not defined- Fehler geworfen

const songList = document.querySelector('#songList');
const errorMessage = document.querySelector('#errorMessage');
const player = document.querySelector('#player');
const nowPlaying = document.querySelector('#nowPlaying');
const audioPlayer = document.querySelector('#audioPlayer');
const nextSong = document.querySelector('#nextSong');
const previousSong = document.querySelector('#previousSong');
const audioSource = document.querySelector('#audioSource');

// Funktion zum Anzeigen der Trackliste im HTML
function renderTrackList(trackList) {
    if (!songList) {
        console.error("Element #songList nicht gefunden.");
        return;
    }
    songList.innerHTML = ''; // Leere die Liste, bevor neue Elemente hinzugefügt werden

    trackList.forEach(track => {
        const li = document.createElement('li');
        li.textContent = track.name;
        li.addEventListener('click', () => {
            playTrack(track);
        });
        songList.appendChild(li);
    });
}

// Funktion zum Abspielen eines Tracks
function playTrack(track) {
    if (!audioPlayer || !audioSource) {
        console.error("Element #audioPlayer oder #audioSource nicht gefunden.");
        return;
    }
    audioSource.src = track.pfad;
    audioPlayer.load();
    audioPlayer.play();
    nowPlaying.textContent = `Aktuell: ${track.name}`;
}

// Hauptprozess nach der Trackliste fragen
async function getTracklist() {
    try {
        const tracklist = await ipcRenderer.invoke('get-tracklist');
        console.log("Tracklist erhalten:", tracklist);
        renderTrackList(tracklist);
    } catch (error) {
        console.error("Fehler beim Abrufen der Trackliste:", error);
        errorMessage.textContent = 'Fehler beim Laden der Musikdateien.';
    }
}

getTracklist();

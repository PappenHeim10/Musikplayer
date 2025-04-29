document.addEventListener("DOMContentLoaded", function () {
    const playButton = document.getElementById("playButton");
    const nextButton = document.getElementById("nextSong");
    const prevButton = document.getElementById("previousSong");
    const volumeSlider = document.getElementById("volumeControl");
    const progressBar = document.getElementById("progressBar");
    const openFolderButton = document.getElementById("openFolderButton");
    const songList = document.getElementById("songList");
    const leereListe = document.getElementById("leereSongListe");

    let audio = new Audio();
    let currentTrackIndex = 0;
    let isPlaying = false;
    let tracks = [];

    window.electronAPI.sendMusicFiles((data) => {
        console.log("Verfügbare songs:", data.musicFiles);
        const { musicFiles, selectedDirectory } = data;
        tracks = musicFiles.map(file => `file://${selectedDirectory}/${file}`);
        if (tracks.length > 0) {
            leereListe.remove();
            songList.innerHTML = tracks.map(track => `<li>${track.split('/').pop()}</li>`).join('');
            loadTrack(currentTrackIndex); // Nur laden, wenn tracks gefüllt ist
        }
    });

    function loadTrack(index) {
        if (tracks.length > 0) { // Überprüfen, ob tracks nicht leer ist
            audio.src = tracks[index];
            audio.load();
        }
    }

    function playTrack() {
        if (tracks.length > 0) { // Überprüfen, ob tracks nicht leer ist
            if (!isPlaying) {
                audio.play();
                isPlaying = true;

                playButton.classList.remove("pausing");
                playButton.classList.add("playing");
                playButton.innerHTML = "Pause";

            } else {
                audio.pause();
                isPlaying = false;

                playButton.classList.remove("playing");
                playButton.classList.add("pausing");
                playButton.innerHTML = "Play";
            }
        }
    }

    function stopTrack() {
        audio.pause();
        audio.currentTime = 0;
        isPlaying = false;
    }

    function nextTrack() {
        if (tracks.length > 0) { // Überprüfen, ob tracks nicht leer ist
            currentTrackIndex = (currentTrackIndex + 1) % tracks.length;
            loadTrack(currentTrackIndex);
            playTrack();
        }
    }

    function prevTrack() {
        if (tracks.length > 0) { // Überprüfen, ob tracks nicht leer ist
            currentTrackIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
            loadTrack(currentTrackIndex);
            playTrack();
        }
    }

    function updateVolume() {
        audio.volume = volumeSlider.value / 100;
    }

    function updateProgressBar() {
        progressBar.value = (audio.currentTime / audio.duration) * 100;
    }

    playButton.addEventListener("click", playTrack);
    nextButton.addEventListener("click", nextTrack);
    prevButton.addEventListener("click", prevTrack);
    volumeSlider.addEventListener("input", updateVolume);
    audio.addEventListener("timeupdate", updateProgressBar);

    openFolderButton.addEventListener('click', async () => {
        await window.electronAPI.openMusicFolderDialog();
    });
});

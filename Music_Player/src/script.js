document.addEventListener("DOMContentLoaded", function () {
    const playButton = document.getElementById("playButton");
    const stopButton = document.getElementById("stop-button");
    const nextButton = document.getElementById("nextSong");
    const prevButton = document.getElementById("previousSong");
    const volumeSlider = document.getElementById("volume-slider");
    const progressBar = document.getElementById("progress-bar");

    let audio = new Audio();
    let currentTrackIndex = 0;
    let isPlaying = false;



    const getMusicFiles = async (directory) => {
        try {
        const files = await fs.promises.readdir(directory);
        const musicFiles = files.filter(file => path.extname(file).toLowerCase() === '.mp3');
        return musicFiles;
        } catch (err) {
        console.error('Fehler beim Lesen des Musikordners:', err);
        return [];
        }
    };

    getMusicFiles('C:/Users/3658201/Music').then(musicFiles => {
  

  
    const tracks = [
        "track1.mp3",
        "track2.mp3",
        "track3.mp3"
    ];

    function loadTrack(index) {
        audio.src = tracks[index];
        audio.load();
    }


    function playTrack() {
        if (!isPlaying) {
            audio.play();
            isPlaying = true;

            playButton.classList.remove("pausing");
            playButton.classList.add("playing");
            playButton.innerHTML = "Pause";

        }

        if (isPlaying) {
            audio.pause();
            isPlaying = false;

            playButton.classList.remove("playing");
            playButton.classList.add("pausing");
            playButton.innerHTML = "Play";
        }
    }

    
    function stopTrack() {
        audio.pause();
        audio.currentTime = 0;
        isPlaying = false;
    }

    function nextTrack() {
        currentTrackIndex = (currentTrackIndex + 1) % tracks.length;
        loadTrack(currentTrackIndex);
        playTrack();
    }

    function prevTrack() {
        currentTrackIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
        loadTrack(currentTrackIndex);
        playTrack();
    }

    function updateVolume() {
        audio.volume = volumeSlider.value / 100;
    }

    function updateProgressBar() {
        progressBar.value = (audio.currentTime / audio.duration) * 100;
    }

    playButton.addEventListener("click", playTrack);
    stopButton.addEventListener("click", stopTrack);
    nextButton.addEventListener("click", nextTrack);
    prevButton.addEventListener("click", prevTrack);
    volumeSlider.addEventListener("input", updateVolume);
    
    audio.addEventListener("timeupdate", updateProgressBar);

    loadTrack(currentTrackIndex);


});
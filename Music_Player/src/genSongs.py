import os

songs = "songs"

for song in songs:
    if song.endswith(".mp3"):
        print(song)
        # Add code to process the song file as needed
        # For example, you could load it into a library like pydub or librosa for analysis or playback
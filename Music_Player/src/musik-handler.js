const fs = require('fs').promises;
const path = require('path');

const musikOrdnerPfad = path.join(__dirname, 'audio');

async function erstelleTracklist(musikOrdnerPfad) {
    console.log('Verzeichnis wird gelesen: ' + musikOrdnerPfad);
    let trackList = [];

    try {
        const dateien = await fs.readdir(musikOrdnerPfad, { withFileTypes: true });
        console.log('Anzahl der Songs im Verzeichnis: ' + dateien.length);

        for (const datei of dateien) {
            const vollerPfad = path.join(musikOrdnerPfad, datei.name);
            if (datei.isFile() && datei.name.endsWith('.mp3')) {
                trackList.push({
                    name: datei.name.replace('.mp3', ''),
                    pfad: vollerPfad
                });
            }
        }
    } catch (error) {
        console.error('Fehler beim Lesen des Verzeichnisses:', error);
        return [];
    }

    console.log('Tracklist erstellt: ', trackList);
    return trackList;
}


module.exports = {
    erstelleTracklist
};

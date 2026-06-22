// --- Lokaler HTTP-Server für den Musik Player ---
// Stellt zwei API-Endpunkte bereit:
//   GET /api/songs          → JSON-Liste der MP3-Dateinamen im gewählten Ordner
//   GET /api/audio/:datei   → streamt die Audiodatei (mit HTTP-Range-Support)
//
// Der gewählte Musikordner ändert sich zur Laufzeit (per Ordnerauswahl im
// Main-Prozess). Damit der Server immer den aktuellen Wert sieht, bekommt er
// keine feste Pfad-Variable, sondern eine Getter-Funktion `getMusicDirectory`.

const http = require('http');
const path = require('path');
const fs = require('fs');
const url = require('url');

/**
 * Liest die MP3-Dateinamen (oberste Ebene) eines Ordners.
 * @param {string} directory - Absoluter Pfad zum Musikordner.
 * @returns {Promise<string[]>} Liste der Dateinamen (leer bei Fehler).
 */
const getMusicFiles = async (directory) => {
    try {
        const files = await fs.promises.readdir(directory);
        return files.filter(file => path.extname(file).toLowerCase() === '.mp3');
    } catch (err) {
        console.error('Fehler beim Lesen des Musikordners:', err);
        return [];
    }
};

// --- Endpunkt: GET /api/songs -------------------------------------------------
/**
 * Liefert die Songliste des aktuell gewählten Ordners als JSON.
 */
async function handleSongList(req, res, musicDirectory) {
    if (!musicDirectory) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Musikordner nicht ausgewählt' }));
        return;
    }
    const musicFiles = await getMusicFiles(musicDirectory);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(musicFiles));
}

// --- Endpunkt: GET /api/audio/:datei -----------------------------------------
/**
 * Streamt eine einzelne Audiodatei. Unterstützt HTTP-Range-Requests (Seeking)
 * und schützt gegen Path-Traversal aus dem Musikordner heraus.
 */
async function handleAudioStream(req, res, musicDirectory, pathname) {
    if (!musicDirectory) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Musikordner nicht ausgewählt');
        return;
    }

    const filename = decodeURIComponent(pathname.substring('/api/audio/'.length));
    // Beide Pfade absolut auflösen, bevor verglichen wird (path.join allein
    // normalisiert "../"-Segmente nicht zuverlässig gegen den Ordner-Wurzelpfad).
    const musicRoot = path.resolve(musicDirectory);
    const requestedPath = path.resolve(musicRoot, filename);

    // ** Sicherheitsprüfung: requestedPath MUSS innerhalb von musicRoot liegen **
    // path.relative liefert "../…" wenn der Pfad ausbricht, oder einen absoluten
    // Pfad bei einem anderen Laufwerk (Windows) – beides wird hier abgelehnt.
    // Ein reines startsWith würde sonst auch Geschwisterordner mit gleichem
    // Präfix matchen (z. B. ".../Musik" vs. ".../Musik-Privat").
    const relativePath = path.relative(musicRoot, requestedPath);
    const isOutside = relativePath.startsWith('..') || path.isAbsolute(relativePath);
    if (isOutside) {
        console.error(`[Server] Sicherheitsverstoß: Pfad ${requestedPath} liegt außerhalb von ${musicRoot}`);
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Zugriff verweigert');
        return;
    }

    // Prüfen, ob Datei existiert und streamen (mit Range Support)
    try {
        const stats = await fs.promises.stat(requestedPath);
        if (!stats.isFile()) throw new Error('Keine Datei');

        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Accept-Ranges', 'bytes');

        const range = req.headers.range;
        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
            const chunksize = (end - start) + 1;

            if (start >= stats.size || end >= stats.size || start < 0 || end < start) {
                // Ungültiger Range-Wert
                res.writeHead(416, { 'Content-Range': `bytes */${stats.size}` });
                return res.end();
            }

            const fileStream = fs.createReadStream(requestedPath, { start, end });
            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${stats.size}`,
                'Content-Length': chunksize,
                'Content-Type': 'audio/mpeg',
                'Accept-Ranges': 'bytes'
            });
            fileStream.pipe(res);
            console.log(`[Server] Sende Range ${start}-${end} für ${filename}`);
        } else {
            res.writeHead(200); // Status 200 OK hinzugefügt
            const fileStream = fs.createReadStream(requestedPath);
            fileStream.pipe(res);
            console.log(`[Server] Sende ganze Datei ${filename}`);
        }
    } catch (fileError) {
        console.error(`[Server] Datei nicht gefunden oder Fehler: ${requestedPath}`, fileError);
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Audiodatei nicht gefunden');
    }
}

// --- Server-Factory -----------------------------------------------------------
/**
 * Erstellt den HTTP-Server mit dem Routing für die beiden Endpunkte.
 * @param {() => (string|null)} getMusicDirectory - Getter für den aktuell
 *        gewählten Musikordner (oder null, wenn keiner gewählt ist).
 * @returns {import('http').Server}
 */
function createMusicServer(getMusicDirectory) {
    return http.createServer(async (req, res) => {
        const parsedUrl = url.parse(req.url, true);
        const pathname = parsedUrl.pathname;
        console.log(`[Server] Anfrage empfangen: ${req.method} ${pathname}`);

        // CORS Header
        res.setHeader('Access-Control-Allow-Origin', '*');

        const musicDirectory = getMusicDirectory();

        try {
            // --- Routing ---
            if (pathname === '/api/songs' && req.method === 'GET') {
                return await handleSongList(req, res, musicDirectory);
            }

            if (pathname.startsWith('/api/audio/') && req.method === 'GET') {
                return await handleAudioStream(req, res, musicDirectory, pathname);
            }

            // --- Fallback für unbekannte Routen ---
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Nicht gefunden');
        } catch (serverError) {
            console.error('[Server] Interner Fehler:', serverError);
            // Stelle sicher, dass die Antwort nicht schon gesendet wurde
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
            }
            // Beende die Antwort sicher, auch wenn Header schon gesendet wurden
            res.end('Serverfehler');
        }
    });
}

module.exports = { createMusicServer, getMusicFiles };

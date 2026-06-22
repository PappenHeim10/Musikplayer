// --- Lokaler HTTP-Server für den Musik Player ---
// Stellt zwei API-Endpunkte bereit:
//   GET /api/songs          → JSON-Liste der Audio-Dateinamen im gewählten Ordner
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
 * Erlaubte CORS-Origins. Der Electron-Renderer lädt via file:// und sendet
 * daher den Origin "null". Echte Web-Origins (https://…, http://…) werden
 * bewusst NICHT erlaubt, damit keine fremde Webseite den laufenden Server
 * auslesen kann.
 * @param {string|undefined} origin - Wert des Origin-Headers.
 * @returns {boolean}
 */
function isAllowedOrigin(origin) {
    return origin === 'null' || (typeof origin === 'string' && origin.startsWith('file://'));
}

// Unterstützte Audioformate: Dateiendung → MIME-Type (Content-Type).
const CONTENT_TYPES = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.flac': 'audio/flac',
    '.ogg': 'audio/ogg',
    '.oga': 'audio/ogg',
    '.opus': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.weba': 'audio/webm',
};
const SUPPORTED_EXTENSIONS = Object.keys(CONTENT_TYPES);

/**
 * Prüft, ob eine Datei ein unterstütztes Audioformat hat (anhand der Endung).
 * @param {string} filename
 * @returns {boolean}
 */
function isSupportedAudioFile(filename) {
    return SUPPORTED_EXTENSIONS.includes(path.extname(filename).toLowerCase());
}

/**
 * Leitet den Content-Type aus der Dateiendung ab.
 * @param {string} filename
 * @returns {string} Passender MIME-Type oder 'application/octet-stream' als Fallback.
 */
function getContentType(filename) {
    return CONTENT_TYPES[path.extname(filename).toLowerCase()] || 'application/octet-stream';
}

/**
 * Löst `filename` relativ zu `rootDir` auf und gibt den absoluten Pfad zurück –
 * aber nur, wenn er INNERHALB von rootDir liegt. Andernfalls null (Path-Traversal).
 * path.relative liefert "../…" wenn der Pfad ausbricht, oder einen absoluten Pfad
 * bei einem anderen Laufwerk (Windows) – beides wird als "außerhalb" gewertet.
 * Ein reines startsWith würde sonst Geschwisterordner mit gleichem Präfix matchen
 * (z. B. ".../Musik" vs. ".../Musik-Privat").
 * @param {string} rootDir
 * @param {string} filename
 * @returns {string|null}
 */
function resolveWithinRoot(rootDir, filename) {
    const root = path.resolve(rootDir);
    const target = path.resolve(root, filename);
    const relativePath = path.relative(root, target);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        return null;
    }
    return target;
}

/**
 * Parst einen HTTP-Range-Header ("bytes=start-end") gegen die Dateigröße.
 * Unterstützt "bytes=start-" und "bytes=start-end"; Suffix-Ranges ("bytes=-n")
 * und ungültige Werte ergeben null (→ Aufrufer antwortet mit 416).
 * @param {string} rangeHeader
 * @param {number} size - Dateigröße in Bytes.
 * @returns {{start:number,end:number}|null}
 */
function parseRange(rangeHeader, size) {
    const parts = rangeHeader.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : size - 1;
    if (Number.isNaN(start) || start >= size || end >= size || start < 0 || end < start) {
        return null;
    }
    return { start, end };
}

/**
 * Liest die Audio-Dateinamen (oberste Ebene) eines Ordners – gefiltert auf
 * unterstützte Formate (siehe CONTENT_TYPES).
 * @param {string} directory - Absoluter Pfad zum Musikordner.
 * @returns {Promise<string[]>} Liste der Dateinamen (leer bei Fehler).
 */
const getMusicFiles = async (directory) => {
    try {
        const files = await fs.promises.readdir(directory);
        return files.filter(isSupportedAudioFile);
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

    // ** Sicherheitsprüfung: Pfad MUSS innerhalb des Musikordners liegen **
    const requestedPath = resolveWithinRoot(musicDirectory, filename);
    if (!requestedPath) {
        console.error(`[Server] Sicherheitsverstoß: ${filename} liegt außerhalb des Musikordners`);
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Zugriff verweigert');
        return;
    }

    // Content-Type passend zur Dateiendung (mp3/wav/flac/ogg/m4a/…)
    const contentType = getContentType(filename);

    // Prüfen, ob Datei existiert und streamen (mit Range Support)
    try {
        const stats = await fs.promises.stat(requestedPath);
        if (!stats.isFile()) throw new Error('Keine Datei');

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Accept-Ranges', 'bytes');

        const range = req.headers.range;
        if (range) {
            const parsed = parseRange(range, stats.size);
            if (!parsed) {
                // Ungültiger Range-Wert
                res.writeHead(416, { 'Content-Range': `bytes */${stats.size}` });
                return res.end();
            }
            const { start, end } = parsed;
            const chunksize = (end - start) + 1;

            const fileStream = fs.createReadStream(requestedPath, { start, end });
            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${stats.size}`,
                'Content-Length': chunksize,
                'Content-Type': contentType,
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

        // CORS: kein Wildcard ('*') mehr. Nur der App-eigene Renderer darf die
        // Antworten auslesen. Da die UI per loadFile (file://) geladen wird, sendet
        // ihr fetch den Origin "null" – genau den erlauben wir. Eine echte Webseite
        // (https://…) im Browser bekommt keinen passenden Header und kann die
        // Antwort (z. B. die Songliste) damit nicht auslesen.
        const origin = req.headers.origin;
        if (isAllowedOrigin(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
        }

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

module.exports = {
    createMusicServer,
    getMusicFiles,
    // Hilfsfunktionen (auch einzeln testbar):
    isSupportedAudioFile,
    getContentType,
    resolveWithinRoot,
    parseRange,
    isAllowedOrigin,
    SUPPORTED_EXTENSIONS,
};

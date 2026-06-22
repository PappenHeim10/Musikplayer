// --- Importiere benötigte Module ---
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http'); // HTTP-Modul importieren
const url = require('url'); //NOTE: Für URL-Parsing



let selectedMusicDirectory = null; // Variable für den Musikordner
const PORT = 3001; // Dieser Port wird für den HTTP-Server verwendet

// --- HTTP Server erstellen ---
const server = http.createServer(async (req, res) => { // ich kann mit der Funktion Create Server ein Server erstellen, der auf Anfragen reagiert
    
    //NOTE: URL-Parsing
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    console.log(`[Server] Anfrage empfangen: ${req.method} ${pathname}`);

    // CORS Header
    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
        // --- API Endpunkt: Songliste ---
        if (pathname === '/api/songs' && req.method === 'GET') {
            if (!selectedMusicDirectory) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Musikordner nicht ausgewählt' }));
                return;
            }
            const musicFiles = await getMusicFiles(selectedMusicDirectory);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(musicFiles));
            return;
        }

        // --- API Endpunkt: Audiodatei streamen ---
        if (pathname.startsWith('/api/audio/') && req.method === 'GET') {
            if (!selectedMusicDirectory) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Musikordner nicht ausgewählt');
                return;
            }

            const filename = decodeURIComponent(pathname.substring('/api/audio/'.length));
            const requestedPath = path.join(selectedMusicDirectory, filename);

            // ** Sicherheitsprüfung **
            if (!requestedPath.startsWith(selectedMusicDirectory)) {
                console.error(`[Server] Sicherheitsverstoß: Pfad ${requestedPath} liegt außerhalb von ${selectedMusicDirectory}`);
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
            return;
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

// --- Server starten ---
server.listen(PORT, () => {
    console.log(`[Server] Lokaler HTTP-Server läuft auf http://localhost:${PORT}`);
});

// --- Squirrel Startup Check ---
if (require('electron-squirrel-startup')) {
    app.quit();
}

// --- createWindow Funktion (unverändert) ---
const createWindow = () => {
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
    mainWindow.webContents.openDevTools();
};

// --- getMusicFiles Funktion (unverändert) ---
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

// --- App Events ---
app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });

    // --- IPC Handler für Ordnerauswahl KORRIGIERT ---
    ipcMain.handle('open-music-folder-dialog', async (event) => {
        // Wichtig: Finde das Fenster, das die Anfrage gesendet hat
        const webContents = event.sender;
        const win = BrowserWindow.fromWebContents(webContents);
        if (!win) return; // Fenster nicht gefunden

        // *** HIER WURDE DER DIALOG-AUFRUF HINZUGEFÜGT ***
        const result = await dialog.showOpenDialog(win, {
             properties: ['openDirectory'],
             title: 'Musikordner auswählen'
        });

        if (result && !result.canceled && result.filePaths.length > 0) {
            selectedMusicDirectory = result.filePaths[0]; // Pfad speichern
            console.log('[Main] Musikordner gesetzt:', selectedMusicDirectory);
            // Renderer benachrichtigen, dass er die Liste neu laden soll
            event.sender.send('music-folder-selected');
        } else {
             console.log('[Main] Ordnerauswahl abgebrochen oder fehlgeschlagen.');
        }
        // Der Handler muss nichts zurückgeben, da wir 'invoke' nur zum Triggern nutzen
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// *** HIER WURDE DER SERVER SHUTDOWN HINZUGEFÜGT ***
app.on('will-quit', () => {
    server.close(() => {
         console.log('[Server] HTTP-Server wurde geschlossen.');
    });
});
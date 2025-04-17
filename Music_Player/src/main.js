
// Benötigte Module importieren
const { app, BrowserWindow, dialog } = require('electron'); // Electron-Module
const path = require('path');      // Node.js Modul für Pfadoperationen
const fs = require('fs').promises; // Node.js Modul für Dateisystemzugriff (Promise-basiert)
const fsSync = require('fs');      // Synchrones fs für Existenzprüfung (kann auch async gemacht werden)
const express = require('express'); // Express-Framework
const os = require('os');           // Um das Heimatverzeichnis zu bekommen

// --- Konfiguration ---
// Port für den internen Webserver
const SERVER_PORT = 3000; // Du kannst auch einen anderen freien Port wählen

// Standard-Musikordner (Beispiel: Musikordner des Benutzers)
// HINWEIS: Es ist BESSER, dem Benutzer die Auswahl des Ordners zu ermöglichen!
//          Siehe Funktion selectMusicFolder weiter unten.
let musicFolderPath = path.join(os.homedir(), 'Music'); // Standard: C:\Users\DeinName\Music oder /home/deinname/Music

// --- Express App Setup ---
const expressApp = express(); // Express-App Instanz erstellen

// Middleware für CORS (Cross-Origin Resource Sharing) - nicht unbedingt nötig, da alles lokal läuft,
// aber gute Praxis, falls du mal von extern zugreifen willst (dann aber sicherer konfigurieren!)
expressApp.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Funktion zum rekursiven Durchsuchen des Musikordners (Async)
async function findMp3Files(dir) {
    let mp3Files = [];
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                // Rekursiver Aufruf für Unterordner und Ergebnisse hinzufügen
                mp3Files = mp3Files.concat(await findMp3Files(fullPath));
            } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.mp3') {
                // Wenn es eine MP3-Datei ist, füge den Pfad zur Liste hinzu
                mp3Files.push(fullPath);
            }
        }
    } catch (error) {
        // Fehler beim Lesen des Verzeichnisses (z.B. keine Berechtigung)
        console.error(`Fehler beim Lesen von Verzeichnis ${dir}:`, error.message);
        // Hier könntest du entscheiden, ob du den Fehler weitergeben oder ignorieren möchtest.
        // Für dieses Beispiel ignorieren wir Ordner, auf die wir nicht zugreifen können.
    }
    return mp3Files;
}


// API-Endpunkt: GET /api/songs
// Liefert eine Liste von Songs im JSON-Format
expressApp.get('/api/songs', async (req, res) => {
    console.log(`API-Anfrage für /api/songs empfangen. Durchsuche: ${musicFolderPath}`);

    // Prüfen, ob der Musikordner existiert
    if (!fsSync.existsSync(musicFolderPath) || !fsSync.statSync(musicFolderPath).isDirectory()) {
        console.error(`Musikordner nicht gefunden oder kein Verzeichnis: ${musicFolderPath}`);
        return res.status(404).json({ error: `Musikordner nicht gefunden: ${musicFolderPath}. Bitte wähle einen gültigen Ordner aus.` });
    }

    try {
        // Finde alle MP3-Dateien im konfigurierten Ordner (rekursiv)
        const allMp3Paths = await findMp3Files(musicFolderPath);

        // Wandle die vollständigen Pfade in ein Format um, das das Frontend verwenden kann
        const songs = allMp3Paths.map(filePath => {
            // Extrahiere den Dateinamen
            const filename = path.basename(filePath);
            // Erzeuge den relativen Pfad *innerhalb* des Musikordners
            const relativePath = path.relative(musicFolderPath, filePath);
            // Erzeuge die URL zum Streamen der Datei (wichtig: Pfadtrenner für URL standardisieren!)
            const streamUrl = `/music/${relativePath.split(path.sep).join('/')}`;

            return {
                filename: filename,
                url: streamUrl // Diese URL wird vom Frontend verwendet
            };
        });

        console.log(`Sende ${songs.length} Songs an das Frontend.`);
        // Sende die Liste als JSON zurück
        res.json(songs);

    } catch (error) {
        console.error('Fehler beim Abrufen der Songliste:', error);
        res.status(500).json({ error: 'Interner Serverfehler beim Abrufen der Songs.' });
    }
});

// API-Endpunkt: GET /music/:filePath(*)
// Streamt die angeforderte Musikdatei an den Client
expressApp.get('/music/:filePath(*)', (req, res) => {
    // Extrahiere den angeforderten (relativen) Dateipfad aus der URL
    const requestedRelativePath = req.params.filePath;

    // Baue den vollständigen, absoluten Pfad zur Datei auf dem Server zusammen
    // WICHTIG: Sicherheitsprüfung! Stelle sicher, dass der Pfad nicht außerhalb des Musikordners liegt.
    const absoluteFilePath = path.resolve(musicFolderPath, requestedRelativePath);

    // Sicherheitscheck: Liegt der Pfad wirklich innerhalb des erlaubten Musikordners?
    if (!absoluteFilePath.startsWith(path.resolve(musicFolderPath))) {
        console.warn(`Zugriffsversuch außerhalb des Musikordners blockiert: ${absoluteFilePath}`);
        return res.status(403).send('Zugriff verweigert'); // Forbidden
    }

    // Prüfe, ob die Datei existiert
    if (!fsSync.existsSync(absoluteFilePath) || !fsSync.statSync(absoluteFilePath).isFile()) {
        console.error(`Angeforderte Musikdatei nicht gefunden: ${absoluteFilePath}`);
        return res.status(404).send('Datei nicht gefunden');
    }

    // Sende die Datei als Stream an den Client
    console.log(`Streaming-Anfrage für: ${absoluteFilePath}`);
    res.sendFile(absoluteFilePath, (err) => {
        if (err) {
            console.error(`Fehler beim Senden der Datei ${absoluteFilePath}:`, err);
            // Stelle sicher, dass keine halbe Antwort gesendet wird, wenn bereits Header gesendet wurden
            if (!res.headersSent) {
                res.status(500).send('Fehler beim Senden der Datei');
            }
        } else {
             console.log(`Datei ${absoluteFilePath} erfolgreich gestreamt.`);
        }
    });
});


// --- Electron Fenster-Setup ---
let mainWindow; // Variable für das Hauptfenster

function createWindow() {
    // Erstelle das Browser-Fenster.
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            // preload: path.join(__dirname, 'preload.js') // Optional: Wenn du Preload-Skripte brauchst
            nodeIntegration: false, // Wichtig für Sicherheit: nodeIntegration deaktivieren
            contextIsolation: true, // Wichtig für Sicherheit: Context Isolation aktivieren
        }
    });

    // Lade die index.html der App.
    mainWindow.loadFile('index.html');

    // Öffne die DevTools (optional, zum Debuggen).
    mainWindow.webContents.openDevTools();

    // Event-Handler für das Schließen des Fensters.
    mainWindow.on('closed', () => {
        // Dereferenziere das Fensterobjekt.
        mainWindow = null;
    });
}

// Funktion, um den Benutzer einen Musikordner auswählen zu lassen (Beispiel)
// Diese könntest du über ein Menü oder einen Button im Frontend auslösen (via IPC)
async function selectMusicFolder() {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    if (!result.canceled && result.filePaths.length > 0) {
        musicFolderPath = result.filePaths[0];
        console.log(`Neuer Musikordner ausgewählt: ${musicFolderPath}`);
        // Hier könntest du das Frontend benachrichtigen, die Liste neu zu laden (via IPC)
        // mainWindow.webContents.send('music-folder-changed');
    }
}

// --- App Lifecycle ---

// Diese Methode wird aufgerufen, wenn Electron mit der Initialisierung fertig ist
// und bereit ist, Browser-Fenster zu erstellen.
// Einige APIs können nur nach diesem Event verwendet werden.
app.whenReady().then(() => {
    // Starte den Express-Server
    expressApp.listen(SERVER_PORT, () => {
        console.log(`Interner Express-Server läuft auf http://localhost:${SERVER_PORT}`);
        // Erstelle das Hauptfenster, *nachdem* der Server läuft
        createWindow();
    }).on('error', (err) => {
        // Fehlerbehandlung, falls der Port schon belegt ist etc.
        console.error(`Fehler beim Starten des Express-Servers auf Port ${SERVER_PORT}:`, err);
        dialog.showErrorBox('Server Fehler', `Konnte den internen Server nicht starten. Läuft die App vielleicht schon oder ist Port ${SERVER_PORT} belegt?`);
        app.quit(); // Beende die App, wenn der Server nicht starten kann
    });

    // macOS spezifisch: Erstelle ein neues Fenster, wenn auf das Dock-Icon geklickt wird
    // und keine anderen Fenster offen sind.
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Beende die Anwendung, wenn alle Fenster geschlossen sind (außer auf macOS).
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') { // 'darwin' ist macOS
        app.quit();
    }
});

// Hier könntest du noch Menüs hinzufügen, z.B. um `selectMusicFolder` aufzurufen.
// const { Menu } = require('electron');
// const menuTemplate = [ /* ... Menüdefinition ... */ ];
// const menu = Menu.buildFromTemplate(menuTemplate);
// Menu.setApplicationMenu(menu);
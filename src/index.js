// --- Importiere benötigte Module ---
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { createMusicServer } = require('./server'); // HTTP-Server (ausgelagert)

let selectedMusicDirectory = null; // Variable für den Musikordner
const PREFERRED_PORT = 3001; // Bevorzugter Port; bei Belegung wird ausgewichen
let apiPort = null; // Der tatsächlich vergebene Port (steht erst nach 'listening' fest)

// --- HTTP Server erstellen & starten ---
// Der Server liest den aktuellen Ordner stets frisch über den Getter, da sich
// selectedMusicDirectory zur Laufzeit per Ordnerauswahl ändert.
const server = createMusicServer(() => selectedMusicDirectory);

/**
 * Startet den HTTP-Server. Versucht zuerst den bevorzugten Port; ist dieser
 * belegt (EADDRINUSE), weicht er auf einen vom Betriebssystem vergebenen freien
 * Port aus (Port 0). Bindet nur an 127.0.0.1, damit der Server nicht über andere
 * Netzwerk-Interfaces erreichbar ist.
 * @returns {Promise<number>} Der tatsächlich gebundene Port.
 */
function startServer() {
    let triedFallback = false;
    return new Promise((resolve, reject) => {
        server.on('listening', () => {
            apiPort = server.address().port;
            console.log(`[Server] Lokaler HTTP-Server läuft auf http://localhost:${apiPort}`);
            resolve(apiPort);
        });
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE' && !triedFallback) {
                triedFallback = true;
                console.warn(`[Server] Port ${PREFERRED_PORT} ist belegt – weiche auf einen freien Port aus.`);
                server.listen(0, '127.0.0.1');
            } else {
                console.error('[Server] Konnte nicht starten:', err);
                reject(err);
            }
        });
        server.listen(PREFERRED_PORT, '127.0.0.1');
    });
}

// Promise, das auflöst, sobald der Server lauscht – der Renderer fragt darüber
// den Port ab und bekommt so immer einen gültigen Wert (auch beim Fallback).
const serverReady = startServer();

// --- Squirrel Startup Check ---
if (require('electron-squirrel-startup')) {
    app.quit();
}

// --- Einstellungen (zuletzt gewählter Ordner) ---
// Persistiert als JSON in app.getPath('userData') – ohne zusätzliche Dependency.
function getSettingsFile() {
    return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings() {
    try {
        return JSON.parse(fs.readFileSync(getSettingsFile(), 'utf-8'));
    } catch (err) {
        return {}; // keine/ungültige Datei → leere Einstellungen
    }
}

function saveSettings(settings) {
    try {
        fs.writeFileSync(getSettingsFile(), JSON.stringify(settings, null, 2));
    } catch (err) {
        console.error('[Main] Konnte Einstellungen nicht speichern:', err);
    }
}

// Beim Start den zuletzt gewählten Ordner wiederherstellen – aber nur, wenn er
// noch existiert (könnte gelöscht oder ein nicht gemountetes Laufwerk sein).
function restoreMusicDirectory() {
    const { musicDirectory } = loadSettings();
    if (!musicDirectory) return;
    try {
        if (fs.statSync(musicDirectory).isDirectory()) {
            selectedMusicDirectory = musicDirectory;
            console.log('[Main] Letzten Musikordner wiederhergestellt:', musicDirectory);
        }
    } catch (err) {
        console.log('[Main] Gespeicherter Musikordner nicht mehr verfügbar:', musicDirectory);
    }
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
    // DevTools nur in der Entwicklung öffnen, nicht im ausgelieferten Build.
    if (!app.isPackaged) {
        mainWindow.webContents.openDevTools();
    }
};

// --- App Events ---
app.whenReady().then(() => {
    restoreMusicDirectory(); // vor dem Fenster, damit die Liste sofort laden kann
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });

    // --- IPC Handler: API-Port abfragen ---
    // Wartet auf serverReady, damit der Renderer immer den tatsächlichen Port
    // erhält – auch wenn auf einen Ausweich-Port gewechselt wurde.
    ipcMain.handle('get-api-port', () => serverReady);

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
            saveSettings({ musicDirectory: selectedMusicDirectory }); // für nächsten Start merken
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
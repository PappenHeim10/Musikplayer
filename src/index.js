// --- Importiere benötigte Module ---
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const { createMusicServer } = require('./server'); // HTTP-Server (ausgelagert)

let selectedMusicDirectory = null; // Variable für den Musikordner
const PORT = 3001; // Dieser Port wird für den HTTP-Server verwendet

// --- HTTP Server erstellen & starten ---
// Der Server liest den aktuellen Ordner stets frisch über den Getter, da sich
// selectedMusicDirectory zur Laufzeit per Ordnerauswahl ändert.
const server = createMusicServer(() => selectedMusicDirectory);

// Nur an 127.0.0.1 binden: der Server ist ausschließlich für den eigenen
// Renderer gedacht und soll nicht über andere Netzwerk-Interfaces erreichbar sein.
server.listen(PORT, '127.0.0.1', () => {
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
    // DevTools nur in der Entwicklung öffnen, nicht im ausgelieferten Build.
    if (!app.isPackaged) {
        mainWindow.webContents.openDevTools();
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
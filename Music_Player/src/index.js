// Füge 'protocol' und 'url' zu den Imports hinzu
const { app, BrowserWindow, dialog, ipcMain, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const url = require('url'); // Wird für URL-Umwandlung benötigt

// --- WICHTIG: Protokoll *vor* app.whenReady() registrieren ---
// Wir nennen es 'safe-file'. Wähle einen Namen, der nicht mit Standardprotokollen kollidiert.
protocol.registerSchemesAsPrivileged([
    { scheme: 'safe-file', privileges: { secure: true, standard: true, supportFetchAPI: true, corsEnabled: true /* Erlaube CORS für AudioContext etc. falls nötig */ } }
]);

if (require('electron-squirrel-startup')) {
    app.quit();
}

// Funktion bleibt meist gleich, preload etc. sind korrekt
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

    // Lade deine HTML-Datei
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
    mainWindow.webContents.openDevTools();
};

// --- Hilfsfunktion zum Lesen der Musikdateien (unverändert gut) ---
const getMusicFiles = async (directory) => {
    try {
        const files = await fs.promises.readdir(directory);
        // Filter nach MP3 (könnte erweitert werden: ['.mp3', '.wav', '.ogg'])
        const musicFiles = files.filter(file => path.extname(file).toLowerCase() === '.mp3');
        return musicFiles; // Gibt nur die Dateinamen zurück
    } catch (err) {
        console.error('Fehler beim Lesen des Musikordners:', err);
        return [];
    }
};


// --- App ist bereit ---
app.whenReady().then(() => {
    // --- Handler für unser benutzerdefiniertes Protokoll registrieren ---
    protocol.registerFileProtocol('safe-file', (request, callback) => {
      try {
          const requestedUrl = request.url; // Logge die ankommende URL
          console.log(`[safe-file] Protokoll-Anfrage erhalten: ${requestedUrl}`);
          const urlPath = decodeURI(requestedUrl.slice('safe-file://'.length));
          console.log(`[safe-file] Dekodierter Pfad für Callback: ${urlPath}`); // Logge den dekodierten Pfad
  
          // Optional: Prüfen, ob die Datei existiert, bevor der Callback erfolgt
          if (fs.existsSync(urlPath)) {
               console.log(`[safe-file] Datei existiert. Rufe Callback auf.`);
               callback({ path: urlPath });
          } else {
               console.error(`[safe-file] FEHLER: Datei unter dekodiertem Pfad NICHT gefunden: ${urlPath}`);
               callback({ error: -6 }); // net::ERR_FILE_NOT_FOUND
          }
      } catch (error) {
           console.error(`[safe-file] FEHLER bei Verarbeitung von ${request.url}: ${error}`);
           callback({ error: -2 }); // net::FAILED (generischer Fehler)
      }
  });

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });

    // --- IPC Handler für Ordnerauswahl ANPASSEN ---
    ipcMain.handle('open-music-folder-dialog', async (event) => {
        const webContents = event.sender; // WebContents, die die Anfrage gesendet haben
        const win = BrowserWindow.fromWebContents(webContents); // Das zugehörige Fenster

        if (!win) return; // Fenster existiert nicht mehr

        try {
            const result = await dialog.showOpenDialog(win, { // Dialog an das richtige Fenster binden
                properties: ['openDirectory'],
                title: 'Musikordner auswählen',
            });

            if (!result.canceled && result.filePaths.length > 0) {
                const selectedDirectory = result.filePaths[0];
                console.log('Ausgewählter Ordner:', selectedDirectory);
                const musicFilenames = await getMusicFiles(selectedDirectory); // Nur Dateinamen

                // Erstelle URLs mit dem benutzerdefinierten Protokoll
                const musicFileUrls = musicFilenames.map(filename => {
                    const fullPath = path.join(selectedDirectory, filename);
                    // Konvertiere den Pfad in eine File-URL und ersetze 'file:///' durch 'safe-file://'
                    // Wichtig: Pfade für URLs normalisieren (Backslashes zu Slashes)
                    const normalizedPath = fullPath.replace(/\\/g, '/');
                    // Kodieren für URL-Sicherheit (z.B. Leerzeichen -> %20)
                    return `safe-file://${encodeURI(normalizedPath)}`;
                });

                console.log("Sende Musikdatei-URLs:", musicFileUrls);

                // Sende die URLs an den Renderer
                webContents.send('music-files', { musicFiles: musicFileUrls }); // Nur URLs senden reicht

            } else {
                console.log('Kein Ordner ausgewählt oder Dialog abgebrochen.');
            }
        } catch (err) {
            console.error('Fehler im Dialog oder beim Verarbeiten der Dateien:', err);
            // Optional: Fehler an den Renderer senden
            // webContents.send('error-message', 'Fehler beim Öffnen des Ordners.');
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
// preload.js

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Stellt eine sichere Brücke zwischen dem Renderer-Prozess (Webseite)
 * und dem Main-Prozess (Node.js-Umgebung von Electron) her.
 * Nur die hier explizit freigegebenen Funktionen sind im Renderer verfügbar.
 */
contextBridge.exposeInMainWorld(
    // Name des globalen Objekts im Renderer (window.electronAPI)
    'electronAPI',
    {
        /**
         * Sendet eine Anfrage an den Main-Prozess, um den
         * Systemdialog zur Ordnerauswahl zu öffnen.
         * Nutzt ipcRenderer.invoke für eine Promise-basierte Kommunikation.
         * (Obwohl wir das Ergebnis des Promises hier nicht direkt verwenden,
         * ist invoke für Aktionen geeignet, die eine Antwort erwarten könnten).
         */
        openMusicFolderDialog: () => ipcRenderer.invoke('open-music-folder-dialog'),

        /**
         * Registriert eine Callback-Funktion, die aufgerufen wird, wenn der Main-Prozess
         * das Signal 'music-folder-selected' sendet.
         * Dies passiert, nachdem der Benutzer erfolgreich einen Ordner ausgewählt hat.
         * @param {Function} callback - Die Funktion, die im Renderer ausgeführt werden soll.
         * Sie erhält keine Argumente vom Main-Prozess in diesem Fall.
         */
        onMusicFolderSelected: (callback) => {
            // ipcRenderer.on registriert einen Listener.
            // Es ist wichtig, sicherzustellen, dass nicht bei jedem Aufruf neue Listener hinzugefügt werden,
            // falls diese Funktion mehrfach aufgerufen werden könnte (was hier unwahrscheinlich ist, aber gute Praxis).
            // In diesem einfachen Fall registrieren wir den Listener einmalig.
            // Das erste Argument des ipcRenderer.on-Callbacks ist immer das 'event'-Objekt,
            // das wir hier ignorieren können (_event), da wir keine Daten erwarten.
            ipcRenderer.on('music-folder-selected', (_event) => callback());

            // Optional: Eine Funktion zurückgeben, um den Listener wieder zu entfernen,
            // falls das Frontend die Komponente unmountet (bei Frameworks wie React/Vue relevant).
            // Für dieses einfache Skript ist es meist nicht nötig.
            // return () => {
            //     ipcRenderer.removeAllListeners('music-folder-selected');
            // };
        }
        // Frühere Funktionen wie 'sendMusicFiles' oder 'basename' werden nicht mehr benötigt.
    }
);

console.log('Preload script executed.'); // Kleine Log-Meldung zur Bestätigung
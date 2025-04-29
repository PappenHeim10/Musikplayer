const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

if (require('electron-squirrel-startup')) {
  app.quit();
}

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

  const selectMusicFolder = async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Musikordner auswählen',
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const selectedDirectory = result.filePaths[0];
        console.log('Ausgewählter Ordner:', selectedDirectory);
        const musicFiles = await getMusicFiles(selectedDirectory);
        console.log("Musikdateien:", musicFiles);
        mainWindow.webContents.send('music-files', { musicFiles, selectedDirectory });
      } else {
        console.log('Kein Ordner ausgewählt oder Dialog abgebrochen.');
      }
    } catch (err) {
      console.error('Fehler beim Anzeigen des Dialogs:', err);
    }
  };

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

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.webContents.openDevTools();

  //mainWindow.webContents.on('did-finish-load', () => {
  //  selectMusicFolder(); // Entfernt: Dialog wird jetzt nur auf Button-Klick geöffnet
  //});
};

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  ipcMain.handle('open-music-folder-dialog', async () => {
    await selectMusicFolder();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

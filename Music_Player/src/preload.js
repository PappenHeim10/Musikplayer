const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendMusicFiles: (callback) => ipcRenderer.on('music-files', (event, data) => callback(data)),
  openMusicFolderDialog: () => ipcRenderer.invoke('open-music-folder-dialog'),
});

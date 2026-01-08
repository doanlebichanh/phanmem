const { contextBridge, ipcRenderer } = require('electron');

// Expose các API an toàn cho renderer process nếu cần
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  version: process.version,

  // Database backup/restore (Desktop app only)
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  getBackupConfig: () => ipcRenderer.invoke('db:getBackupConfig'),
  setBackupConfig: (config) => ipcRenderer.invoke('db:setBackupConfig', config),
  backupDatabase: (options) => ipcRenderer.invoke('db:backup', options),
  restoreDatabase: (options) => ipcRenderer.invoke('db:restore', options)
});

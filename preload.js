const { contextBridge } = require('electron');

// Expose các API an toàn cho renderer process nếu cần
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  version: process.version
});

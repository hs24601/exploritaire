'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hero', {
  onFrame: (cb) => ipcRenderer.on('frame', (_e, msg) => cb(msg)),
  hover: (over) => ipcRenderer.send('hover', over),
  down: () => ipcRenderer.send('down'),
  up: () => ipcRenderer.send('up'),
  dbl: () => ipcRenderer.send('dbl'),
});

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('historyBridge', {
  get: () => ipcRenderer.invoke('history:get'),
  clear: () => ipcRenderer.invoke('history:clear'),
});

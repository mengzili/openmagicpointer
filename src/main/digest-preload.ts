import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('digestBridge', {
  today: () => ipcRenderer.invoke('digest:today'),
  week: () => ipcRenderer.invoke('digest:week'),
});

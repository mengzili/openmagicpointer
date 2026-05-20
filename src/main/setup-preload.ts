import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('setup', {
  get: () => ipcRenderer.invoke('setup:get'),
  save: (payload: unknown) => ipcRenderer.invoke('setup:save', payload),
  cancel: () => ipcRenderer.invoke('setup:cancel'),
});

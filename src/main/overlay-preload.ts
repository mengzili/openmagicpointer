import { contextBridge, ipcRenderer } from 'electron';

export interface ShowHintPayload {
  text: string;
  durationMs: number;
  maxWidth: number;
  minWidth: number;
}

contextBridge.exposeInMainWorld('magicPointer', {
  onHint(handler: (payload: ShowHintPayload) => void) {
    ipcRenderer.on('hint:show', (_event, payload: ShowHintPayload) => handler(payload));
  },
});

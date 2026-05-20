import { BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { Controller } from './controller';

export class HistoryWindow {
  private win: BrowserWindow | null = null;
  private controller: Controller;

  constructor(controller: Controller) {
    this.controller = controller;
  }

  show(): void {
    if (this.win) {
      this.win.focus();
      return;
    }

    ipcMain.handle('history:get', () => this.controller.getHistory());
    ipcMain.handle('history:clear', () => {
      this.controller.clearHistory();
      return { ok: true };
    });

    this.win = new BrowserWindow({
      width: 720,
      height: 520,
      title: 'OpenMagicPointer — Hint History',
      autoHideMenuBar: true,
      backgroundColor: '#1c1e26',
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, 'history-preload.js'),
      },
    });

    this.win.once('ready-to-show', () => this.win?.show());

    this.win.on('closed', () => {
      this.win = null;
      ipcMain.removeHandler('history:get');
      ipcMain.removeHandler('history:clear');
    });

    void this.win.loadFile(path.join(__dirname, '..', 'history', 'index.html'));
  }
}

import { BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { getDailyDigest, getWeekDigests } from './focus-tracker';

export class DigestWindow {
  private win: BrowserWindow | null = null;

  show(): void {
    if (this.win) { this.win.focus(); return; }

    ipcMain.handle('digest:today', () => getDailyDigest());
    ipcMain.handle('digest:week', () => getWeekDigests());

    this.win = new BrowserWindow({
      width: 600,
      height: 480,
      title: 'OpenMagicPointer — Daily Digest',
      autoHideMenuBar: true,
      backgroundColor: '#1c1e26',
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, 'digest-preload.js'),
      },
    });

    this.win.once('ready-to-show', () => this.win?.show());
    this.win.on('closed', () => {
      this.win = null;
      ipcMain.removeHandler('digest:today');
      ipcMain.removeHandler('digest:week');
    });

    void this.win.loadFile(path.join(__dirname, '..', 'digest', 'index.html'));
  }
}

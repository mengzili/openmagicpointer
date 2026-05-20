import { BrowserWindow, screen } from 'electron';
import * as path from 'path';
import { bubblePosition } from './position';

const MIN_W = 200;
const MAX_W = 420;
const MAX_H = 200;
const OFFSET = 18;

export class OverlayWindow {
  private win: BrowserWindow | null = null;
  private ready = false;
  private pending: { text: string; x: number; y: number; durationMs: number } | null = null;
  private hideTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.createWindow();
  }

  private createWindow(): void {
    this.win = new BrowserWindow({
      width: MAX_W,
      height: MAX_H,
      show: false,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      closable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: false,
      focusable: false,
      acceptFirstMouse: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, 'overlay-preload.js'),
      },
    });
    this.win.setAlwaysOnTop(true, 'screen-saver');
    this.win.setVisibleOnAllWorkspaces(true);
    // Let mouse clicks pass through the bubble — but allow re-enabling so the
    // bubble can be dismissed if we want click-to-dismiss in the future.
    this.win.setIgnoreMouseEvents(true, { forward: true });

    const htmlPath = path.join(__dirname, '..', 'overlay', 'index.html');
    this.win.loadFile(htmlPath);

    this.win.webContents.on('did-finish-load', () => {
      this.ready = true;
      if (this.pending) {
        this.flush(this.pending);
        this.pending = null;
      }
    });
  }

  showHint(text: string, cursorX: number, cursorY: number, durationMs: number): void {
    const payload = { text, x: cursorX, y: cursorY, durationMs };
    if (!this.ready || !this.win) {
      this.pending = payload;
      return;
    }
    this.flush(payload);
  }

  private flush(payload: { text: string; x: number; y: number; durationMs: number }): void {
    if (!this.win) return;
    const { x, y } = this.positionFor(payload.x, payload.y);
    this.win.setBounds({ x, y, width: MAX_W, height: MAX_H });
    this.win.showInactive();
    this.win.webContents.send('hint:show', {
      text: payload.text,
      durationMs: payload.durationMs,
      maxWidth: MAX_W,
      minWidth: MIN_W,
    });
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.hide(), payload.durationMs + 400);
  }

  private positionFor(cursorX: number, cursorY: number): { x: number; y: number } {
    const display = screen.getDisplayNearestPoint({ x: cursorX, y: cursorY });
    return bubblePosition(cursorX, cursorY, display.workArea, MAX_W, MAX_H, OFFSET);
  }

  hide(): void {
    if (this.win && this.win.isVisible()) {
      this.win.hide();
    }
  }

  destroy(): void {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    if (this.win) {
      this.win.destroy();
      this.win = null;
    }
  }
}

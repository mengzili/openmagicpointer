import { Tray, Menu, nativeImage, NativeImage, app } from 'electron';
import { circlePng } from './png';

export interface TrayCallbacks {
  onAskNow: () => void;
  onTogglePause: () => void;
  onSettings: () => void;
  onHistory: () => void;
  onDigest: () => void;
  onQuit: () => void;
}

function makeIcon(color: string): NativeImage {
  return nativeImage.createFromBuffer(circlePng(16, color));
}

export class TrayController {
  private tray: Tray;
  private enabled = true;
  private cb: TrayCallbacks;

  constructor(callbacks: TrayCallbacks) {
    this.cb = callbacks;
    this.tray = new Tray(makeIcon('#7a8cff'));
    this.tray.setToolTip('OpenMagicPointer — F8 for hint, F9 to pause');
    this.rebuildMenu();
    this.tray.on('click', () => this.cb.onAskNow());
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.tray.setImage(makeIcon(enabled ? '#7a8cff' : '#888888'));
    this.rebuildMenu();
  }

  private rebuildMenu(): void {
    const menu = Menu.buildFromTemplate([
      {
        label: this.enabled ? 'Pause' : 'Resume',
        click: () => this.cb.onTogglePause(),
      },
      { label: 'Hint now', click: () => this.cb.onAskNow() },
      { type: 'separator' },
      { label: 'View History', click: () => this.cb.onHistory() },
      { label: 'Daily Digest', click: () => this.cb.onDigest() },
      { label: 'Settings…', click: () => this.cb.onSettings() },
      { type: 'separator' },
      { label: `OpenMagicPointer v${app.getVersion()}`, enabled: false },
      { type: 'separator' },
      { label: 'Quit', click: () => this.cb.onQuit() },
    ]);
    this.tray.setContextMenu(menu);
  }

  destroy(): void {
    this.tray.destroy();
  }
}

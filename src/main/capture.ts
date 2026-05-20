import { desktopCapturer, screen } from 'electron';
import { uIOhook } from 'uiohook-napi';
import { fingerprintFromBgra } from './fingerprint';

export interface ActivitySnapshot {
  lastEventTime: number;     // ms epoch
  lastKeyTime: number;
  cursorX: number;
  cursorY: number;
  isTyping: boolean;          // had key events within last 2s
}

export interface ScreenCapture {
  pngBuffer: Buffer;
  width: number;
  height: number;
  fingerprint: string;        // for change detection
}

export class ActivityTracker {
  private lastEvent = Date.now();
  private lastKey = 0;
  private started = false;

  start(): void {
    if (this.started) return;
    this.started = true;
    uIOhook.on('keydown', () => {
      const now = Date.now();
      this.lastEvent = now;
      this.lastKey = now;
    });
    uIOhook.on('mousedown', () => { this.lastEvent = Date.now(); });
    uIOhook.on('mousemove', () => { this.lastEvent = Date.now(); });
    uIOhook.on('wheel', () => { this.lastEvent = Date.now(); });
    try {
      uIOhook.start();
    } catch (e) {
      console.error('uiohook failed to start (input tracking disabled):', e);
    }
  }

  stop(): void {
    if (!this.started) return;
    try { uIOhook.stop(); } catch { /* ignore */ }
    this.started = false;
  }

  snapshot(): ActivitySnapshot {
    const point = screen.getCursorScreenPoint();
    const now = Date.now();
    return {
      lastEventTime: this.lastEvent,
      lastKeyTime: this.lastKey,
      cursorX: point.x,
      cursorY: point.y,
      isTyping: (now - this.lastKey) < 2000,
    };
  }
}

/**
 * Capture the primary display, downscaling to fit within maxDim on the long edge.
 * Uses Electron's built-in desktopCapturer — no shell-out, no native deps beyond Electron.
 */
export async function captureScreen(maxDim: number): Promise<ScreenCapture> {
  const primary = screen.getPrimaryDisplay();
  const { width: dw, height: dh } = primary.size;
  const scale = Math.min(1, maxDim / Math.max(dw, dh));
  const thumbW = Math.max(64, Math.floor(dw * scale));
  const thumbH = Math.max(64, Math.floor(dh * scale));

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: thumbW, height: thumbH },
  });
  if (sources.length === 0) {
    throw new Error('No screen sources available');
  }
  const primaryIdStr = String(primary.id);
  const source =
    sources.find(s => s.display_id === primaryIdStr) ?? sources[0];

  let img = source.thumbnail;
  const sz = img.getSize();
  if (sz.width > thumbW || sz.height > thumbH) {
    img = img.resize({ width: thumbW, height: thumbH, quality: 'good' });
  }

  const png = img.toPNG();
  const small = img.resize({ width: 32, height: 32, quality: 'good' });
  const fingerprint = fingerprintFromBgra(small.toBitmap(), 32, 32);
  return {
    pngBuffer: png,
    width: img.getSize().width,
    height: img.getSize().height,
    fingerprint,
  };
}

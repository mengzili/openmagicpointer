import { Config } from './config';
import { ActivityTracker, captureScreen } from './capture';
import { Analyzer } from './analyzer';
import { OverlayWindow } from './overlay-window';
import { shouldQuery, shouldSendCapture } from './throttle';

export class Controller {
  private cfg: Config;
  private tracker: ActivityTracker;
  private analyzer: Analyzer;
  private overlay: OverlayWindow;

  private enabled: boolean;
  private timer: NodeJS.Timeout | null = null;
  private lastQueryAt = 0;
  private lastFingerprint = '';
  private inFlight = false;

  constructor(cfg: Config, overlay: OverlayWindow) {
    this.cfg = cfg;
    this.tracker = new ActivityTracker();
    this.analyzer = new Analyzer(cfg.apiKey, cfg.model);
    this.overlay = overlay;
    this.enabled = cfg.enabled;
  }

  start(): void {
    this.tracker.start();
    this.startTimer();
    // Greet the user so they know it's running.
    setTimeout(() => {
      const snap = this.tracker.snapshot();
      this.overlay.showHint(
        `OpenMagicPointer is on. ${this.cfg.hotkeyAsk} for hint, ${this.cfg.hotkeyPause} to pause.`,
        snap.cursorX,
        snap.cursorY,
        4500,
      );
    }, 600);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.tracker.stop();
    this.overlay.hide();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) {
      this.startTimer();
      const snap = this.tracker.snapshot();
      this.overlay.showHint('Resumed.', snap.cursorX, snap.cursorY, 2000);
    } else {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      const snap = this.tracker.snapshot();
      this.overlay.showHint('Paused.', snap.cursorX, snap.cursorY, 2000);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async askNow(): Promise<void> {
    await this.runQuery(true);
  }

  private startTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), this.cfg.pollIntervalMs);
  }

  private async tick(): Promise<void> {
    const snap = this.tracker.snapshot();
    const decision = shouldQuery({
      now: Date.now(),
      enabled: this.enabled,
      inFlight: this.inFlight,
      lastEventTime: snap.lastEventTime,
      lastQueryAt: this.lastQueryAt,
      isTyping: snap.isTyping,
      idleThresholdMs: this.cfg.idleThresholdMs,
      minQueryIntervalMs: this.cfg.minQueryIntervalMs,
    });
    if (!decision.query) return;
    await this.runQuery(false);
  }

  private async runQuery(userRequested: boolean): Promise<void> {
    if (this.inFlight) return;
    this.inFlight = true;
    try {
      const cap = await captureScreen(this.cfg.maxImageDim);
      // Skip if the screen content is identical to the previous query — unless
      // the user explicitly asked, in which case re-analyse with fresh context.
      if (!shouldSendCapture(cap.fingerprint, this.lastFingerprint, userRequested)) {
        return;
      }
      const snap = this.tracker.snapshot();
      const idle = Date.now() - snap.lastEventTime;
      this.lastFingerprint = cap.fingerprint;
      this.lastQueryAt = Date.now();

      const result = await this.analyzer.analyze({
        pngBuffer: cap.pngBuffer,
        cursorX: snap.cursorX,
        cursorY: snap.cursorY,
        screenWidth: cap.width,
        screenHeight: cap.height,
        idleMs: idle,
        userRequested,
      });

      if (result === null) {
        if (userRequested) {
          const cur = this.tracker.snapshot();
          this.overlay.showHint(
            "Couldn't analyse right now — check your API key and network.",
            cur.cursorX,
            cur.cursorY,
            4000,
          );
        }
        return;
      }

      console.log(
        `[analyzer] needs_hint=${result.needsHint} confidence=${result.confidence} reason=${result.reason}`,
      );

      if (result.needsHint && result.hint) {
        const cur = this.tracker.snapshot();
        this.overlay.showHint(
          result.hint,
          cur.cursorX,
          cur.cursorY,
          this.cfg.hintDurationMs,
        );
      } else if (userRequested) {
        const cur = this.tracker.snapshot();
        this.overlay.showHint(
          "Looks like you're doing fine — no hint to add.",
          cur.cursorX,
          cur.cursorY,
          3000,
        );
      }
    } catch (e: any) {
      console.error('runQuery error:', e?.message ?? e);
      if (userRequested) {
        const cur = this.tracker.snapshot();
        this.overlay.showHint(
          'Capture failed — see console for details.',
          cur.cursorX,
          cur.cursorY,
          4000,
        );
      }
    } finally {
      this.inFlight = false;
    }
  }
}

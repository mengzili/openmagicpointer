import { Config } from './config';
import { ActivityTracker, captureScreen } from './capture';
import { Analyzer } from './analyzer';
import { OverlayWindow } from './overlay-window';
import { shouldQuery, shouldSendCapture } from './throttle';
import { HintEntry } from './providers/types';
import { clipboard } from 'electron';
import { recordSession, flushSessions } from './focus-tracker';

const MAX_HISTORY = 200;
const DISTRACTION_CATEGORIES = new Set(['browsing', 'break']);
const DISTRACTION_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

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
  private history: HintEntry[] = [];
  private distractionStart = 0; // timestamp when distraction streak began
  private lastDistractionNudge = 0;
  private lastClipboardText = '';
  private clipboardTimer: NodeJS.Timeout | null = null;

  constructor(cfg: Config, overlay: OverlayWindow) {
    this.cfg = cfg;
    this.tracker = new ActivityTracker();
    this.analyzer = new Analyzer({
      provider: cfg.provider,
      apiKey: cfg.apiKey,
      authToken: cfg.authToken,
      model: cfg.model,
      baseURL: cfg.baseURL,
    });
    this.overlay = overlay;
    this.enabled = cfg.enabled;
  }

  start(): void {
    this.tracker.start();
    this.startTimer();
    this.startClipboardWatch();
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
    if (this.clipboardTimer) clearInterval(this.clipboardTimer);
    this.tracker.stop();
    this.overlay.hide();
  }

  setConfig(cfg: Config): void {
    this.cfg = cfg;
    this.analyzer = new Analyzer({
      provider: cfg.provider,
      apiKey: cfg.apiKey,
      authToken: cfg.authToken,
      model: cfg.model,
      baseURL: cfg.baseURL,
    });
    this.lastFingerprint = '';
    if (this.enabled && this.timer) this.startTimer();
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

  getHistory(): HintEntry[] {
    return this.history;
  }

  clearHistory(): void {
    this.history = [];
  }

  async askNow(): Promise<void> {
    this.overlay.hide();
    await this.runQuery(true);
  }

  async explainNow(): Promise<void> {
    this.overlay.hide();
    if (this.inFlight) return;
    this.inFlight = true;
    try {
      const cap = await captureScreen(this.cfg.maxImageDim);
      const snap = this.tracker.snapshot();
      const result = await this.analyzer.explain({
        pngBuffer: cap.pngBuffer,
        cursorX: snap.cursorX,
        cursorY: snap.cursorY,
        screenWidth: cap.width,
        screenHeight: cap.height,
      });
      const cur = this.tracker.snapshot();
      if (result && result.explanation) {
        this.overlay.showHint(result.explanation, cur.cursorX, cur.cursorY, 15000);
      } else {
        this.overlay.showHint("Couldn't explain — try moving your cursor closer to the element.", cur.cursorX, cur.cursorY, 4000);
      }
    } catch (e: any) {
      console.error('explainNow error:', e?.message ?? e);
    } finally {
      this.inFlight = false;
    }
  }

  private startTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), this.cfg.pollIntervalMs);
  }

  private async tick(): Promise<void> {
    const snap = this.tracker.snapshot();
    // Scale throttle based on aggressiveness (1-5). Level 3 = defaults.
    const scale = [3.0, 2.0, 1.0, 0.6, 0.4][Math.max(0, Math.min(4, (this.cfg.aggressiveness || 3) - 1))];
    const decision = shouldQuery({
      now: Date.now(),
      enabled: this.enabled,
      inFlight: this.inFlight,
      lastEventTime: snap.lastEventTime,
      lastQueryAt: this.lastQueryAt,
      isTyping: snap.isTyping,
      idleThresholdMs: Math.round(this.cfg.idleThresholdMs * scale),
      minQueryIntervalMs: Math.round(this.cfg.minQueryIntervalMs * scale),
    });
    if (!decision.query) return;
    await this.runQuery(false);
  }

  private async runQuery(userRequested: boolean): Promise<void> {
    if (this.inFlight) return;
    this.inFlight = true;
    try {
      const cap = await captureScreen(this.cfg.maxImageDim);
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
        aggressiveness: this.cfg.aggressiveness,
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
        `[analyzer] needs_hint=${result.needsHint} confidence=${result.confidence} category=${result.category} reason=${result.reason}`,
      );

      if (result.needsHint && result.hint) {
        this.history.push({
          hint: result.hint,
          confidence: result.confidence,
          reason: result.reason,
          category: result.category,
          timestamp: Date.now(),
          userRequested,
        });
        if (this.history.length > MAX_HISTORY) this.history.shift();

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

      // Distraction nudge: track time in distraction categories
      this.updateDistractionTracker(result.category);
      // Focus tracking: record category time for daily digest
      recordSession(result.category, this.cfg.pollIntervalMs);
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

  private startClipboardWatch(): void {
    this.lastClipboardText = clipboard.readText() || '';
    this.clipboardTimer = setInterval(() => {
      const text = clipboard.readText() || '';
      if (text && text !== this.lastClipboardText && text.length > 10 && text.length < 2000) {
        this.lastClipboardText = text;
        this.offerClipboardTransform(text);
      }
    }, 2000);
  }

  private offerClipboardTransform(text: string): void {
    const suggestions: string[] = [];
    if (text.includes('\n') || text.length > 100) suggestions.push('summarize');
    if (/[A-Z]/.test(text) && /[a-z]/.test(text)) suggestions.push('reformat');
    if (/[一-鿿぀-ゟ゠-ヿ]/.test(text)) suggestions.push('translate to English');
    else if (/^[a-zA-Z\s.,!?;:'"()-]+$/.test(text.trim())) suggestions.push('translate');
    if (/SELECT|INSERT|CREATE|function|const |def |class /.test(text)) suggestions.push('explain code');
    if (suggestions.length === 0) return;

    const snap = this.tracker.snapshot();
    const hint = `Copied ${text.length} chars — try F7 to explain, or F8 for suggestions.`;
    this.overlay.showHint(hint, snap.cursorX, snap.cursorY, 5000);
  }

  private updateDistractionTracker(category: string): void {
    const now = Date.now();
    if (DISTRACTION_CATEGORIES.has(category)) {
      if (this.distractionStart === 0) this.distractionStart = now;
      const elapsed = now - this.distractionStart;
      // Only nudge once per distraction streak (re-nudge after 2x threshold)
      if (elapsed >= DISTRACTION_THRESHOLD_MS && now - this.lastDistractionNudge > DISTRACTION_THRESHOLD_MS) {
        this.lastDistractionNudge = now;
        const mins = Math.round(elapsed / 60000);
        const cur = this.tracker.snapshot();
        this.overlay.showHint(
          `You've been browsing for ${mins} minutes. Time to switch back to something with a deadline?`,
          cur.cursorX,
          cur.cursorY,
          8000,
        );
      }
    } else {
      // Reset streak when user switches to productive work
      this.distractionStart = 0;
    }
  }
}

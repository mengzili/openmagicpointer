import { app, globalShortcut } from 'electron';
import { Config, hasUsableAuth, loadConfig } from './config';
import { loadSecrets } from './secret-store';
import { OverlayWindow } from './overlay-window';
import { Controller } from './controller';
import { TrayController } from './tray';
import { SetupWindow } from './setup-window';
import { HistoryWindow } from './history-window';
import { DigestWindow } from './digest-window';

// MAGICPOINTER_TEST=1 short-circuits things that would interfere with Playwright
// driven tests (skip the API-key check, don't start uiohook input capture, don't
// run the polling loop) but still creates the overlay window, tray icon, and
// registers hotkeys — so we exercise as much real wiring as possible from e2e.
const isTestMode = process.env.MAGICPOINTER_TEST === '1';

// Make sure only one instance runs.
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

// Don't auto-quit when the (hidden) overlay window is closed — the app lives
// in the system tray. We quit explicitly via the tray menu or hotkey.
app.on('window-all-closed', () => {
  /* intentionally empty */
});

let controller: Controller | null = null;
let tray: TrayController | null = null;
let overlay: OverlayWindow | null = null;
let historyWin: HistoryWindow | null = null;
let digestWin: DigestWindow | null = null;
let activeCfg: Config | null = null;
let setupOpen = false;

app.whenReady().then(async () => {
  let cfg = loadConfig();
  // OS-encrypted secret store as a fallback after env vars.
  const secrets = loadSecrets();
  if (!cfg.apiKey && secrets.apiKey) cfg.apiKey = secrets.apiKey;
  if (!cfg.authToken && secrets.authToken) cfg.authToken = secrets.authToken;

  if (!hasUsableAuth(cfg) && !isTestMode) {
    const result = await openSetupWindow(cfg);
    if (!result.saved || !hasUsableAuth(result.config)) {
      // User cancelled or closed setup without providing a usable backend.
      app.quit();
      return;
    }
    cfg = result.config;
  }

  startApp(cfg);
});

function startApp(cfg: Config): void {
  activeCfg = cfg;
  overlay = new OverlayWindow();
  controller = new Controller(cfg, overlay);

  tray = new TrayController({
    onAskNow: () => { void controller!.askNow(); },
    onTogglePause: () => {
      const next = !controller!.isEnabled();
      controller!.setEnabled(next);
      tray!.setEnabled(next);
    },
    onSettings: () => { void reopenSettings(); },
    onHistory: () => {
      if (!historyWin) historyWin = new HistoryWindow(controller!);
      historyWin.show();
    },
    onDigest: () => {
      if (!digestWin) digestWin = new DigestWindow();
      digestWin.show();
    },
    onQuit: () => app.quit(),
  });

  registerHotkey(cfg.hotkeyAsk, () => { void controller!.askNow(); });
  registerHotkey(cfg.hotkeyExplain, () => { void controller!.explainNow(); });
  registerHotkey(cfg.hotkeyPause, () => {
    const next = !controller!.isEnabled();
    controller!.setEnabled(next);
    tray!.setEnabled(next);
  });
  registerHotkey(cfg.hotkeyQuit, () => app.quit());

  if (isTestMode) {
    (global as any).__test = { overlay, controller, tray };
  } else {
    controller.start();
  }
}

async function reopenSettings(): Promise<void> {
  if (setupOpen || !activeCfg) return;
  const result = await openSetupWindow(activeCfg);
  if (result.saved && hasUsableAuth(result.config)) {
    activeCfg = result.config;
    controller?.setConfig(result.config);
  }
}

async function openSetupWindow(cfg: Config) {
  setupOpen = true;
  try {
    const setup = new SetupWindow();
    return await setup.show(cfg);
  } finally {
    setupOpen = false;
  }
}

function registerHotkey(accelerator: string, handler: () => void): void {
  try {
    const ok = globalShortcut.register(accelerator, handler);
    if (!ok) console.warn(`Failed to register hotkey: ${accelerator}`);
  } catch (e) {
    console.warn(`Hotkey error (${accelerator}):`, e);
  }
}

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (controller) controller.stop();
  if (tray) tray.destroy();
  if (overlay) overlay.destroy();
});

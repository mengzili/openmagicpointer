import { app, globalShortcut } from 'electron';
import { Config, loadConfig } from './config';
import { loadSecret } from './secret-store';
import { OverlayWindow } from './overlay-window';
import { Controller } from './controller';
import { TrayController } from './tray';
import { SetupWindow } from './setup-window';

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
let activeCfg: Config | null = null;
let setupOpen = false;

app.whenReady().then(async () => {
  let cfg = loadConfig();
  // OS-encrypted secret store as a fallback after env var.
  if (!cfg.apiKey) cfg.apiKey = loadSecret();

  if (configNeedsKey(cfg) && !isTestMode) {
    const result = await openSetupWindow(cfg);
    if (!result.saved || configNeedsKey(result.config)) {
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
  controller = new Controller(
    { ...cfg, apiKey: cfg.apiKey || 'test-key-placeholder' },
    overlay,
  );

  tray = new TrayController({
    onAskNow: () => { void controller!.askNow(); },
    onTogglePause: () => {
      const next = !controller!.isEnabled();
      controller!.setEnabled(next);
      tray!.setEnabled(next);
    },
    onSettings: () => { void reopenSettings(); },
    onQuit: () => app.quit(),
  });

  registerHotkey(cfg.hotkeyAsk, () => { void controller!.askNow(); });
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
  if (result.saved && !configNeedsKey(result.config)) {
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

function configNeedsKey(cfg: Config): boolean {
  // Local OpenAI-compatible servers (Ollama, LM Studio, llama.cpp) don't need
  // an API key. Everything else does.
  const local = cfg.provider === 'openai' && !!cfg.baseURL && isLocalUrl(cfg.baseURL);
  return !local && !cfg.apiKey;
}

function isLocalUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local');
  } catch {
    return false;
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

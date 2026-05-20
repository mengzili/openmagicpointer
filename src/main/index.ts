import { app, dialog, globalShortcut } from 'electron';
import { loadConfig, configPath } from './config';
import { OverlayWindow } from './overlay-window';
import { Controller } from './controller';
import { TrayController } from './tray';

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

app.whenReady().then(() => {
  const cfg = loadConfig();

  if (!cfg.apiKey && !isTestMode) {
    dialog.showErrorBox(
      'OpenMagicPointer',
      `No ANTHROPIC_API_KEY found.\n\n` +
        `Set the ANTHROPIC_API_KEY environment variable, or add an "apiKey" field to:\n${configPath()}`,
    );
    app.quit();
    return;
  }

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
    onQuit: () => app.quit(),
  });

  // Global hotkeys — registered in both modes so tests can confirm they bind.
  registerHotkey(cfg.hotkeyAsk, () => { void controller!.askNow(); });
  registerHotkey(cfg.hotkeyPause, () => {
    const next = !controller!.isEnabled();
    controller!.setEnabled(next);
    tray!.setEnabled(next);
  });
  registerHotkey(cfg.hotkeyQuit, () => app.quit());

  if (isTestMode) {
    // Expose internals on a global so Playwright's electronApp.evaluate() can
    // drive the app without IPC boilerplate.
    (global as any).__test = { overlay, controller, tray };
  } else {
    controller.start();
  }
});

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

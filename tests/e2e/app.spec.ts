import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

let app: ElectronApplication;
let overlay: Page;

test.beforeAll(async () => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  app = await electron.launch({
    args: [PROJECT_ROOT],
    env: {
      ...process.env,
      MAGICPOINTER_TEST: '1',
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? 'test-fake',
    },
    timeout: 30_000,
  });
  // Overlay window is created (hidden) at startup; firstWindow resolves once it loads.
  overlay = await app.firstWindow({ timeout: 15_000 });
});

test.afterAll(async () => {
  if (app) {
    // The tray icon keeps the Electron process alive even after all windows
    // close. Force-exit via `app.exit(0)` — `app.quit()` waits for handlers
    // and can hang in test mode.
    try {
      await Promise.race([
        app.evaluate(({ app: electronApp }) => electronApp.exit(0)),
        new Promise(resolve => setTimeout(resolve, 2_000)),
      ]);
    } catch { /* process already gone */ }
    await Promise.race([
      app.close().catch(() => {}),
      new Promise(resolve => setTimeout(resolve, 5_000)),
    ]);
  }
});

test('overlay BrowserWindow exists after boot', async () => {
  const windows = app.windows();
  expect(windows.length).toBeGreaterThan(0);
});

test('overlay renders the bubble DOM scaffold', async () => {
  // Even before the first showHint, the HTML structure must be loaded.
  await overlay.waitForSelector('#bubble', { state: 'attached', timeout: 5_000 });
  await overlay.waitForSelector('#hint-text', { state: 'attached' });
  await overlay.waitForSelector('.dot', { state: 'attached' });
});

test('all configured hotkeys register with the OS', async () => {
  const result = await app.evaluate(({ globalShortcut }) => ({
    ask: globalShortcut.isRegistered('F8'),
    pause: globalShortcut.isRegistered('F9'),
    quit: globalShortcut.isRegistered('CommandOrControl+Shift+F12'),
  }));
  expect(result).toEqual({ ask: true, pause: true, quit: true });
});

test('test hooks are exposed on global in MAGICPOINTER_TEST mode', async () => {
  const hooks = await app.evaluate(() => {
    const g = (globalThis as any).__test;
    return {
      hasOverlay: !!g?.overlay,
      hasController: !!g?.controller,
      hasTray: !!g?.tray,
    };
  });
  expect(hooks).toEqual({ hasOverlay: true, hasController: true, hasTray: true });
});

test('showHint renders text in the bubble', async () => {
  const hint = 'Click Save to apply the change.';
  await app.evaluate(({}, args) => {
    (globalThis as any).__test.overlay.showHint(args.text, args.x, args.y, args.durationMs);
  }, { text: hint, x: 200, y: 200, durationMs: 5_000 });

  await overlay.waitForFunction(
    (expected) => document.getElementById('hint-text')?.textContent === expected,
    hint,
    { timeout: 5_000 },
  );
  expect(await overlay.locator('#hint-text').textContent()).toBe(hint);
  // The fade-in transition class is applied.
  await expect(overlay.locator('#bubble')).toHaveClass(/visible/);
});

test('overlay window becomes visible when showHint is called', async () => {
  await app.evaluate(({}, args) => {
    (globalThis as any).__test.overlay.showHint(args.text, args.x, args.y, args.durationMs);
  }, { text: 'visibility check', x: 100, y: 100, durationMs: 5_000 });

  // Give showInactive() a moment, then poll for visibility.
  const visible = await app.evaluate(({ BrowserWindow }) => {
    return BrowserWindow.getAllWindows().some(w => w.isVisible());
  });
  expect(visible).toBe(true);
});

test('subsequent showHint replaces the previous text', async () => {
  await app.evaluate(({}, args) => {
    (globalThis as any).__test.overlay.showHint(args.text, args.x, args.y, args.durationMs);
  }, { text: 'first', x: 200, y: 200, durationMs: 5_000 });
  await overlay.waitForFunction(
    () => document.getElementById('hint-text')?.textContent === 'first',
    null,
    { timeout: 5_000 },
  );

  await app.evaluate(({}, args) => {
    (globalThis as any).__test.overlay.showHint(args.text, args.x, args.y, args.durationMs);
  }, { text: 'second', x: 200, y: 200, durationMs: 5_000 });
  await overlay.waitForFunction(
    () => document.getElementById('hint-text')?.textContent === 'second',
    null,
    { timeout: 5_000 },
  );

  expect(await overlay.locator('#hint-text').textContent()).toBe('second');
});

test('controller pause/resume reflects in isEnabled()', async () => {
  expect(await app.evaluate(() => (globalThis as any).__test.controller.isEnabled())).toBe(true);

  await app.evaluate(() => (globalThis as any).__test.controller.setEnabled(false));
  expect(await app.evaluate(() => (globalThis as any).__test.controller.isEnabled())).toBe(false);

  await app.evaluate(() => (globalThis as any).__test.controller.setEnabled(true));
  expect(await app.evaluate(() => (globalThis as any).__test.controller.isEnabled())).toBe(true);
});

test('overlay bubble screenshot is captured for visual review', async () => {
  const hint = 'Looks like you might want to enable autosave.';
  await app.evaluate(({}, args) => {
    (globalThis as any).__test.overlay.showHint(args.text, args.x, args.y, args.durationMs);
  }, { text: hint, x: 200, y: 200, durationMs: 8_000 });
  await overlay.waitForFunction(
    (expected) => document.getElementById('hint-text')?.textContent === expected,
    hint,
    { timeout: 5_000 },
  );
  // Wait for fade-in transition to settle, then disable the CSS pulse on the dot
  // — otherwise Playwright's screenshot helper waits forever for the page to go
  // idle and the operation hangs the Electron instance.
  await overlay.waitForTimeout(400);

  const buf = await overlay.screenshot({
    type: 'png',
    omitBackground: false,
    animations: 'disabled',
    timeout: 10_000,
  });
  const out = path.join(SCREENSHOT_DIR, 'bubble.png');
  fs.writeFileSync(out, buf);
  expect(fs.statSync(out).size).toBeGreaterThan(500);
});

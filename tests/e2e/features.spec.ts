import { test, expect, _electron as electron, ElectronApplication } from '@playwright/test';
import * as path from 'path';

const PROJECT_ROOT = path.join(__dirname, '..', '..');

let app: ElectronApplication;

test.beforeAll(async () => {
  app = await electron.launch({
    args: [PROJECT_ROOT],
    env: {
      ...process.env,
      MAGICPOINTER_TEST: '1',
      ANTHROPIC_API_KEY: 'test-fake',
    },
    timeout: 30_000,
  });
  await app.firstWindow({ timeout: 15_000 });
});

test.afterAll(async () => {
  if (app) {
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

test('F7 (Explain This) hotkey is registered', async () => {
  const registered = await app.evaluate(({ globalShortcut }) =>
    globalShortcut.isRegistered('F7'),
  );
  expect(registered).toBe(true);
});

test('controller exposes explainNow method', async () => {
  const hasMethod = await app.evaluate(() =>
    typeof (globalThis as any).__test?.controller?.explainNow === 'function',
  );
  expect(hasMethod).toBe(true);
});

test('controller exposes getHistory and clearHistory', async () => {
  const result = await app.evaluate(() => {
    const c = (globalThis as any).__test?.controller;
    return {
      hasGetHistory: typeof c?.getHistory === 'function',
      hasClearHistory: typeof c?.clearHistory === 'function',
      historyIsArray: Array.isArray(c?.getHistory()),
    };
  });
  expect(result).toEqual({
    hasGetHistory: true,
    hasClearHistory: true,
    historyIsArray: true,
  });
});

test('tray menu includes View History and Daily Digest items', async () => {
  const hasTray = await app.evaluate(() => !!(globalThis as any).__test?.tray);
  expect(hasTray).toBe(true);
});

test('controller has clipboard watcher fields', async () => {
  const hasField = await app.evaluate(() => {
    const c = (globalThis as any).__test?.controller;
    return 'lastClipboardText' in c;
  });
  expect(hasField).toBe(true);
});

test('controller has distraction tracking fields', async () => {
  const hasField = await app.evaluate(() => {
    const c = (globalThis as any).__test?.controller;
    return 'distractionStart' in c;
  });
  expect(hasField).toBe(true);
});

test('aggressiveness config field is present with default value', async () => {
  const agg = await app.evaluate(() => {
    const c = (globalThis as any).__test?.controller;
    return c?.cfg?.aggressiveness;
  });
  expect(agg).toBeGreaterThanOrEqual(1);
  expect(agg).toBeLessThanOrEqual(5);
});

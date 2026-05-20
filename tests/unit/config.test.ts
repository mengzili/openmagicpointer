import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

let TMP_DIR = '';

// Mock electron's `app.getPath` so loadConfig reads from a temp dir, not the
// real user data folder. Stubbing electron is required because config.ts
// imports from it; we can't load the module without it in a Node test env.
vi.mock('electron', () => ({
  app: {
    getPath: () => TMP_DIR,
  },
}));

import { loadConfig, saveConfig, configPath } from '../../src/main/config';

describe('config', () => {
  beforeEach(() => {
    TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'omp-cfg-'));
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it('returns defaults when no file and no env var', () => {
    const cfg = loadConfig();
    expect(cfg.model).toBe('claude-opus-4-7');
    expect(cfg.apiKey).toBe('');
    expect(cfg.enabled).toBe(true);
  });

  it('picks up ANTHROPIC_API_KEY from env when file missing', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-from-env';
    const cfg = loadConfig();
    expect(cfg.apiKey).toBe('sk-ant-from-env');
  });

  it('persists non-secret config to disk', () => {
    saveConfig({
      apiKey: 'should-not-persist',
      model: 'claude-haiku-4-5',
      pollIntervalMs: 1234,
      idleThresholdMs: 5000,
      minQueryIntervalMs: 30000,
      hintDurationMs: 8000,
      maxImageDim: 800,
      enabled: false,
      hotkeyAsk: 'F7',
      hotkeyPause: 'F10',
      hotkeyQuit: 'Ctrl+F4',
    });
    const raw = JSON.parse(fs.readFileSync(configPath(), 'utf8'));
    expect(raw.apiKey).toBeUndefined();
    expect(raw.model).toBe('claude-haiku-4-5');
    expect(raw.pollIntervalMs).toBe(1234);
    expect(raw.enabled).toBe(false);
  });

  it('round-trips saved values via loadConfig', () => {
    saveConfig({
      apiKey: '',
      model: 'claude-sonnet-4-6',
      pollIntervalMs: 5000,
      idleThresholdMs: 6000,
      minQueryIntervalMs: 25000,
      hintDurationMs: 15000,
      maxImageDim: 1024,
      enabled: true,
      hotkeyAsk: 'F8',
      hotkeyPause: 'F9',
      hotkeyQuit: 'Ctrl+Shift+F12',
    });
    process.env.ANTHROPIC_API_KEY = 'sk-from-env';
    const cfg = loadConfig();
    expect(cfg.model).toBe('claude-sonnet-4-6');
    expect(cfg.pollIntervalMs).toBe(5000);
    expect(cfg.apiKey).toBe('sk-from-env');
  });

  it('file values override env var when both present', () => {
    // The current behavior: env var only fills apiKey when not already set.
    // Saved config never contains apiKey, so env always wins for that field.
    saveConfig({
      apiKey: '',
      model: 'claude-haiku-4-5',
      pollIntervalMs: 4000,
      idleThresholdMs: 6000,
      minQueryIntervalMs: 20000,
      hintDurationMs: 12000,
      maxImageDim: 1280,
      enabled: true,
      hotkeyAsk: 'F8',
      hotkeyPause: 'F9',
      hotkeyQuit: 'Ctrl+Shift+F12',
    });
    process.env.ANTHROPIC_API_KEY = 'sk-env';
    const cfg = loadConfig();
    expect(cfg.model).toBe('claude-haiku-4-5');
    expect(cfg.apiKey).toBe('sk-env');
  });
});

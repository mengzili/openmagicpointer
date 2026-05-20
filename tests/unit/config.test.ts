import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

let TMP_DIR = '';

vi.mock('electron', () => ({
  app: {
    getPath: () => TMP_DIR,
  },
}));

import { loadConfig, saveConfig, configPath, Config } from '../../src/main/config';

const BASE_SAVED: Omit<Config, 'apiKey' | 'authToken'> & { apiKey: string; authToken: string } = {
  provider: 'anthropic',
  apiKey: '',
  authToken: '',
  baseURL: '',
  model: 'claude-opus-4-7',
  pollIntervalMs: 4000,
  idleThresholdMs: 6000,
  minQueryIntervalMs: 20000,
  hintDurationMs: 12000,
  maxImageDim: 1280,
  enabled: true,
  hotkeyAsk: 'F8',
  hotkeyPause: 'F9',
  hotkeyQuit: 'Ctrl+Shift+F12',
};

describe('config', () => {
  beforeEach(() => {
    TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'omp-cfg-'));
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    delete process.env.ANTHROPIC_BASE_URL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_BASE_URL;
  });

  afterEach(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it('returns defaults when no file and no env var', () => {
    const cfg = loadConfig();
    expect(cfg.provider).toBe('anthropic');
    expect(cfg.model).toBe('claude-opus-4-7');
    expect(cfg.apiKey).toBe('');
    expect(cfg.authToken).toBe('');
    expect(cfg.baseURL).toBe('');
    expect(cfg.enabled).toBe(true);
  });

  it('picks up ANTHROPIC_API_KEY from env when provider=anthropic', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-from-env';
    const cfg = loadConfig();
    expect(cfg.apiKey).toBe('sk-ant-from-env');
  });

  it('picks up ANTHROPIC_AUTH_TOKEN + ANTHROPIC_BASE_URL from env', () => {
    process.env.ANTHROPIC_AUTH_TOKEN = 'bearer-tok';
    process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:8787';
    const cfg = loadConfig();
    expect(cfg.authToken).toBe('bearer-tok');
    expect(cfg.baseURL).toBe('http://127.0.0.1:8787');
  });

  it('picks up OPENAI_API_KEY from env when provider=openai', () => {
    saveConfig({ ...BASE_SAVED, provider: 'openai', model: 'gpt-4o-mini' });
    process.env.OPENAI_API_KEY = 'sk-openai-from-env';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-IGNORED';
    const cfg = loadConfig();
    expect(cfg.provider).toBe('openai');
    expect(cfg.apiKey).toBe('sk-openai-from-env');
  });

  it('persists non-secret config to disk (no apiKey or authToken)', () => {
    saveConfig({
      ...BASE_SAVED,
      apiKey: 'should-not-persist',
      authToken: 'also-not-persist',
      model: 'claude-haiku-4-5',
      pollIntervalMs: 1234,
      enabled: false,
    });
    const raw = JSON.parse(fs.readFileSync(configPath(), 'utf8'));
    expect(raw.apiKey).toBeUndefined();
    expect(raw.authToken).toBeUndefined();
    expect(raw.model).toBe('claude-haiku-4-5');
    expect(raw.pollIntervalMs).toBe(1234);
    expect(raw.enabled).toBe(false);
  });

  it('round-trips provider + baseURL via loadConfig', () => {
    saveConfig({
      ...BASE_SAVED,
      provider: 'openai',
      baseURL: 'http://localhost:11434/v1',
      model: 'llava',
    });
    const cfg = loadConfig();
    expect(cfg.provider).toBe('openai');
    expect(cfg.baseURL).toBe('http://localhost:11434/v1');
    expect(cfg.model).toBe('llava');
  });

  it('env var only fills apiKey when the saved file has none', () => {
    saveConfig({ ...BASE_SAVED, model: 'claude-haiku-4-5' });
    process.env.ANTHROPIC_API_KEY = 'sk-env';
    const cfg = loadConfig();
    expect(cfg.model).toBe('claude-haiku-4-5');
    expect(cfg.apiKey).toBe('sk-env');
  });
});

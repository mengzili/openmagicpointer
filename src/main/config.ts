import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export type ProviderId = 'anthropic' | 'openai';

export interface Config {
  provider: ProviderId;
  apiKey: string;
  authToken: string;     // Bearer-style auth (for proxies / claude-code-router setups)
  baseURL: string;
  model: string;
  aggressiveness: number; // 1-5: 1=minimal hints, 5=very proactive
  pollIntervalMs: number;
  idleThresholdMs: number;
  minQueryIntervalMs: number;
  hintDurationMs: number;
  maxImageDim: number;
  enabled: boolean;
  hotkeyAsk: string;
  hotkeyExplain: string;
  hotkeyPause: string;
  hotkeyQuit: string;
}

const DEFAULTS: Config = {
  provider: 'anthropic',
  apiKey: '',
  authToken: '',
  baseURL: '',
  model: 'claude-opus-4-7',
  aggressiveness: 3,
  pollIntervalMs: 4000,
  idleThresholdMs: 6000,
  minQueryIntervalMs: 20000,
  hintDurationMs: 12000,
  maxImageDim: 1280,
  enabled: true,
  hotkeyAsk: 'F8',
  hotkeyExplain: 'F7',
  hotkeyPause: 'F9',
  hotkeyQuit: 'CommandOrControl+Shift+F12',
};

export function configPath(): string {
  return path.join(app.getPath('userData'), 'config.json');
}

export function loadConfig(): Config {
  const cfg: Config = { ...DEFAULTS };
  try {
    const file = configPath();
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const k of Object.keys(DEFAULTS) as (keyof Config)[]) {
        if (k in raw) (cfg as any)[k] = raw[k];
      }
    }
  } catch (e) {
    console.warn('Failed to load config:', e);
  }

  // Anthropic provider: respect the same env vars the official SDK does, so
  // proxy / claude-code-router setups (ANTHROPIC_BASE_URL +
  // ANTHROPIC_AUTH_TOKEN) work without any setup-window interaction when the
  // app is launched from a shell that has them set.
  if (cfg.provider === 'anthropic') {
    if (!cfg.apiKey && process.env.ANTHROPIC_API_KEY) {
      cfg.apiKey = process.env.ANTHROPIC_API_KEY;
    }
    if (!cfg.authToken && process.env.ANTHROPIC_AUTH_TOKEN) {
      cfg.authToken = process.env.ANTHROPIC_AUTH_TOKEN;
    }
    if (!cfg.baseURL && process.env.ANTHROPIC_BASE_URL) {
      cfg.baseURL = process.env.ANTHROPIC_BASE_URL;
    }
  } else {
    if (!cfg.apiKey && process.env.OPENAI_API_KEY) {
      cfg.apiKey = process.env.OPENAI_API_KEY;
    }
    if (!cfg.baseURL && process.env.OPENAI_BASE_URL) {
      cfg.baseURL = process.env.OPENAI_BASE_URL;
    }
  }

  return cfg;
}

export function saveConfig(cfg: Config): void {
  const file = configPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Strip both secret fields. apiKey and authToken live in the encrypted
  // secret store, never in config.json.
  const { apiKey, authToken, ...rest } = cfg;
  fs.writeFileSync(file, JSON.stringify(rest, null, 2));
}

/** True iff this config has *something* usable as auth (either a key or a Bearer token, or it's pointed at a local server that doesn't need auth). */
export function hasUsableAuth(cfg: Config): boolean {
  if (cfg.apiKey || cfg.authToken) return true;
  if (cfg.provider === 'openai' && cfg.baseURL && isLocalUrl(cfg.baseURL)) return true;
  return false;
}

function isLocalUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local');
  } catch {
    return false;
  }
}

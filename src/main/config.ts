import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export type ProviderId = 'anthropic' | 'openai';

export interface Config {
  provider: ProviderId;
  apiKey: string;
  baseURL: string;
  model: string;
  pollIntervalMs: number;
  idleThresholdMs: number;
  minQueryIntervalMs: number;
  hintDurationMs: number;
  maxImageDim: number;
  enabled: boolean;
  hotkeyAsk: string;
  hotkeyPause: string;
  hotkeyQuit: string;
}

const DEFAULTS: Config = {
  provider: 'anthropic',
  apiKey: '',
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
  // Pick up API keys from the matching env var. Both checked so users can
  // switch providers without re-exporting.
  if (!cfg.apiKey) {
    const envKey =
      cfg.provider === 'openai'
        ? process.env.OPENAI_API_KEY
        : process.env.ANTHROPIC_API_KEY;
    if (envKey) cfg.apiKey = envKey;
  }
  return cfg;
}

export function saveConfig(cfg: Config): void {
  const file = configPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const { apiKey, ...rest } = cfg;
  fs.writeFileSync(file, JSON.stringify(rest, null, 2));
}

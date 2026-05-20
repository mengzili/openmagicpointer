import { BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { Config, saveConfig, ProviderId } from './config';
import { saveSecrets, hasAnySecret, loadSecrets } from './secret-store';

export interface SetupSavePayload {
  provider: ProviderId;
  baseURL: string;
  model: string;
  aggressiveness: number;
  apiKey: string;
  authToken: string;
}

export interface SetupResult {
  saved: boolean;
  config: Config;
}

// A small modal-ish window that asks the user for provider / model / key on
// first launch (or any time they pick "Settings…" from the tray). Resolves
// with either the new config (saved=true) or the original config (saved=false
// if cancelled).
export class SetupWindow {
  private win: BrowserWindow | null = null;

  show(cfg: Config): Promise<SetupResult> {
    return new Promise((resolve) => {
      let saved = false;
      let resolvedCfg: Config = cfg;
      let resolved = false;

      const cleanup = () => {
        ipcMain.removeHandler('setup:get');
        ipcMain.removeHandler('setup:save');
        ipcMain.removeHandler('setup:cancel');
      };

      const finish = (result: SetupResult) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve(result);
      };

      ipcMain.handle('setup:get', () => ({
        provider: cfg.provider,
        baseURL: cfg.baseURL,
        model: cfg.model,
        aggressiveness: cfg.aggressiveness || 3,
        hasKey: Boolean(cfg.apiKey) || hasAnySecret(),
        hasAuthToken: Boolean(cfg.authToken),
        envBaseURL: process.env.ANTHROPIC_BASE_URL || '',
        envHasAuthToken: Boolean(process.env.ANTHROPIC_AUTH_TOKEN),
        envHasApiKey: Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY),
      }));

      ipcMain.handle('setup:save', (_event, payload: SetupSavePayload) => {
        const next: Config = {
          ...cfg,
          provider: payload.provider,
          baseURL: payload.baseURL.trim(),
          model: payload.model.trim() || cfg.model,
          aggressiveness: payload.aggressiveness || 3,
        };
        saveConfig(next);

        const newKey = (payload.apiKey ?? '').trim();
        const newAuthToken = (payload.authToken ?? '').trim();

        if (newKey || newAuthToken) {
          const existing = loadSecrets();
          const merged = {
            apiKey: newKey || existing.apiKey,
            authToken: newAuthToken || existing.authToken,
          };
          try {
            saveSecrets(merged);
            next.apiKey = merged.apiKey;
            next.authToken = merged.authToken;
          } catch (e: any) {
            return { ok: false, error: e?.message ?? 'Failed to save credentials' };
          }
        } else {
          next.apiKey = cfg.apiKey;
          next.authToken = cfg.authToken;
        }

        saved = true;
        resolvedCfg = next;
        this.win?.close();
        return { ok: true };
      });

      ipcMain.handle('setup:cancel', () => {
        this.win?.close();
      });

      this.win = new BrowserWindow({
        width: 580,
        height: 680,
        title: 'OpenMagicPointer — Setup',
        resizable: false,
        maximizable: false,
        fullscreenable: false,
        autoHideMenuBar: true,
        backgroundColor: '#1c1e26',
        show: false,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          preload: path.join(__dirname, 'setup-preload.js'),
        },
      });

      this.win.once('ready-to-show', () => this.win?.show());

      this.win.on('closed', () => {
        this.win = null;
        finish({ saved, config: resolvedCfg });
      });

      void this.win.loadFile(path.join(__dirname, '..', 'setup', 'index.html'));
    });
  }
}

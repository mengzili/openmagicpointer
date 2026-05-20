import { BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { Config, saveConfig, ProviderId } from './config';
import { saveSecret, hasSecret } from './secret-store';

export interface SetupSavePayload {
  provider: ProviderId;
  baseURL: string;
  model: string;
  apiKey: string; // empty string = "don't change"
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
        // We never echo the actual key back — UI just gets a "key is set" bit.
        hasKey: Boolean(cfg.apiKey) || hasSecret(),
      }));

      ipcMain.handle('setup:save', (_event, payload: SetupSavePayload) => {
        const next: Config = {
          ...cfg,
          provider: payload.provider,
          baseURL: payload.baseURL.trim(),
          model: payload.model.trim() || cfg.model,
        };
        saveConfig(next);

        const newKey = (payload.apiKey ?? '').trim();
        if (newKey) {
          try {
            saveSecret(newKey);
            next.apiKey = newKey;
          } catch (e: any) {
            return { ok: false, error: e?.message ?? 'Failed to save key' };
          }
        } else {
          // No new key entered — keep whatever was already loaded into cfg.
          next.apiKey = cfg.apiKey;
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
        width: 560,
        height: 580,
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

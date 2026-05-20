import { app, safeStorage } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

// Stores the API key encrypted with the OS keychain (DPAPI on Windows,
// Keychain on macOS, libsecret on Linux). Kept in a separate file from the
// plaintext config.json so a curious onlooker reading config.json never sees a
// key, even briefly.

function secretFile(): string {
  return path.join(app.getPath('userData'), 'secret.bin');
}

export function loadSecret(): string {
  try {
    if (!safeStorage.isEncryptionAvailable()) return '';
    const p = secretFile();
    if (!fs.existsSync(p)) return '';
    const buf = fs.readFileSync(p);
    return safeStorage.decryptString(buf);
  } catch (e) {
    console.warn('loadSecret failed:', e);
    return '';
  }
}

export function saveSecret(key: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'OS encryption is not available — cannot store the API key securely. ' +
        'Set ANTHROPIC_API_KEY / OPENAI_API_KEY as an environment variable instead.',
    );
  }
  const buf = safeStorage.encryptString(key);
  const p = secretFile();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, buf);
}

export function clearSecret(): void {
  try {
    fs.unlinkSync(secretFile());
  } catch {
    /* ignore — file may already be gone */
  }
}

export function hasSecret(): boolean {
  try {
    return fs.existsSync(secretFile());
  } catch {
    return false;
  }
}

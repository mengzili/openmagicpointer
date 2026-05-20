import { app, safeStorage } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

// Stores secrets (apiKey + authToken) encrypted with the OS keychain (DPAPI
// on Windows, Keychain on macOS, libsecret on Linux). Lives in a separate
// file from the plaintext config.json so a curious onlooker reading
// config.json never sees a credential, even briefly.

export interface Secrets {
  apiKey: string;
  authToken: string;
}

const EMPTY: Secrets = { apiKey: '', authToken: '' };

function secretFile(): string {
  return path.join(app.getPath('userData'), 'secret.bin');
}

export function loadSecrets(): Secrets {
  try {
    if (!safeStorage.isEncryptionAvailable()) return { ...EMPTY };
    const p = secretFile();
    if (!fs.existsSync(p)) return { ...EMPTY };
    const buf = fs.readFileSync(p);
    const decrypted = safeStorage.decryptString(buf);
    // Forward-compat: if some future writer uses plain JSON, parse it; if it's
    // a bare string (a key with no JSON shape), treat it as apiKey.
    try {
      const obj = JSON.parse(decrypted);
      return {
        apiKey: typeof obj.apiKey === 'string' ? obj.apiKey : '',
        authToken: typeof obj.authToken === 'string' ? obj.authToken : '',
      };
    } catch {
      return { apiKey: decrypted, authToken: '' };
    }
  } catch (e) {
    console.warn('loadSecrets failed:', e);
    return { ...EMPTY };
  }
}

export function saveSecrets(secrets: Secrets): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'OS encryption is not available — cannot store credentials securely. ' +
        'Set ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / OPENAI_API_KEY as environment variables instead.',
    );
  }
  const json = JSON.stringify({
    apiKey: secrets.apiKey ?? '',
    authToken: secrets.authToken ?? '',
  });
  const buf = safeStorage.encryptString(json);
  const p = secretFile();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, buf);
}

export function clearSecrets(): void {
  try {
    fs.unlinkSync(secretFile());
  } catch {
    /* ignore — file may already be gone */
  }
}

export function hasAnySecret(): boolean {
  try {
    if (!fs.existsSync(secretFile())) return false;
    const s = loadSecrets();
    return Boolean(s.apiKey || s.authToken);
  } catch {
    return false;
  }
}

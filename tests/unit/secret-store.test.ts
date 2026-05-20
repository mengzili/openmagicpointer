import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

let TMP_DIR = '';
let encryptionAvailable = true;

vi.mock('electron', () => ({
  app: { getPath: () => TMP_DIR },
  safeStorage: {
    isEncryptionAvailable: () => encryptionAvailable,
    // Fake "encryption" that base64-encodes — enough to prove the secret-store
    // is actually piping through encryptString and not writing plaintext.
    encryptString: (s: string) => Buffer.from(Buffer.from(s, 'utf8').toString('base64'), 'utf8'),
    decryptString: (b: Buffer) => Buffer.from(b.toString('utf8'), 'base64').toString('utf8'),
  },
}));

import {
  loadSecrets,
  saveSecrets,
  hasAnySecret,
  clearSecrets,
} from '../../src/main/secret-store';

describe('secret-store', () => {
  beforeEach(() => {
    TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'omp-sec-'));
    encryptionAvailable = true;
  });

  afterEach(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it('returns empty struct when no secret has been saved', () => {
    expect(loadSecrets()).toEqual({ apiKey: '', authToken: '' });
    expect(hasAnySecret()).toBe(false);
  });

  it('round-trips apiKey through saveSecrets/loadSecrets', () => {
    saveSecrets({ apiKey: 'sk-real', authToken: '' });
    expect(hasAnySecret()).toBe(true);
    expect(loadSecrets()).toEqual({ apiKey: 'sk-real', authToken: '' });
  });

  it('round-trips authToken through saveSecrets/loadSecrets', () => {
    saveSecrets({ apiKey: '', authToken: 'bearer-token-xyz' });
    expect(hasAnySecret()).toBe(true);
    expect(loadSecrets()).toEqual({ apiKey: '', authToken: 'bearer-token-xyz' });
  });

  it('round-trips both fields together', () => {
    saveSecrets({ apiKey: 'sk-foo', authToken: 'tok-bar' });
    expect(loadSecrets()).toEqual({ apiKey: 'sk-foo', authToken: 'tok-bar' });
  });

  it('does not leave plaintext credentials in the on-disk file', () => {
    saveSecrets({ apiKey: 'sk-very-secret', authToken: 'tok-also-secret' });
    const raw = fs.readFileSync(path.join(TMP_DIR, 'secret.bin')).toString('utf8');
    expect(raw).not.toContain('sk-very-secret');
    expect(raw).not.toContain('tok-also-secret');
  });

  it('throws from saveSecrets when OS encryption is unavailable', () => {
    encryptionAvailable = false;
    expect(() => saveSecrets({ apiKey: 'sk', authToken: '' })).toThrow(/OS encryption/);
  });

  it('returns empty struct from loadSecrets when OS encryption is unavailable', () => {
    saveSecrets({ apiKey: 'sk-anything', authToken: '' });
    encryptionAvailable = false;
    expect(loadSecrets()).toEqual({ apiKey: '', authToken: '' });
  });

  it('treats a legacy bare-string secret.bin as { apiKey, authToken: "" }', () => {
    // Write a v0.1.1-style payload (single encrypted string, no JSON wrapper).
    const file = path.join(TMP_DIR, 'secret.bin');
    const legacyBuf = Buffer.from(Buffer.from('sk-legacy', 'utf8').toString('base64'), 'utf8');
    fs.writeFileSync(file, legacyBuf);
    expect(loadSecrets()).toEqual({ apiKey: 'sk-legacy', authToken: '' });
  });

  it('clearSecrets deletes the file', () => {
    saveSecrets({ apiKey: 'sk-temp', authToken: '' });
    expect(hasAnySecret()).toBe(true);
    clearSecrets();
    expect(hasAnySecret()).toBe(false);
    expect(loadSecrets()).toEqual({ apiKey: '', authToken: '' });
  });

  it('clearSecrets is a no-op when there is no saved file', () => {
    expect(() => clearSecrets()).not.toThrow();
  });
});

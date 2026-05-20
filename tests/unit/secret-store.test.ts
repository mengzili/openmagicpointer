import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

let TMP_DIR = '';
let encryptionAvailable = true;

// Mock electron — same pattern as config.test.ts. The arrow functions close
// over the let-bindings above, so mutating them in beforeEach is visible to
// the module under test.
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

import { loadSecret, saveSecret, hasSecret, clearSecret } from '../../src/main/secret-store';

describe('secret-store', () => {
  beforeEach(() => {
    TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'omp-sec-'));
    encryptionAvailable = true;
  });

  afterEach(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it('returns empty string when no secret has been saved', () => {
    expect(loadSecret()).toBe('');
    expect(hasSecret()).toBe(false);
  });

  it('round-trips a secret through saveSecret/loadSecret', () => {
    saveSecret('sk-very-secret');
    expect(hasSecret()).toBe(true);
    expect(loadSecret()).toBe('sk-very-secret');
  });

  it('does not leave the plaintext key in the on-disk file', () => {
    saveSecret('sk-very-secret');
    const file = path.join(TMP_DIR, 'secret.bin');
    const raw = fs.readFileSync(file).toString('utf8');
    expect(raw).not.toContain('sk-very-secret');
  });

  it('throws from saveSecret when OS encryption is unavailable', () => {
    encryptionAvailable = false;
    expect(() => saveSecret('sk-fail')).toThrow(/OS encryption/);
  });

  it('returns empty string from loadSecret when OS encryption is unavailable', () => {
    saveSecret('sk-anything');
    encryptionAvailable = false;
    expect(loadSecret()).toBe('');
  });

  it('clearSecret deletes the file', () => {
    saveSecret('sk-temp');
    expect(hasSecret()).toBe(true);
    clearSecret();
    expect(hasSecret()).toBe(false);
    expect(loadSecret()).toBe('');
  });

  it('clearSecret is a no-op when there is no saved secret', () => {
    expect(() => clearSecret()).not.toThrow();
  });
});

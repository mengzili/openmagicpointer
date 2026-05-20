import { describe, it, expect } from 'vitest';
import { fingerprintFromBgra } from '../../src/main/fingerprint';

describe('fingerprintFromBgra', () => {
  it('returns a 32-char hex string', () => {
    const bgra = Buffer.alloc(32 * 32 * 4, 128);
    const fp = fingerprintFromBgra(bgra, 32, 32);
    expect(fp).toMatch(/^[0-9a-f]{32}$/);
  });

  it('same input produces same fingerprint', () => {
    const bgra = Buffer.alloc(64 * 64 * 4, 200);
    const a = fingerprintFromBgra(bgra, 64, 64);
    const b = fingerprintFromBgra(bgra, 64, 64);
    expect(a).toBe(b);
  });

  it('different input produces different fingerprint', () => {
    const a = Buffer.alloc(32 * 32 * 4, 0);
    const b = Buffer.alloc(32 * 32 * 4, 255);
    expect(fingerprintFromBgra(a, 32, 32)).not.toBe(fingerprintFromBgra(b, 32, 32));
  });

  it('throws on wrong buffer size', () => {
    expect(() => fingerprintFromBgra(Buffer.alloc(10), 32, 32)).toThrow();
  });
});

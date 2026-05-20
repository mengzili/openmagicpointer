import { describe, it, expect } from 'vitest';
import { encodePng, circlePng } from '../../src/main/png';

describe('encodePng', () => {
  it('produces a valid PNG signature', () => {
    const rgba = Buffer.alloc(4 * 4 * 4, 0xff); // 4x4 white
    const png = encodePng(4, 4, rgba);
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  });

  it('throws on wrong buffer size', () => {
    expect(() => encodePng(4, 4, Buffer.alloc(10))).toThrow();
  });

  it('IHDR chunk encodes width and height', () => {
    const rgba = Buffer.alloc(8 * 6 * 4, 0);
    const png = encodePng(8, 6, rgba);
    // IHDR starts at offset 8 (signature) + 4 (length) + 4 (type) = 16
    const w = png.readUInt32BE(16);
    const h = png.readUInt32BE(20);
    expect(w).toBe(8);
    expect(h).toBe(6);
  });
});

describe('circlePng', () => {
  it('returns a non-empty PNG buffer', () => {
    const png = circlePng(16, '#ff0000');
    expect(png.length).toBeGreaterThan(50);
    expect(png.subarray(0, 4).toString('hex')).toBe('89504e47');
  });

  it('different colours produce different output', () => {
    const a = circlePng(16, '#ff0000');
    const b = circlePng(16, '#00ff00');
    expect(a.equals(b)).toBe(false);
  });
});

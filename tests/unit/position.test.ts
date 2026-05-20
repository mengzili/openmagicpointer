import { describe, it, expect } from 'vitest';
import { bubblePosition, Rect } from '../../src/main/position';

const WORK: Rect = { x: 0, y: 0, width: 1920, height: 1080 };

describe('bubblePosition', () => {
  it('places bubble to the right and below cursor by default', () => {
    const pos = bubblePosition(500, 400, WORK, 420, 200, 18);
    expect(pos.x).toBe(500 + 18);
    expect(pos.y).toBe(400 + 18);
  });

  it('flips left when cursor is near right edge', () => {
    const pos = bubblePosition(1800, 400, WORK, 420, 200, 18);
    expect(pos.x).toBe(1800 - 420 - 18);
  });

  it('flips up when cursor is near bottom edge', () => {
    const pos = bubblePosition(500, 950, WORK, 420, 200, 18);
    expect(pos.y).toBe(950 - 200 - 18);
  });

  it('clamps to work area when cursor is at top-left corner', () => {
    const pos = bubblePosition(0, 0, WORK, 420, 200, 18);
    expect(pos.x).toBeGreaterThanOrEqual(8);
    expect(pos.y).toBeGreaterThanOrEqual(8);
  });

  it('handles work area with offset (e.g. taskbar on left)', () => {
    const work: Rect = { x: 64, y: 0, width: 1856, height: 1080 };
    const pos = bubblePosition(70, 500, work, 420, 200, 18);
    expect(pos.x).toBeGreaterThanOrEqual(64 + 8);
  });
});

import * as crypto from 'crypto';

/**
 * Compute a coarse perceptual fingerprint of a 32x32 grayscale buffer.
 * Designed to be stable across small pixel noise (JPEG compression, anti-alias
 * jitter) but to change when the on-screen content meaningfully changes.
 *
 * Inputs are kept primitive (raw BGRA buffer + dimensions) so this function is
 * importable in plain-Node test environments — no Electron dependency.
 */
export function fingerprintFromBgra(bgra: Buffer, width: number, height: number): string {
  if (bgra.length !== width * height * 4) {
    throw new Error(`fingerprintFromBgra: buffer size ${bgra.length} != ${width * height * 4}`);
  }
  // Downscale to 32x32 via box-average sampling, then convert to grayscale.
  const TARGET = 32;
  const gray = Buffer.alloc(TARGET * TARGET);
  const xStep = width / TARGET;
  const yStep = height / TARGET;
  for (let ty = 0; ty < TARGET; ty++) {
    for (let tx = 0; tx < TARGET; tx++) {
      // Pick the centre pixel of each cell — fast, stable, good enough for hashing.
      const sx = Math.min(width - 1, Math.floor((tx + 0.5) * xStep));
      const sy = Math.min(height - 1, Math.floor((ty + 0.5) * yStep));
      const i = (sy * width + sx) * 4;
      // BGRA → grayscale (ITU-R BT.601 luminance)
      gray[ty * TARGET + tx] = Math.round(
        0.114 * bgra[i] + 0.587 * bgra[i + 1] + 0.299 * bgra[i + 2]
      );
    }
  }
  return crypto.createHash('md5').update(gray).digest('hex');
}

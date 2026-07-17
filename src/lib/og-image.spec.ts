import { expect, test } from 'vitest';
import { OG_CARD_HEIGHT, OG_CARD_WIDTH, renderOgCard } from './og-image';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];

// PNG's IHDR chunk (width/height, big-endian) always starts right after the
// 8-byte signature + 4-byte chunk length + 4-byte "IHDR" type.
function readPngDimensions(png: Buffer): { width: number; height: number } {
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  };
}

// Real satori+resvg rendering (no meaningful way to mock it) — under the
// full suite's parallel worker load this occasionally exceeds vitest's
// default 5s test timeout, so give it more headroom.
const RENDER_TIMEOUT = 15_000;

test(
  'renders a correctly-sized PNG buffer for a site card',
  async () => {
    const png = await renderOgCard({
      title: 'Jared Sheohn L. Acebes - Portfolio',
      summary: 'Computer Science Student, Cebu, PH.',
      kind: 'site',
    });
    expect(Buffer.isBuffer(png)).toBe(true);
    expect(png.length).toBeGreaterThan(0);
    expect(Array.from(png.subarray(0, 4))).toEqual(PNG_SIGNATURE);
    expect(readPngDimensions(png)).toEqual({
      width: OG_CARD_WIDTH,
      height: OG_CARD_HEIGHT,
    });
  },
  RENDER_TIMEOUT,
);

test(
  'renders a non-empty PNG buffer for a project card without a summary',
  async () => {
    const png = await renderOgCard({ title: 'Animo', kind: 'project' });
    expect(png.length).toBeGreaterThan(0);
    expect(Array.from(png.subarray(0, 4))).toEqual(PNG_SIGNATURE);
  },
  RENDER_TIMEOUT,
);

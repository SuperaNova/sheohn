import { describe, expect, test } from 'vitest';
import {
  pickToggleOrigin,
  whooshEndRadius,
  isEnteringDark,
  shouldPlayDarkEntrance,
} from './theme-transition';

describe('pickToggleOrigin', () => {
  const viewport = { width: 1280, height: 800 };

  test('uses the center of the first on-screen rect', () => {
    const origin = pickToggleOrigin(
      [{ left: 100, top: 20, width: 40, height: 20 }],
      viewport,
    );
    expect(origin).toEqual({ x: 120, y: 30 });
  });

  test('skips zero-area rects (hidden via display:none) for a later visible one', () => {
    const origin = pickToggleOrigin(
      [
        { left: 0, top: 0, width: 0, height: 0 },
        { left: 200, top: 40, width: 60, height: 24 },
      ],
      viewport,
    );
    expect(origin).toEqual({ x: 230, y: 52 });
  });

  test('falls back to the top-right corner when no rect is on-screen', () => {
    const origin = pickToggleOrigin(
      [{ left: 0, top: 0, width: 0, height: 0 }],
      viewport,
    );
    expect(origin).toEqual({ x: 1280, y: 0 });
  });

  test('falls back to the top-right corner for an empty rect list', () => {
    expect(pickToggleOrigin([], viewport)).toEqual({ x: 1280, y: 0 });
  });
});

describe('whooshEndRadius', () => {
  test('covers the farthest viewport corner from the origin', () => {
    // From the top-right corner, the farthest point is bottom-left.
    const r = whooshEndRadius({ x: 1280, y: 0 }, { width: 1280, height: 800 });
    expect(r).toBeCloseTo(Math.hypot(1280, 800));
  });

  test('is 0 for a zero-size viewport', () => {
    expect(whooshEndRadius({ x: 0, y: 0 }, { width: 0, height: 0 })).toBe(0);
  });
});

describe('isEnteringDark', () => {
  test('true only for a light-to-dark transition', () => {
    expect(isEnteringDark('light', 'dark')).toBe(true);
  });

  test('false for dark-to-light, or no change', () => {
    expect(isEnteringDark('dark', 'light')).toBe(false);
    expect(isEnteringDark('dark', 'dark')).toBe(false);
    expect(isEnteringDark('light', 'light')).toBe(false);
  });
});

describe('shouldPlayDarkEntrance', () => {
  test('plays for a first-time dark landing with motion allowed', () => {
    expect(
      shouldPlayDarkEntrance({
        theme: 'dark',
        alreadyPlayed: false,
        reducedMotion: false,
      }),
    ).toBe(true);
  });

  test('skips when landing in light', () => {
    expect(
      shouldPlayDarkEntrance({
        theme: 'light',
        alreadyPlayed: false,
        reducedMotion: false,
      }),
    ).toBe(false);
  });

  test('skips once already played this session', () => {
    expect(
      shouldPlayDarkEntrance({
        theme: 'dark',
        alreadyPlayed: true,
        reducedMotion: false,
      }),
    ).toBe(false);
  });

  test('skips under reduced motion', () => {
    expect(
      shouldPlayDarkEntrance({
        theme: 'dark',
        alreadyPlayed: false,
        reducedMotion: true,
      }),
    ).toBe(false);
  });
});

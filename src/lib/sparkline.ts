// Pure point-math for hand-rolled inline SVG sparklines — no chart library.
// src/components/status/Sparkline.astro renders the <polyline> this produces.

export interface SparklineDimensions {
  width?: number;
  height?: number;
  padding?: number;
}

const DEFAULT_WIDTH = 240;
const DEFAULT_HEIGHT = 48;
const DEFAULT_PADDING = 4;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Maps a series of values onto an SVG `points` string normalized to fit the
 * given box (higher values render higher, i.e. smaller y). An empty series
 * returns ''; a single value or an all-equal series renders as a flat
 * mid-height line rather than collapsing to the bottom edge.
 */
export function buildSparklinePoints(
  values: number[],
  dims: SparklineDimensions = {},
): string {
  const {
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    padding = DEFAULT_PADDING,
  } = dims;

  if (values.length === 0) return '';

  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const midY = round2(padding + innerHeight / 2);

  if (values.length === 1) {
    return `${padding},${midY} ${round2(padding + innerWidth)},${midY}`;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const stepX = innerWidth / (values.length - 1);

  if (min === max) {
    return values
      .map((_, i) => `${round2(padding + i * stepX)},${midY}`)
      .join(' ');
  }

  const range = max - min;
  return values
    .map((value, i) => {
      const x = round2(padding + i * stepX);
      const normalized = (value - min) / range;
      const y = round2(padding + innerHeight - normalized * innerHeight);
      return `${x},${y}`;
    })
    .join(' ');
}

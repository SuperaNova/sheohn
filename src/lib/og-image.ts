// Build-time-only module: renders a per-page/case-study social card with
// satori (layout + SVG) and @resvg/resvg-js (SVG -> PNG). Pure local
// rendering — no network calls, no client bundle exposure. Call this only
// from an Astro endpoint's frontmatter/handler (see src/pages/og/[...slug].png.ts).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { personalInfo } from '../data/personalInfo';

export const OG_CARD_WIDTH = 1200;
export const OG_CARD_HEIGHT = 630;

// Dark-hero pastel-phosphor scene palette, hardcoded from
// src/styles/global.css's --color-scene-*/--color-console-* tokens — satori
// renders server-side and cannot read CSS custom properties.
const SCENE = {
  sky0: '#05080a',
  sky1: '#0a1410',
  sky2: '#142a1e',
  gridLine: 'rgba(169, 216, 187, 0.55)',
  horizonLine: '#a9d8bb',
  glow: 'rgba(191, 230, 207, 0.55)',
  glowShadow: 'rgba(191, 230, 207, 0.35)',
  sunTop: '#f3efe8',
  sunMid: '#dceade',
  sunBottom: '#b9d9c6',
  vignette: 'rgba(3, 6, 5, 0.55)',
  // --color-on-cta-accent (dark theme value) at ~40% for the specimen-plate
  // frame border, matching HeroSection's .hero-frame treatment.
  frame: 'rgba(142, 214, 164, 0.4)',
} as const;

const CONSOLE = {
  text: '#e6ece6',
  textDim: '#9aa69a',
  signal: '#4ade80',
} as const;

// Resolved against process.cwd() (always the project root for `astro build`
// and vitest), not import.meta.dirname/url — Astro relocates the compiled
// endpoint chunk into dist/server/.prerender/, which breaks any path built
// relative to the bundled module's own location.
const FONT_DIR = join(process.cwd(), 'src/assets/fonts');

function loadFont(file: string): Buffer {
  return readFileSync(join(FONT_DIR, file));
}

// Read once at module scope so every getStaticPaths call reuses the buffers.
const FONTS = [
  {
    name: 'Inter',
    data: loadFont('Inter-Regular.ttf'),
    weight: 400,
    style: 'normal',
  },
  {
    name: 'Inter',
    data: loadFont('Inter-Medium.ttf'),
    weight: 500,
    style: 'normal',
  },
  {
    name: 'Inter',
    data: loadFont('Inter-SemiBold.ttf'),
    weight: 600,
    style: 'normal',
  },
  {
    name: 'Inter',
    data: loadFont('Inter-Bold.ttf'),
    weight: 700,
    style: 'normal',
  },
  {
    name: 'Playfair Display',
    data: loadFont('PlayfairDisplay-Medium.ttf'),
    weight: 500,
    style: 'normal',
  },
  {
    name: 'Playfair Display',
    data: loadFont('PlayfairDisplay-SemiBold.ttf'),
    weight: 600,
    style: 'normal',
  },
  {
    name: 'Playfair Display',
    data: loadFont('PlayfairDisplay-Bold.ttf'),
    weight: 700,
    style: 'normal',
  },
] as const satisfies Parameters<typeof satori>[1]['fonts'];

export interface OgCardInput {
  title: string;
  summary?: string;
  kind: 'site' | 'project';
  // Index signature so this satisfies Astro's getStaticPaths Props type
  // (Record<string, unknown>).
  [key: string]: unknown;
}

type Style = Record<string, string | number>;

// satori accepts a React-like element tree; authored as plain object
// literals since no JSX pragma is configured in this Astro+Svelte project.
interface SatoriNode {
  type: string;
  props: { style?: Style; children?: SatoriNode | SatoriNode[] | string };
}

function el(
  type: string,
  style: Style = {},
  children?: SatoriNode | (SatoriNode | false | null | undefined)[] | string,
): SatoriNode {
  return {
    type,
    props: {
      style,
      children: Array.isArray(children)
        ? (children.filter(Boolean) as SatoriNode[])
        : children,
    },
  };
}

function mixHex(a: string, b: string, t: number): string {
  const ch = (hex: string, i: number) => parseInt(hex.slice(i, i + 2), 16);
  const r = Math.round(ch(a, 1) + (ch(b, 1) - ch(a, 1)) * t);
  const g = Math.round(ch(a, 3) + (ch(b, 3) - ch(a, 3)) * t);
  const bl = Math.round(ch(a, 5) + (ch(b, 5) - ch(a, 5)) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

/** Cream at the disc's top, sage toward the horizon — the hero sun's gradient. */
function sunSlatColor(f: number): string {
  return f <= 0.65
    ? mixHex(SCENE.sunTop, SCENE.sunMid, f / 0.65)
    : mixHex(SCENE.sunMid, SCENE.sunBottom, (f - 0.65) / 0.35);
}

// Sun geometry: a half-set disc, its widest chord resting on the horizon.
const SUN_R = 120;
const SUN_RIGHT = 120;
const SUN_BOTTOM = 262; // horizon top edge
const SLAT_H = 10;
const SLAT_GAP = 4;

/**
 * The hero's slatted paper sun, as satori-safe plain rects: a vertical stack
 * of centered horizontal bars whose widths follow the disc's chord lengths
 * (narrow at the top, full diameter at the horizon), with sky gaps between —
 * no masks, no clipping, no box-shadow, so resvg never needs clip/filter
 * handling for it.
 */
function buildSunSlats(): SatoriNode[] {
  const bars: SatoriNode[] = [];
  for (let t = 0; t < SUN_R; t += SLAT_H + SLAT_GAP) {
    const h = Math.min(SLAT_H, SUN_R - t);
    const mid = t + h / 2;
    const d = SUN_R - mid; // distance above the disc center (on the horizon)
    const w = 2 * Math.sqrt(Math.max(0, SUN_R * SUN_R - d * d));
    bars.push(
      el('div', {
        width: Math.round(w),
        height: h,
        marginTop: t === 0 ? 0 : SLAT_GAP,
        borderRadius: 2,
        backgroundColor: sunSlatColor(mid / SUN_R),
        display: 'flex',
      }),
    );
  }
  return bars;
}

/** Builds the satori element tree for a single card. */
function buildCard({ title, summary, kind }: OgCardInput): SatoriNode {
  // Grid floor below the horizon.
  const grid = el('div', {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 260,
    display: 'flex',
    opacity: 0.45,
    backgroundImage: `linear-gradient(to right, ${SCENE.gridLine} 1px, transparent 1px), linear-gradient(to bottom, ${SCENE.gridLine} 1px, transparent 1px)`,
    backgroundSize: '48px 48px',
  });

  // Slatted paper sun: the visible top half of the disc, ending at the
  // horizon like the hero's half-set sun.
  const sun = el(
    'div',
    {
      position: 'absolute',
      right: SUN_RIGHT,
      bottom: SUN_BOTTOM,
      width: SUN_R * 2,
      height: SUN_R,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    buildSunSlats(),
  );

  // Soft bloom behind the sun — a gradient sibling, not a box-shadow, so no
  // element needs resvg clip/filter handling. Centered slightly above the
  // horizon so it halos the visible disc instead of pooling on the floor.
  const sunGlow = el('div', {
    position: 'absolute',
    right: SUN_RIGHT - 50,
    bottom: SUN_BOTTOM - 130,
    width: 340,
    height: 340,
    display: 'flex',
    backgroundImage: `radial-gradient(ellipse 50% 50% at 50% 50%, ${SCENE.glowShadow} 0%, rgba(191, 230, 207, 0) 68%)`,
  });

  const horizonLine = el('div', {
    position: 'absolute',
    left: 80,
    right: 80,
    bottom: 260,
    height: 2,
    display: 'flex',
    backgroundColor: SCENE.horizonLine,
    opacity: 0.7,
    boxShadow: `0 0 30px 4px ${SCENE.glow}`,
  });

  const frame = el('div', {
    position: 'absolute',
    top: 44,
    left: 40,
    right: 40,
    bottom: 40,
    display: 'flex',
    border: `1px solid ${SCENE.frame}`,
  });

  const vignette = el('div', {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    backgroundImage: `radial-gradient(ellipse 90% 90% at 50% 45%, transparent 55%, ${SCENE.vignette} 100%)`,
  });

  const kicker = el(
    'div',
    {
      display: 'flex',
      fontFamily: 'Inter',
      fontWeight: 600,
      fontSize: 22,
      letterSpacing: 5,
      color: CONSOLE.signal,
    },
    `› ${kind === 'project' ? 'CASE STUDY' : 'PORTFOLIO'}`,
  );

  const titleNode = el(
    'div',
    {
      display: 'flex',
      marginTop: 20,
      fontFamily: 'Playfair Display',
      fontWeight: 700,
      fontSize: 64,
      lineHeight: 1.08,
      color: CONSOLE.text,
      maxWidth: 680,
      letterSpacing: -1,
    },
    title,
  );

  const summaryNode = summary
    ? el(
        'div',
        {
          display: 'flex',
          marginTop: 24,
          fontFamily: 'Inter',
          fontWeight: 400,
          fontSize: 26,
          lineHeight: 1.5,
          color: CONSOLE.textDim,
          maxWidth: 620,
        },
        summary,
      )
    : undefined;

  const footer = el(
    'div',
    {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
    },
    [
      el(
        'div',
        {
          display: 'flex',
          fontFamily: 'Inter',
          fontWeight: 600,
          fontSize: 22,
          color: CONSOLE.signal,
        },
        '› sheohn.dev',
      ),
      el(
        'div',
        {
          display: 'flex',
          fontFamily: 'Inter',
          fontWeight: 500,
          fontSize: 18,
          letterSpacing: 2,
          color: CONSOLE.textDim,
        },
        personalInfo.location.toUpperCase(),
      ),
    ],
  );

  const content = el(
    'div',
    {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '84px 96px 56px 96px',
    },
    [
      el('div', { display: 'flex', flexDirection: 'column' }, [
        kicker,
        titleNode,
        summaryNode,
      ]),
      footer,
    ],
  );

  return el(
    'div',
    {
      width: OG_CARD_WIDTH,
      height: OG_CARD_HEIGHT,
      display: 'flex',
      position: 'relative',
      // No overflow:hidden here — combined with a boxShadow-bearing
      // descendant (the horizon line), it panics resvg's native clip/filter
      // code. Every child stays within the 1200x630 canvas anyway.
      backgroundImage: `linear-gradient(to bottom, ${SCENE.sky0} 0%, ${SCENE.sky1} 55%, ${SCENE.sky2} 100%)`,
      fontFamily: 'Inter',
    },
    // Vignette first: it darkens the sky/corners but must never mute the
    // sun, which paints above it.
    [vignette, sunGlow, sun, horizonLine, grid, frame, content],
  );
}

/** Renders a dark-hero-motif OG card to a PNG buffer. */
export async function renderOgCard(input: OgCardInput): Promise<Buffer> {
  const svg = await satori(buildCard(input) as never, {
    width: OG_CARD_WIDTH,
    height: OG_CARD_HEIGHT,
    fonts: FONTS as unknown as Parameters<typeof satori>[1]['fonts'],
  });

  const resvg = new Resvg(svg);
  return resvg.render().asPng();
}

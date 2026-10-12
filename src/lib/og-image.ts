// Build-time-only OG card renderer (satori layout + resvg PNG); call from an Astro endpoint.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { personalInfo } from '../data/personalInfo';

export const OG_CARD_WIDTH = 1200;
export const OG_CARD_HEIGHT = 630;

// Mirrors global.css's --color-scene-*/--color-console-* tokens; satori can't read CSS variables.
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
  // --color-on-cta-accent (dark) at ~40%, matching HeroSection's .hero-frame.
  frame: 'rgba(142, 214, 164, 0.4)',
} as const;

const CONSOLE = {
  text: '#e6ece6',
  textDim: '#9aa69a',
  signal: '#4ade80',
} as const;

// process.cwd(), not import.meta.dirname: Astro relocates the compiled endpoint chunk.
const FONT_DIR = join(process.cwd(), 'src/assets/fonts');

function loadFont(file: string): Buffer {
  return readFileSync(join(FONT_DIR, file));
}

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
  // Satisfies Astro's getStaticPaths Props type.
  [key: string]: unknown;
}

type Style = Record<string, string | number>;

// satori takes a React-like element tree; built as plain objects (no JSX pragma).
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

// Half-set disc, widest chord on the horizon.
const SUN_R = 120;
const SUN_RIGHT = 120;
const SUN_BOTTOM = 262; // horizon top edge
const SLAT_H = 10;
const SLAT_GAP = 4;

/**
 * The hero's slatted sun as plain rects (no masks, clipping, or box-shadow), keeping
 * resvg off its clip/filter paths.
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

  // Slatted sun: the visible top half of the disc.
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

  // Bloom as a gradient sibling, not a box-shadow, to avoid resvg clip/filter handling.
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
      // No overflow:hidden: with the boxShadow horizon line it panics resvg's clip code.
      backgroundImage: `linear-gradient(to bottom, ${SCENE.sky0} 0%, ${SCENE.sky1} 55%, ${SCENE.sky2} 100%)`,
      fontFamily: 'Inter',
    },
    // Vignette first so it never mutes the sun.
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

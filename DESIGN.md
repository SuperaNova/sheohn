---
name: sheohn.dev
description: The Naturalist's Terminal — warm field-almanac surfaces carry the content; an alive instrument-console reports system state.
colors:
  surface: '#f3efe8'
  surface-container-low: '#ece6dc'
  surface-container: '#e4ddd2'
  surface-container-high: '#dad2c6'
  surface-container-highest: '#cec4b6'
  on-surface: '#1c1c19'
  on-surface-muted: '#4c4b45'
  primary: '#182519'
  primary-container: '#2d3b2d'
  tertiary: '#2f5a3c'
  tertiary-container: '#23452d'
  outline-variant: '#c4c8c0'
  error: '#b91c1c'
  on-cta: '#f1f5f9'
  on-cta-accent: '#6fbf86'
  console-surface: '#161616'
  console-elev: '#1f1f1f'
  console-line: '#4ade8038'
  console-signal: '#4ade80'
  console-signal-strong: '#22c55e'
  console-text: '#e6ece6'
  console-text-dim: '#9aa69a'
typography:
  display:
    fontFamily: 'Playfair Display, Georgia, serif'
    fontSize: 'clamp(3.75rem, 8vw, 5rem)'
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: '-0.02em'
  headline:
    fontFamily: 'Playfair Display, Georgia, serif'
    fontSize: 'clamp(2.25rem, 5vw, 3rem)'
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: '-0.02em'
  body:
    fontFamily: 'Inter, system-ui, sans-serif'
    fontSize: 'clamp(1rem, 1.2vw, 1.125rem)'
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 'normal'
  label:
    fontFamily: 'Inter, system-ui, sans-serif'
    fontSize: '0.75rem'
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: '0.16em'
  mono:
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace'
    fontSize: '0.8125rem'
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 'normal'
rounded:
  xs: '4px'
  md: '6px'
  lg: '8px'
  xl: '12px'
  2xl: '16px'
spacing:
  sm: '8px'
  md: '16px'
  lg: '24px'
  section: '96px'
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '#e2e8f0'
    typography: '{typography.label}'
    rounded: '{rounded.lg}'
    padding: '12px 24px'
  button-primary-hover:
    backgroundColor: '{colors.primary-container}'
    textColor: '#e2e8f0'
    rounded: '{rounded.lg}'
    padding: '12px 24px'
  chip:
    backgroundColor: '{colors.surface-container}'
    textColor: '{colors.on-surface-muted}'
    rounded: '{rounded.md}'
    padding: '6px 10px'
  chip-hover:
    backgroundColor: '{colors.surface-container}'
    textColor: '{colors.on-surface}'
    rounded: '{rounded.md}'
    padding: '6px 10px'
  input:
    backgroundColor: '{colors.surface-container}'
    textColor: '{colors.on-surface}'
    rounded: '{rounded.lg}'
    padding: '12px 16px'
  card:
    backgroundColor: '{colors.surface-container-high}'
    textColor: '{colors.on-surface}'
    rounded: '{rounded.2xl}'
    padding: '32px'
  console-deck:
    backgroundColor: '{colors.console-surface}'
    textColor: '{colors.console-text}'
    typography: '{typography.mono}'
    rounded: '{rounded.xl}'
    padding: '16px'
---

# Design System: sheohn.dev

## 1. Overview

**Creative North Star: "The Naturalist's Terminal."**

Two worlds share one screen and never bleed into each other. The **content layer** is a warm field-almanac: aged-paper surfaces (`#f3efe8`), a Playfair Display masthead, an architectural grid faintly behind the hero — a colonial-explorer's logbook where work is catalogued by hand. The **instrument layer** is an alive console: instrument-black panels (`#161616`), monospace readouts, a pulsing signal-green (`#4ade80`) that reports system state. The almanac is read; the terminal is operated. The contrast between the two _is_ the identity.

This is a portfolio where design IS the product, so it commits. It is **composed, precise, and deep** — quiet expert confidence in tone — but it earns attention through one genuinely bold, technical move: a live, RAG-powered AI agent that answers questions about Jared and drives the page from the console. The restraint of the content layer exists precisely so the instrument layer can feel alive. Quiet content, alive instruments.

It explicitly rejects two things. It is **not a generic SaaS or template portfolio** — no interchangeable card grid, no "looks like everyone's starter." And it is **not cold or corporate** — the paper warmth, the hand-catalogued voice, and the naturalist green keep a human point of view in every view. Boldness here always serves credibility; it never tips into gimmickry.

**Key Characteristics:**

- A strict two-layer system: warm field-almanac content vs. instrument-black console chrome. The two palettes never mix.
- One accent only — operative forest green — carried across both layers in different keys (`#2f5a3c` on paper, `#4ade80` on the console).
- Serif masthead (Playfair) over sans body (Inter), with monospace reserved for system/instrument voice.
- Flat, tonally-layered surfaces; depth is a _response_ to interaction, not a resting state.
- Light is the default; a true near-black dark theme is a first-class peer, not an afterthought.

## 2. Colors

A warm, low-chroma paper palette for content, set against a near-black instrument palette for chrome, unified by a single forest-green accent.

### Primary

- **Deep Forest** (`#182519` light / `#3d6a49` dark): the darkest brand green. Used for the primary CTA fill (as a subtle radial from `Forest Container` into `Deep Forest`) and for high-emphasis display moments like the 404 numeral.
- **Forest Container** (`#2d3b2d` light / `#49825b` dark): the lighter half of the primary button gradient and medium-emphasis brand green surfaces.

### Secondary

- **Operative Forest** (`#2f5a3c` light / `#5fba82` dark): the single interactive accent. Links on hover, focus rings, the `.dev` in the logo, the `›` markers in the readout eyebrow and starter chips, active-state highlights. This is the _only_ accent in the content layer.
- **Operative Forest Container** (`#23452d` light / `#49825b` dark): tinted backing for accent labels (e.g. a project's "Featured" tag).

### Neutral — The Field-Paper Ramp

- **Field Paper** (`#f3efe8` light / `#050505` dark): the page background. The warm paper that carries everything.
- **Container Low → Highest** (`#ece6dc` · `#e4ddd2` · `#dad2c6` · `#cec4b6` light): a four-step tonal ramp for nested surfaces, cards, chips, and inputs. Dark mode mirrors it from `#0b0b0b` to `#1f1f1f`. **This ramp does the work shadows would do elsewhere.**
- **Ink** (`#1c1c19` light / `#ecf2ec` dark): primary text. Contrast on Field Paper ≈ 14:1.
- **Muted Ink** (`#4c4b45` light / `#c9d4c9` dark): secondary text, labels, captions. Contrast on Field Paper ≈ 7.5:1 — comfortably AA for body.
- **Outline Variant** (`#c4c8c0` light / `#2c2f2a` dark): hairline borders and dividers.

### Functional & CTA foreground

- **Error** (`#b91c1c` light / `#f87171` dark): validation error text and `aria-invalid` borders. Deliberately darker than Tailwind `red-500` (which fails AA on the warm paper); clears ≥4.5:1 on both the page surface and the input container.
- **On-CTA** (`#f1f5f9`, theme-independent): the light label on the dark primary-CTA gradient (the value `cta-from/to` was tuned to clear AA against).
- **On-CTA Accent** (`#6fbf86` light / `#8ed6a4` dark): the leading `›` marker on the CTA — the brand's own light forest, **not** a Tailwind mint, so the One Voice Rule holds on the dark button. Lifted in dark mode to stay crisp on the lighter dark-theme gradient.

### Tertiary — The Console (theme-independent)

The console palette is **deliberately fixed across light and dark themes**. Control surfaces always read as an instrument panel framing the warm content, regardless of mode.

- **Instrument Black** (`#161616`) / **Instrument Elevated** (`#1f1f1f`): console panel surfaces (CommandDeck, Loader, boot sequence).
- **Signal Green** (`#4ade80`) / **Signal Strong** (`#22c55e`): the "alive" indicator — pulsing status dot, active console items, links inside the deck.
- **Console Line** (`#4ade8038`): the green-tinted hairline that frames console panels.
- **Console Text** (`#e6ece6`) / **Console Text Dim** (`#9aa69a`): readout copy and de-emphasized console metadata.

### Named Rules

**The One Voice Rule.** There is exactly one accent: Operative Forest. No second hue is ever introduced into the content layer. Boldness comes from _where_ the green lands, never from adding a color.

**The Two-Layer Rule.** Console colors (`console-*`) are forbidden outside the console — CommandDeck, Loader, and system indicators only. Field-paper colors are forbidden inside the console. The two palettes never touch. If a green looks "off," check which layer you're in: `#2f5a3c` belongs to paper, `#4ade80` belongs to the instrument.

## 3. Typography

**Display Font:** Playfair Display (with Georgia, serif fallback)
**Body Font:** Inter (with system-ui, sans-serif fallback)
**Label/Mono Font:** system monospace stack (ui-monospace, SFMono-Regular, Menlo)

**Character:** A high-contrast pairing on a real axis — a transitional serif masthead against a neutral grotesque body. Playfair carries the hand-catalogued, almanac authority; Inter keeps the prose clean and credible; monospace is the _voice of the machine_, reserved for anything the system "says." The serif is the author, the mono is the instrument.

### Hierarchy

- **Display** (Playfair, 400, `clamp(3.75rem, 8vw, 5rem)`, line-height 0.95, tracking -0.02em): the hero name only. Capped at 5rem — present, never shouting.
- **Headline** (Playfair, 400–700, `clamp(2.25rem, 5vw, 3rem)`, line-height 1.1): section titles and project titles (project titles take 700).
- **Body** (Inter, 400, ~1–1.125rem, line-height 1.6): all prose. Cap measure at 65–75ch (`max-w-2xl`).
- **Label** (Inter, 600, 0.75rem, tracking 0.16–0.24em, uppercase): the small structural labels (form field labels, metadata).
- **Readout / Mono** (mono, ~0.7–0.8125rem, tracking 0.18–0.2em where labelled): the system voice — the `› CURRENTLY` eyebrow, nav links, console copy, the DecoderText scramble, time/clock.

### Named Rules

**The System-Voice Rule.** Monospace is reserved for things the _system_ expresses: readout eyebrows, nav, console, decoder text, timestamps. It is never used for human prose. Mono on a paragraph would turn the instrument voice into costume.

**The Readout Rule.** Section eyebrows use the `.readout` treatment — mono, uppercase, 0.2em tracking, Operative Forest, prefixed with `›`. This is the project's _one_ deliberate, named kicker system; it stands in place of generic all-caps eyebrows and must not be supplemented with a second eyebrow style.

## 4. Elevation

The system is **flat by default and tonally layered**. Depth comes from the four-step Field-Paper container ramp (`surface` → `surface-container-highest`), not from resting shadows. Shadows are a _response to state_ — they appear on hover and focus, never at rest. The one exception is the console, which floats above the page as a true overlay.

### Shadow Vocabulary

- **CTA Lift** (`box-shadow: 0 18px 34px rgba(28,28,25,0.22)` → hover `0 22px 46px rgba(28,28,25,0.32)`): the primary button's soft, warm-tinted drop. The only shadow that exists near-at-rest, and it grows on hover.
- **Hard Offset** (`box-shadow: 4px 4px 0 0 var(--color-surface-container-highest)`; dark: `…var(--color-primary-container)`): the signature almanac move — a crisp, paper-cutout offset that appears under the hero "Currently" card on hover. Tactile, hand-pressed, never blurred.
- **Floating Console** (`shadow-2xl` + `backdrop-blur-xl`): reserved exclusively for the CommandDeck overlay and theme toggle island.
- **Spotlight Glow** (`box-shadow: 0 0 80px -20px color-mix(in srgb, var(--color-tertiary) 55%, transparent)`): the agent's scene-focus flash when a section is spotlit.

### Named Rules

**The Flat-At-Rest Rule.** Content surfaces are flat at rest; if it has a blurred drop-shadow while idle, it's wrong. Elevation is earned by interaction (hover/focus) or by being a true overlay (console). If it looks like a 2014 Material card with a resting `box-shadow`, the shadow is dead weight — remove it and layer with the container ramp instead.

## 5. Components

Quiet, tactile content components; alive, instrument-grade console components.

### Buttons

- **Shape:** gently rounded (`8px`, `rounded-lg`).
- **Primary:** a subtle radial-gradient fill from Forest Container to Deep Forest (`radial-gradient(circle at top left, var(--color-primary-container), var(--color-primary))`), `text-slate-100`, `12px 24px` padding, label-weight tracking. Carries the CTA Lift shadow. Often paired with a leading mono `›` and an optional `⌘K`/`Ctrl K` `<kbd>`.
- **Hover / Focus:** lifts (`-translate-y-0.5`) and scales (`1.03`) with the shadow growing; `active:scale-0.985`. Some primary buttons add a magnetic pull (`use:magnetic`). Keyboard focus shows the global Operative-Forest ring.
- **Secondary / Text:** muted-ink link with `underline-offset-4`, transitions to Ink + underline on hover ("or get in touch →").

### Chips / Tags

- **Style:** `rounded-md` (`6px`), `1px` Outline-Variant border, Container background (often `color-mix(... 60%, transparent)`), Muted-Ink label, frequently a leading Operative-Forest `›`.
- **State:** hover shifts the border to Operative Forest and the text to Ink. Filter/active chips invert to a tinted accent fill. Used for starter commands, tech-stack tags, and project metadata.

### Cards / Containers

- **Corner Style:** generous (`16px`, `rounded-2xl`).
- **Background:** a Container-ramp step (typically `surface-container-high`, often softened with `color-mix`).
- **Shadow Strategy:** flat at rest (see Elevation). The hero "Currently" card adopts the **Hard Offset** on hover with a `-translate-y-1` lift.
- **Border:** `1px` Outline-Variant hairline.
- **Internal Padding:** `32px` (`p-8`) for content cards.

### Inputs / Fields

- **Style:** `rounded-lg`, `1px` Outline-Variant border, Container background, Ink text, `12px 16px` padding. Labels above in uppercase Label type.
- **Focus:** border shifts to Operative Forest plus a soft `ring-2` at `tertiary/30`. No glow, no bounce.
- **Error:** `aria-invalid` flips the border to red-500; the error message renders in red-500 below, wired via `aria-describedby` and an `aria-live` region.

### Navigation

- **Style:** fixed top bar, Field-Paper at `95%` opacity with `backdrop-blur-md`, closed by a **2px** Muted-Ink bottom rule (a deliberate heavier-than-hairline line, almanac-ledger feel).
- **Typography:** mono, `13px`, wide tracking — the system voice.
- **States:** default Muted Ink; hover → Ink; active/current → Ink. The logo is Playfair `sheohn` with an Operative-Forest `.dev`.
- **Mobile:** collapses to a disclosure panel sharing the same 2px-rule treatment; a live local-time readout sits at the foot.

### CommandDeck — the signature instrument (the AI agent)

The portfolio's bold moment. A floating console overlay: Instrument-Black at `95%` with `backdrop-blur-xl`, `rounded-xl`, framed by the green Console Line, floating on `shadow-2xl`. Everything inside is monospace Console Text. A **Signal-Green status dot pulses while the agent is thinking**; active starter/command items take a Signal-Green tint and left marker; links glow Signal Strong on hover. It is the one surface allowed to feel overtly alive — quiet content, alive instrument.

## 6. Do's and Don'ts

### Do:

- **Do** keep the two layers absolute: field-paper colors for content, `console-*` colors only inside the CommandDeck, Loader, and system indicators.
- **Do** use Operative Forest (`#2f5a3c` light / `#5fba82` dark) as the _only_ content accent, and Signal Green (`#4ade80`) as the _only_ console accent.
- **Do** reference `var(--color-*)` tokens from `global.css`. Never hardcode a hex.
- **Do** layer depth with the Container ramp; let shadows appear only on hover/focus or for true overlays.
- **Do** reserve monospace for the system voice (readout eyebrows, nav, console, decoder text, timestamps).
- **Do** keep the display masthead at or below 5rem and body measure at 65–75ch.
- **Do** ship a `prefers-reduced-motion: reduce` path for every animation (already enforced globally) — the site is motion-rich by design.
- **Do** hold WCAG 2.2 AA in both themes: body ≥4.5:1, large text ≥3:1, visible keyboard focus everywhere.

### Don't:

- **Don't** make this look like a **generic SaaS or template portfolio** — no interchangeable icon+heading+text card grid repeated endlessly, no "Next.js starter" feel.
- **Don't** let it read **cold or corporate / sterile** — the paper warmth, the almanac voice, and the green must always show through.
- **Don't** introduce a second accent hue, gradient text (`background-clip: text`), or decorative glassmorphism. Glass/backdrop-blur is reserved for the console and the toggle island.
- **Don't** mix the palettes — no Signal Green on paper content, no Field-Paper tints inside the console.
- **Don't** use `border-left`/`border-right` greater than 1px as a colored accent stripe. (The 2px nav rule is a full-width _bottom_ ledger line, not a side stripe.)
- **Don't** leave resting drop-shadows on content cards; if it looks like a 2014 Material card, delete the shadow and layer tonally instead.
- **Don't** use bounce or elastic easing. Motion eases out (`cubic-bezier(0.22, 1, 0.36, 1)`); nothing overshoots.
- **Don't** set body or paragraph copy in monospace — the instrument voice becomes costume.

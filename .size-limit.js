// size-limit config — see sonnet-specs/15-bundle-budget.md for the full spec.
//
// Budgets below were derived from ACTUAL measured gzip sizes of
// `dist/client/_astro/*.js` (produced by `astro build` + the @astrojs/vercel
// adapter's static-asset copy step — NOT a top-level `dist/_astro/`; that
// directory does not exist for this adapter/version, see the spec's report
// for the discrepancy against the originally assumed path), plus ~10%
// headroom, rounded up to a sensible unit. Measured against commit 0eace19
// on 2026-07-07. Chunk file names are content-hashed by Rollup, so each
// entry below globs on the stable name prefix Astro/Vite assigns before the
// hash (e.g. `CommandDeck.*.js` matches `CommandDeck.CiMVPOUp.js` today and
// will keep matching after the hash changes on a future build).
//
// Increasing a limit here should be a deliberate, reviewed decision (a real
// feature added weight) — not silent drift because CI got noisy. If a chunk
// genuinely needs to grow, remeasure and re-derive from real numbers again,
// don't just bump the number to make the failure go away.
//
// `gzip: true` is set explicitly on every entry: size-limit v12's `file`
// preset defaults to brotli-encoded size, not gzip, despite gzip having been
// the historical default — set explicitly here so budgets stay comparable
// build to build regardless of that default.
export default [
  // Svelte islands (client:load / client:idle / client:visible components)
  {
    name: 'CommandDeck',
    path: 'dist/client/_astro/CommandDeck.*.js',
    gzip: true,
    limit: '55 KB',
  },
  {
    name: 'HeaderNav',
    path: 'dist/client/_astro/HeaderNav.*.js',
    gzip: true,
    limit: '3 KB',
  },
  {
    name: 'HeroSection',
    path: 'dist/client/_astro/HeroSection.*.js',
    gzip: true,
    limit: '2.9 KB',
  },
  {
    name: 'ContactForm',
    path: 'dist/client/_astro/ContactForm.*.js',
    gzip: true,
    limit: '2.7 KB',
  },
  {
    name: 'WorkManifest',
    path: 'dist/client/_astro/WorkManifest.*.js',
    gzip: true,
    limit: '2.4 KB',
  },
  {
    name: 'PongGame',
    path: 'dist/client/_astro/PongGame.*.js',
    gzip: true,
    limit: '1.8 KB',
  },
  {
    name: 'Loader',
    path: 'dist/client/_astro/Loader.*.js',
    gzip: true,
    limit: '1.6 KB',
  },
  {
    name: 'Lightbox',
    path: 'dist/client/_astro/Lightbox.*.js',
    gzip: true,
    limit: '1.4 KB',
  },
  {
    name: 'PdfEmbed',
    path: 'dist/client/_astro/PdfEmbed.*.js',
    gzip: true,
    limit: '1.4 KB',
  },
  {
    name: 'TableOfContents',
    path: 'dist/client/_astro/TableOfContents.*.js',
    gzip: true,
    limit: '1.3 KB',
  },
  {
    name: 'ScenePilot',
    path: 'dist/client/_astro/ScenePilot.*.js',
    gzip: true,
    limit: '1.2 KB',
  },
  {
    name: 'ScrollProgress',
    path: 'dist/client/_astro/ScrollProgress.*.js',
    gzip: true,
    limit: '1.2 KB',
  },

  // Case-study content chunks (per-project MDX-derived data, code-split by
  // Astro/Vite because each project page dynamically imports its own).
  {
    name: 'case-study-crucible',
    path: 'dist/client/_astro/crucible.*.js',
    gzip: true,
    limit: '5 KB',
  },
  {
    name: 'case-study-animo',
    path: 'dist/client/_astro/animo.*.js',
    gzip: true,
    limit: '4.3 KB',
  },
  {
    name: 'case-study-lexicon',
    path: 'dist/client/_astro/lexicon.*.js',
    gzip: true,
    limit: '2.5 KB',
  },
  {
    name: 'personalInfo',
    path: 'dist/client/_astro/personalInfo.*.js',
    gzip: true,
    limit: '1.9 KB',
  },

  // Astro/Svelte framework internals split into their own chunks by Rollup.
  // `index.*.js` is a grouped budget: three distinct, unrelated internal
  // chunks all happen to share the generic `index` prefix (Rollup names an
  // anonymous/default-export chunk `index`) — see this spec's report for why
  // they're tracked as one combined bucket rather than three separate
  // (unnameable) entries.
  {
    name: 'svelte-runtime',
    path: 'dist/client/_astro/runtime.*.js',
    gzip: true,
    limit: '12 KB',
  },
  {
    name: 'astro-router',
    path: 'dist/client/_astro/router.*.js',
    gzip: true,
    limit: '4.7 KB',
  },
  {
    name: 'shared-vendor-index-chunks',
    path: 'dist/client/_astro/index.*.js',
    gzip: true,
    limit: '4.1 KB',
  },
  {
    name: 'astro-render',
    path: 'dist/client/_astro/render.*.js',
    gzip: true,
    limit: '2.7 KB',
  },
  {
    name: 'svelte-each-block',
    path: 'dist/client/_astro/each.*.js',
    gzip: true,
    limit: '2.3 KB',
  },
  {
    name: 'svelte-spring-store',
    path: 'dist/client/_astro/spring.*.js',
    gzip: true,
    limit: '1.2 KB',
  },

  // Aggregate safety net: every client JS chunk combined (including the many
  // small framework-internal chunks not individually budgeted above, e.g.
  // `each`, `branches`, `attributes`, `class`, `if`, `this`, `loop`, `page`,
  // `style`, `template`, `snippet`, `legacy`, `input`, `events`, `props`,
  // `store`, `client`, `client.svelte`, `index-client`, `disclose-version`,
  // `starters`). Catches death-by-a-thousand-cuts growth that no single
  // per-chunk budget would flag.
  {
    name: 'total-client-js',
    path: 'dist/client/_astro/*.js',
    gzip: true,
    limit: '129 KB',
  },
];

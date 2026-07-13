// Gzip budgets for dist/client/_astro/*.js: measured size + ~10% headroom.
// To grow a limit, remeasure — don't bump to silence CI. `gzip: true` is
// explicit because size-limit v12 defaults to brotli.
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
    limit: '4.3 KB',
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

  // Framework internals. `index.*.js` groups several unrelated chunks that
  // share Rollup's generic `index` prefix.
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

  // Aggregate safety net: all client JS combined, including chunks not
  // individually budgeted above.
  {
    name: 'total-client-js',
    path: 'dist/client/_astro/*.js',
    gzip: true,
    limit: '129 KB',
  },
];

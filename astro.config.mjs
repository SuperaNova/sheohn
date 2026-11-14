// @ts-check
import { defineConfig } from 'astro/config';

import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';

import vercel from '@astrojs/vercel';

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://sheohn.dev',
  output: 'static',
  prefetch: {
    defaultStrategy: 'hover',
    prefetchAll: true,
  },
  integrations: [svelte(), mdx(), sitemap()],

  vite: {
    plugins: [tailwindcss()],
    build: {
      // Bundled scripts stay external so the CSP hashes cover only source-controlled inline scripts.
      assetsInlineLimit: (filePath) =>
        filePath.endsWith('.js') ? false : undefined,
    },
  },

  adapter: vercel({
    imageService: true,
  }),
});

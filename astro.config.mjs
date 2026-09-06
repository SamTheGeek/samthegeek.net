// @ts-check
import { defineConfig } from 'astro/config';

import netlify from '@astrojs/netlify';

// https://astro.build/config
export default defineConfig({
  site: 'https://samthegeek.net',

  vite: {
    build: {
      // Vite 8 defaults to `baseline-widely-available` (safari16), whose CSS
      // minifier emits Media Queries Level 4 range syntax — `@media (width<=768px)`.
      // That syntax needs Safari 16.4+, so on Safari 16.0-16.3 the responsive
      // breakpoints are dropped and the 900px-min-width desktop layout sticks on
      // phones. Pin the target to keep the pre-Astro-7 `max-width` output.
      cssTarget: ['chrome87', 'edge88', 'firefox78', 'safari14'],
      rollupOptions: {
        // @netlify/blobs is a Netlify platform package unavailable at bundle time;
        // mark external so the Edge runtime resolves it natively.
        external: ['@netlify/blobs'],
      },
    },
  },

  adapter: netlify(),
});
// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://samthegeek.net',
  vite: {
    build: {
      rollupOptions: {
        // @netlify/blobs is a Netlify platform package unavailable at bundle time;
        // mark external so the Edge runtime resolves it natively.
        external: ['@netlify/blobs'],
      },
    },
  },
});

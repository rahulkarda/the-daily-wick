// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://rahulkarda.github.io',
  base: '/the-daily-wick',
  output: 'static',
  trailingSlash: 'never',
  build: {
    format: 'directory',
  },
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !page.includes('/draft/'),
    }),
  ],
  markdown: {
    shikiConfig: {
      theme: 'rose-pine-dawn',
      wrap: true,
    },
  },
  image: {
    service: { entrypoint: 'astro/assets/services/sharp' },
  },
  vite: {
    optimizeDeps: { exclude: ['@pagefind/default-ui'] },
  },
});

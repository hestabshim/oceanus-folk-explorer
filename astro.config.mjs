// @ts-check
import { defineConfig } from 'astro/config';
import { writeFile } from 'node:fs/promises';

import tailwind from '@astrojs/tailwind';

// Dev-only endpoint: the feedback panel POSTs its Markdown here to save feedback.md at the repo root.
/** @type {import('vite').Plugin} */
const feedbackFile = {
  name: 'feedback-file',
  configureServer(server) {
    server.middlewares.use('/__feedback', (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        await writeFile(new URL('./feedback.md', import.meta.url), body);
        res.end('ok');
      });
    });
  }
};

// https://astro.build/config
export default defineConfig({
  site: 'https://hestabshim.github.io',
  base: '/oceanus-folk-explorer',
  integrations: [tailwind()],
  vite: { plugins: [feedbackFile] }
});

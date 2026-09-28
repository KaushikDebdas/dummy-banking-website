import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

declare const process: { env: Record<string, string | undefined> };

// BASE_PATH is set when building for GitHub Pages: the repository name, e.g. "Dummy-banking-website"
// (slashes optional). Local development and `npm run build` use the site root.
const repo = (process.env.BASE_PATH ?? '').trim().replace(/^\/+|\/+$/g, '');

export default defineConfig({
  base: repo ? `/${repo}/` : '/',
  plugins: [react(), tailwindcss()],
  build: { chunkSizeWarningLimit: 1000 },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});

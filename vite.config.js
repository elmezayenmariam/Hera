import { defineConfig } from 'vite';

// Minimal config: HERA is a static single-page app with no framework and no
// backend. base:'./' keeps built asset paths relative, so the production
// build in dist/ can also be opened directly or hosted from any subpath
// later without extra config changes.
export default defineConfig({
  base: './',
  server: {
    port: 5173,
    open: true
  },
  build: {
    outDir: 'dist'
  }
});

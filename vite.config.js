import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// HERA is a vanilla-JS single-page app. The one exception is the animated
// feature carousel on the landing, which is a self-contained React island
// (React + framer-motion) mounted into a single DOM node by featureCarousel.jsx.
// @vitejs/plugin-react transpiles the .jsx/.tsx for that island; the rest of the
// app stays plain JS with innerHTML strings. base:'./' keeps asset paths relative.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    open: true
  },
  build: {
    outDir: 'dist'
  }
});

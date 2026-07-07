/** @type {import('tailwindcss').Config} */
// Scoped to the React feature-carousel island only. Two deliberate safety
// choices so Tailwind cannot disturb the hand-written editorial CSS that styles
// the rest of the app:
//   preflight:false  → no global base reset (Tailwind adds only the utility
//                       classes actually used, never resets existing elements)
//   darkMode:'class' → dark: variants apply only under a .dark ancestor (there
//                       is none), so the carousel stays light like the app,
//                       regardless of the viewer's OS colour scheme.
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  corePlugins: { preflight: false },
  theme: { extend: {} },
  plugins: []
};

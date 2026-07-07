// React "island" bridge: mounts the framer-motion FeatureCarousel into a single
// DOM node owned by the otherwise-vanilla app. app.js calls mount/unmount from
// render() — mount on the landing (step 0), unmount everywhere else. Verified
// Unsplash photo URLs (HTTP 200), themed to HERA's four assessment steps.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { FeatureCarousel } from './components/ui/animated-feature-carousel.tsx';

const U = (id) => `https://images.unsplash.com/photo-${id}?q=80&w=1200&auto=format&fit=crop`;
const IMAGES = {
  alt: 'HERA heritage assessment',
  step1img1: U('1512453979798-5ea266f8880c'),  // ESS — hot-arid cityscape / climate load
  step1img2: U('1518709268805-4e9042af9f23'),  // ESS — heat / solar
  step2img1: U('1572252009286-268acec5ca0a'),  // BCS — cracked / weathered wall
  step2img2: U('1600585154340-be6161a56a0c'),  // BCS — historic interior fabric
  step3img:  U('1470229722913-7c0e2dbbafd3'),  // OIS — visitors / occupancy
  step4img:  U('1548013146-72479768bada'),     // HRI — heritage landmark / dome
};

let _root = null;
export function mountFeatureCarousel(){
  const el = document.getElementById('featureCarousel');
  if(!el) return;
  unmountFeatureCarousel();               // fresh root each mount (node is recreated on every render)
  _root = createRoot(el);
  _root.render(React.createElement(FeatureCarousel, { image: IMAGES }));
}
export function unmountFeatureCarousel(){
  if(_root){ try{ _root.unmount(); }catch(e){} _root = null; }
}

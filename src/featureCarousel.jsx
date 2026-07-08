// React "island" bridge: mounts the framer-motion FeatureCarousel into a single
// DOM node owned by the otherwise-vanilla app. app.js calls mount/unmount from
// render(): mount when the workflow modal opens, unmount otherwise. Images are the
// thesis reference photos (imported so Vite bundles/hashes them and the paths work
// under base:'./'), two per assessment step.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { FeatureCarousel } from './components/ui/animated-feature-carousel.tsx';

import ess1 from './assets/workflow/ess-1.jpg';
import ess2 from './assets/workflow/ess-2.jpg';
import bcs1 from './assets/workflow/bcs-1.jpg';
import bcs2 from './assets/workflow/bcs-2.jpg';
import ois1 from './assets/workflow/ois-1.jpg';
import ois2 from './assets/workflow/ois-2.webp';
import hri1 from './assets/workflow/hri-1.jpg';
import hri2 from './assets/workflow/hri-2.jpg';

const IMAGES = {
  alt: 'HERA heritage assessment',
  step1img1: ess1, step1img2: ess2,   // ESS, environmental stress
  step2img1: bcs1, step2img2: bcs2,   // BCS, building condition
  step3img1: ois1, step3img2: ois2,   // OIS, occupancy impact
  step4img1: hri1, step4img2: hri2,   // HRI, future risk index
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

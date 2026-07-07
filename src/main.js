// Entry point. Vite bundles this as an ES module.
// The rest of the app (app.js) still builds its UI as innerHTML strings with
// inline onclick/oninput/onchange attributes — exactly as the original
// single-file prototype did. Inline handlers are resolved against `window`,
// not module scope, so every function/name referenced from an inline handler
// in the generated HTML has to be attached to window here. This is the only
// change needed to make the existing markup-generation code work unmodified
// inside a module bundler.
import './style.css';
import {
  state, render, go, toggleCompare, newAssessment, saveCurrentProject, loadProject, removeProject,
  geoSearch, geoFetchEnvironment, selectGeoResult, openCapModal, closeCapModal, copyPrompt, retryImages,
  eraFromYear
} from './app.js';

window.state = state;
window.render = render;
window.go = go;
window.toggleCompare = toggleCompare;
window.newAssessment = newAssessment;
window.saveCurrentProject = saveCurrentProject;
window.loadProject = loadProject;
window.removeProject = removeProject;
window.geoSearch = geoSearch;
window.geoFetchEnvironment = geoFetchEnvironment;
window.selectGeoResult = selectGeoResult;
window.openCapModal = openCapModal;
window.closeCapModal = closeCapModal;
window.copyPrompt = copyPrompt;
window.retryImages = retryImages;
window.eraFromYear = eraFromYear;

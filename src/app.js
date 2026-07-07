/* ==========================================================================
   HERA — main application module.
   This file intentionally keeps state, geo, strategy, action-plan, image
   retrieval, Conservation Action Plan rendering, and the page router together
   in one module. These pieces call each other (and call render()) constantly
   — including from async callbacks — which means splitting them into more
   ES modules would require several circular imports. Circular ES module
   imports *are* supported by the spec as long as the imported binding is only
   used inside a function body (never at top-level module-evaluation time),
   which is true almost everywhere in this codebase — but the one exception,
   loadImageCache() being invoked at the bottom of this very file during
   startup, is exactly the kind of ordering subtlety that is easy to get
   wrong when refactoring by hand. Keeping this cluster in one file removes
   that risk entirely while still getting the separated, testable modules
   below (formulas, network, knowledgeBase, climate) out of the monolith.
   ========================================================================== */
import { classify, bandColor, BANDS_GENERIC, BANDS_BCS, HRI_TABLE, computeESS, computeBCS, computeOIS, computeHRI } from './data/formulas.js';
import { isOnline, fetchJSON } from './data/network.js';
import { KNOWLEDGE_BASE, retrieveKnowledge, buildQueryTags } from './data/knowledgeBase.js';
import { SSP, BCS_ACCELERATION_K, projectScenario } from './data/climate.js';

/* ============================== ICONS ==============================
   Inline stroke SVGs (Lucide-style, currentColor) used everywhere the UI
   previously relied on emoji. Purely presentational — icon() just returns a
   markup string that inherits the surrounding text colour and can be sized
   via CSS. Never affects logic. */
const ICONS = {
  landmark:'<path d="M3 21h18M4 21V10l8-6 8 6v11M9 21v-7h6v7"/>',
  home:'<path d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5"/>',
  building:'<path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M4 21h14M8 7h2M8 11h2M8 15h2M12 7h2M12 11h2M12 15h2M18 21V11h2v10"/>',
  thermometer:'<path d="M14 14.76V4a2 2 0 0 0-4 0v10.76a4 4 0 1 0 4 0Z"/>',
  layers:'<path d="M12 3 2 8l10 5 10-5-10-5ZM2 13l10 5 10-5M2 18l10 5 10-5"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  gauge:'<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12 9V5M4.9 19a10 10 0 1 1 14.2 0"/>',
  climate:'<path d="M17 18a5 5 0 0 0-10 0M12 2v2M4.2 10.2l1.4 1.4M2 18h2M20 18h2M18.4 11.6l1.4-1.4M22 2 2 22"/>',
  clipboard:'<path d="M9 3h6a1 1 0 0 1 1 1v1h1a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1V4a1 1 0 0 1 1-1ZM9 5h6M8 11h8M8 15h6"/>',
  scale:'<path d="M12 3v18M7 7l-4 7a4 4 0 0 0 8 0L7 7ZM17 7l-4 7a4 4 0 0 0 8 0l-4-7ZM5 7h14"/>',
  compare:'<path d="M3 21h18M7 21V11M12 21V5M17 21V14"/>',
  search:'<path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3"/>',
  download:'<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  pin:'<path d="M12 21s7-6.5 7-11a7 7 0 1 0-14 0c0 4.5 7 11 7 11ZM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/>',
  save:'<path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM8 3v5h7M8 21v-6h8v6"/>',
  refresh:'<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  close:'<path d="M18 6 6 18M6 6l12 12"/>',
  arrowRight:'<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowLeft:'<path d="M19 12H5M11 18l-6-6 6-6"/>',
  globe:'<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z"/>',
  book:'<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5ZM19 19H6a2 2 0 0 0-2 2"/>',
  image:'<path d="M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM21 16l-5-5-9 9"/>',
  alert:'<path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>',
  spark:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>',
  wifi:'<path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01"/>',
  wifiOff:'<path d="M2 2l20 20M8.5 16a5 5 0 0 1 6-.8M5 12.5a10 10 0 0 1 4-2.4M19 12.5a10 10 0 0 0-4.5-2.6"/>',
  copy:'<path d="M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1ZM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  offline:'<path d="M2 2l20 20M8.5 16a5 5 0 0 1 6-.8M5 12.5a10 10 0 0 1 4-2.4M19 12.5a10 10 0 0 0-4.5-2.6"/>'
};
function icon(name, size){
  const p = ICONS[name] || '';
  const s = size || 18;
  return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}
const STEP_ICONS = ['home','building','thermometer','layers','users','gauge','climate','clipboard'];

/* Cairo monthly mean daytime solar radiation (W/m²), Jan→Dec — derived from the
   Cairo solar-radiation climatology published at en.tutiempo.net/solar-radiation/cairo.html.
   Used as the sensible default / offline fallback for the Solar Radiation indicator,
   so the field never starts at an implausible 0 (e.g. when live data is fetched at night). */
const CAIRO_SOLAR_WM2 = [265,320,395,450,480,505,495,470,425,355,290,250];
const SOLAR_SOURCE_NOTE = 'Default from Cairo monthly solar climatology — en.tutiempo.net/solar-radiation/cairo.html';
function cairoSolarDefault(){ return CAIRO_SOLAR_WM2[new Date().getMonth()]; }

/* ============================== GEO-ENVIRONMENTAL MODULE ==============================
   Eliminates manual ESS entry where possible: the user searches for a building or
   clicks a point on the map, and HERA auto-retrieves current environmental readings
   from free, no-API-key public services, pre-filling the ESS inputs (which remain
   fully editable/overridable). Future SSP projections then run automatically off of
   whatever baseline ends up in state.ess — no separate "future" fetch is needed.

   GEO_PROVIDERS is intentionally a flat, swappable config: to add a new dataset
   (e.g. a real Urban Heat Island raster, a local air-quality station network, or a
   national heritage-building elevation registry), add one entry here with a `url()`
   builder and a matching read-out in geoFetchEnvironment() — nothing else in the
   module needs to change. */
const GEO_PROVIDERS = {
  geocode:   {name:'OpenStreetMap Nominatim', url:(q)=>`https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1&q=${encodeURIComponent(q)}`},
  reverse:   {name:'OpenStreetMap Nominatim (reverse)', url:(lat,lng)=>`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=17&addressdetails=1`},
  weather:   {name:'Open-Meteo Forecast',     url:(lat,lng)=>`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m&hourly=shortwave_radiation&forecast_days=1&timezone=auto`},
  elevation: {name:'Open-Meteo Elevation',    url:(lat,lng)=>`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`},
  airQuality:{name:'Open-Meteo Air Quality',  url:(lat,lng)=>`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=us_aqi,pm2_5`},
  // Not yet integrated — no reliable free/open API at building-scale resolution today.
  // Placeholder kept so a future raster/dataset (e.g. Landsat-derived LST anomaly) can
  // be wired in without restructuring the rest of the module.
  uhi:       {name:'Urban Heat Island intensity (not yet integrated)', url:null}
};

let geoMapInstance = null, geoMarkerInstance = null;
let geoSearchController = null;   // cancels a stale search if a newer one is fired
let geoSearchRequestId = 0;       // belt-and-braces guard against out-of-order responses
let geoReverseController = null;

function destroyGeoMap(){
  if(geoMapInstance){ try{ geoMapInstance.remove(); }catch(e){} geoMapInstance=null; geoMarkerInstance=null; }
}

function mountGeoMap(){
  const el = document.getElementById('geoMap');
  if(!el || typeof L === 'undefined') return;
  destroyGeoMap();
  const startLat = state.geo.lat!=null ? state.geo.lat : 30.0444; // default view: Cairo
  const startLng = state.geo.lng!=null ? state.geo.lng : 31.2357;
  geoMapInstance = L.map(el).setView([startLat, startLng], state.geo.lat!=null ? 15 : 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom:19, attribution:'&copy; OpenStreetMap contributors'
  }).addTo(geoMapInstance);
  if(state.geo.lat!=null){ geoMarkerInstance = L.marker([state.geo.lat, state.geo.lng]).addTo(geoMapInstance); }
  geoMapInstance.on('click', function(e){
    state.geo.lat = Math.round(e.latlng.lat*10000)/10000;
    state.geo.lng = Math.round(e.latlng.lng*10000)/10000;
    state.geo.placeLabel = null;
    state.geo.results = [];
    if(geoMarkerInstance){ geoMarkerInstance.setLatLng(e.latlng); } else { geoMarkerInstance = L.marker(e.latlng).addTo(geoMapInstance); }
    reverseGeocode(state.geo.lat, state.geo.lng); // fire-and-forget; updates label + re-renders when done
    const txt = document.getElementById('geoSelectedText');
    if(txt) txt.innerHTML = `<b>${state.geo.lat}, ${state.geo.lng}</b> — resolving place name… — click "Fetch Environmental Data" to populate ESS below.`;
    const btn = document.getElementById('geoFetchBtn');
    if(btn) btn.disabled = false;
  });
  setTimeout(()=>{ if(geoMapInstance) geoMapInstance.invalidateSize(); }, 150);
}

/* Reverse geocoding: turns a clicked lat/lng into a human-readable place name.
   Fire-and-forget from the map click handler — doesn't block coordinate
   selection, just enriches the display once it resolves. */
async function reverseGeocode(lat, lng){
  if(geoReverseController) geoReverseController.abort();
  geoReverseController = new AbortController();
  state.geo.reverseLoading = true;
  render();
  try{
    const data = await fetchJSON(GEO_PROVIDERS.reverse.url(lat,lng), {signal: geoReverseController.signal, timeoutMs:7000});
    state.geo.placeLabel = data && data.display_name ? data.display_name : null;
  }catch(err){
    if(err.name !== 'AbortError'){ state.geo.placeLabel = null; }
  }
  state.geo.reverseLoading = false;
  render();
}

async function geoSearch(){
  const input = document.getElementById('geoQueryInput');
  const q = input ? input.value.trim() : '';
  if(!q) return;

  // Cancel any in-flight search so a slow earlier request can never overwrite
  // the results of a newer one (the original race-condition bug).
  if(geoSearchController) geoSearchController.abort();
  geoSearchController = new AbortController();
  const myRequestId = ++geoSearchRequestId;

  state.geo.searching = true; state.geo.error = null; state.geo.results = [];
  render();

  if(!isOnline()){
    state.geo.searching = false;
    state.geo.error = 'You appear to be offline — connect to the internet to search, or click directly on the map.';
    render();
    return;
  }

  try{
    const data = await fetchJSON(GEO_PROVIDERS.geocode.url(q), {signal: geoSearchController.signal, timeoutMs:8000});
    if(myRequestId !== geoSearchRequestId) return; // a newer search superseded this one
    state.geo.results = (data||[]).map(d=>({label:d.display_name, lat:parseFloat(d.lat), lng:parseFloat(d.lon)}));
    if(!state.geo.results.length) state.geo.error = 'No matches found — try a broader search term, or click directly on the map.';
  }catch(err){
    if(myRequestId !== geoSearchRequestId) return;
    if(err.message === 'offline') state.geo.error = 'You appear to be offline — connect to the internet to search, or click directly on the map.';
    else if(err.message === 'timeout') state.geo.error = 'Search timed out — the geocoding service may be slow or unreachable. Try again, or click directly on the map.';
    else if(err.name === 'AbortError') return; // superseded, not a real error
    else state.geo.error = 'Search request failed (network/CORS) — click directly on the map instead.';
  }
  if(myRequestId === geoSearchRequestId){ state.geo.searching = false; render(); }
}

function selectGeoResult(lat, lng, label){
  state.geo.lat = lat; state.geo.lng = lng; state.geo.results = [];
  state.geo.placeLabel = label || null;
  render();
}

/* ---------- Live autocomplete (search-engine-style suggestions) ----------
   Fires as the user types (debounced), and updates ONLY the results box in the
   DOM — never a full render() — so the input keeps focus while typing. */
let geoTypeTimer = null;
function geoResultsBoxHTML(list){
  return (list||[]).map(r=>`<div class="geo-result" onclick='selectGeoResult(${r.lat},${r.lng},${JSON.stringify(r.label)})'>${icon('pin',12)} ${r.label}</div>`).join('');
}
function updateGeoResultsBox(){
  const el = document.getElementById('geoResultsBox');
  if(!el) return;
  el.innerHTML = geoResultsBoxHTML(state.geo.results);
  el.style.display = state.geo.results.length ? 'block' : 'none';
}
function geoType(v){
  clearTimeout(geoTypeTimer);
  const q = (v||'').trim();
  if(q.length < 3){ state.geo.results = []; updateGeoResultsBox(); return; }
  geoTypeTimer = setTimeout(()=>geoSuggest(q), 350);
}
async function geoSuggest(q){
  if(!isOnline()) return;
  if(geoSearchController) geoSearchController.abort();
  geoSearchController = new AbortController();
  const myRequestId = ++geoSearchRequestId;
  try{
    const data = await fetchJSON(GEO_PROVIDERS.geocode.url(q), {signal: geoSearchController.signal, timeoutMs:8000});
    if(myRequestId !== geoSearchRequestId) return;
    state.geo.results = (data||[]).map(d=>({label:d.display_name, lat:parseFloat(d.lat), lng:parseFloat(d.lon)}));
    updateGeoResultsBox();
  }catch(err){ /* stale/aborted/failed suggestion — silently ignore, typing continues */ }
}

async function geoFetchEnvironment(){
  if(state.geo.lat==null) return;
  state.geo.fetching = true; state.geo.error = null;
  render();

  if(!isOnline()){
    state.geo.fetching = false;
    state.geo.error = 'You appear to be offline — enter ESS values manually below, or reconnect and try again.';
    render();
    return;
  }

  const {lat, lng} = state.geo;
  try{
    const [wx, elev, aq] = await Promise.allSettled([
      fetchJSON(GEO_PROVIDERS.weather.url(lat,lng), {timeoutMs:9000}),
      fetchJSON(GEO_PROVIDERS.elevation.url(lat,lng), {timeoutMs:9000}),
      fetchJSON(GEO_PROVIDERS.airQuality.url(lat,lng), {timeoutMs:9000})
    ]);

    if(wx.status==='fulfilled'){
      const cur = wx.value.current || {};
      if(typeof cur.temperature_2m === 'number') state.ess.temp = Math.round(cur.temperature_2m*10)/10;
      if(typeof cur.relative_humidity_2m === 'number') state.ess.rh = Math.round(cur.relative_humidity_2m);
      // Use the DAYTIME MEAN of the hourly shortwave series rather than the instant
      // value at fetch time — fetching at night would otherwise auto-fill 0 W/m².
      // If the whole series is zero/unavailable, fall back to the Cairo monthly
      // climatology (en.tutiempo.net/solar-radiation/cairo.html).
      const hourly = wx.value.hourly;
      let sw = null;
      if(hourly && Array.isArray(hourly.shortwave_radiation)){
        const day = hourly.shortwave_radiation.filter(v=>typeof v==='number' && v>0);
        if(day.length) sw = day.reduce((a,b)=>a+b,0)/day.length;
      }
      state.ess.solar = Math.round(sw!=null ? sw : cairoSolarDefault());
    }
    state.geo.elevation = (elev.status==='fulfilled' && Array.isArray(elev.value.elevation)) ? elev.value.elevation[0] : null;
    state.geo.airQuality = (aq.status==='fulfilled' && aq.value.current) ? aq.value.current : null;
    state.geo.fetched = new Date().toLocaleString();
    if(wx.status!=='fulfilled'){
      const reason = wx.reason && wx.reason.message==='timeout' ? ' (request timed out)' : '';
      state.geo.error = 'Weather service unavailable'+reason+' — enter ESS values manually below.';
    }
  }catch(err){
    state.geo.error = 'Could not retrieve environmental data — enter values manually below.';
  }
  state.geo.fetching = false;
  render();
}

function geoPanel(){
  const g = state.geo;
  return `<div class="indicator-block" style="margin-bottom:20px;">
    <div class="ihead"><span class="iname">${icon('pin',16)} Auto-Retrieve Environmental Data</span></div>
    <div class="sub" style="margin-bottom:10px;">Search for the building or click a point on the map — HERA fetches live conditions and pre-fills the indicators below. Every value stays editable.</div>

    <div class="geo-searchrow">
      <input id="geoQueryInput" type="text" placeholder="e.g. Baron Empain Palace, Heliopolis, Cairo" autocomplete="off"
        oninput="geoType(this.value)" onkeydown="if(event.key==='Enter'){geoSearch();}">
      <button class="primary" style="white-space:nowrap;" onclick="geoSearch()" ${g.searching?'disabled':''}>${g.searching ? 'Searching…' : `${icon('search',16)} Search`}</button>
    </div>

    <div id="geoResultsBox" class="geo-results" style="display:${g.results.length?'block':'none'};">${geoResultsBoxHTML(g.results)}</div>

    <div id="geoMap"></div>
    <div id="geoSelectedText" style="font-size:12.5px;color:var(--muted);margin-bottom:12px;">
      ${g.lat!=null
        ? `Selected: <b>${g.lat}, ${g.lng}</b>${g.reverseLoading ? ' — resolving place name…' : (g.placeLabel ? `<br><span style="color:var(--text);">${g.placeLabel}</span>` : '')}`
        : 'No location selected yet — search above or click the map.'}
    </div>

    <button id="geoFetchBtn" class="primary" ${g.lat==null?'disabled':''} onclick="geoFetchEnvironment()">${g.fetching ? 'Fetching…' : `${icon('download',16)} Fetch Environmental Data`}</button>

    ${g.error ? `<div class="note" style="margin-top:12px;">${g.error}</div>` : ''}

    ${g.fetched ? `
      <div class="geo-chip-row">
        <span class="geo-chip">Fetched <b>${g.fetched}</b></span>
        <span class="geo-chip">Elevation: <b>${g.elevation!=null ? g.elevation+' m' : '— unavailable'}</b></span>
        <span class="geo-chip">Air Quality (US AQI): <b>${g.airQuality && typeof g.airQuality.us_aqi==='number' ? g.airQuality.us_aqi : '— unavailable'}</b></span>
        <span class="geo-chip">Urban Heat Island: <b>not yet integrated</b></span>
      </div>
      <div class="sub" style="margin-top:10px;">Temperature, humidity and solar radiation below have been auto-filled from Open-Meteo. Future SSP2-4.5 / SSP5-8.5 projections (Climate Scenarios step) apply their deltas on top of this baseline automatically.</div>
    ` : ''}

    <div style="font-size:11px;color:var(--muted);margin-top:12px;">Live data via Open-Meteo (open-meteo.com) and OpenStreetMap Nominatim — both free, no API key required. Map tiles © OpenStreetMap contributors.</div>
  </div>`;
}

/* Climate Scenario Engine itself (SSP table, BCS_ACCELERATION_K, projectScenario)
   now lives in ./data/climate.js and is imported at the top of this file — see
   that file for the full methodology note. */
const STRATEGY_MATRIX = {
'Routine Monitoring|ESS':'Periodic environmental monitoring, temperature and humidity tracking, and routine inspections.',
'Routine Monitoring|BCS':'Scheduled condition surveys and photographic documentation of existing defects.',
'Routine Monitoring|OIS':'Monitoring visitor numbers and occupancy patterns to detect changes in use intensity.',
'Scheduled Maintenance|ESS':'Improve environmental management through shading, ventilation optimization, and moisture control measures.',
'Scheduled Maintenance|BCS':'Minor repairs, cleaning, biological growth removal, repointing, and preventive maintenance works.',
'Scheduled Maintenance|OIS':'Visitor flow management and maintenance scheduling during low-occupancy periods.',
'Preventive Conservation|ESS':'Strengthen environmental controls, improve drainage systems, install passive climate adaptation measures, and increase monitoring frequency.',
'Preventive Conservation|BCS':'Address early-stage material decay, repair localized cracks, stabilize vulnerable elements, and implement preventive conservation treatments.',
'Preventive Conservation|OIS':'Introduce occupancy limits, regulate visitor circulation routes, and reduce operational pressures on sensitive spaces.',
'Preventive Conservation|ESS+BCS':'Combine climate adaptation measures with targeted conservation interventions to reduce future deterioration risks.',
'Conservation Upgrade|ESS':'Implement climate adaptation measures such as solar protection systems, environmental buffering, moisture management strategies, and enhanced monitoring systems.',
'Conservation Upgrade|BCS':'Material consolidation, crack repair, surface conservation, replacement of incompatible repair materials, and restoration of deteriorated building elements.',
'Conservation Upgrade|OIS':'Occupancy control measures, visitor capacity restrictions, operational management plans, and event scheduling controls.',
'Conservation Upgrade|ESS+BCS':'Integrated climate adaptation and conservation programme including environmental mitigation and building repair works.',
'Conservation Upgrade|BCS+OIS':'Comprehensive conservation works combined with adaptive reuse management strategies and occupancy controls.',
'Immediate Intervention|ESS':'Emergency climate adaptation measures to protect vulnerable building elements from severe environmental stress.',
'Immediate Intervention|BCS':'Emergency stabilization, structural protection measures, urgent repair works, and protection of highly deteriorated fabric.',
'Immediate Intervention|OIS':'Immediate occupancy restrictions, closure of vulnerable areas, and emergency visitor management protocols.',
'Immediate Intervention|ESS+BCS':'Emergency conservation programme addressing both severe environmental stress and advanced material deterioration.',
'Immediate Intervention|ESS+BCS+OIS':'Comprehensive emergency intervention combining climate adaptation, conservation works, structural protection measures, and occupancy restrictions.'
};

function dominantDrivers(ess,bcs,ois){
  const vals = {ESS:ess, BCS:bcs, OIS:ois};
  const max = Math.max(ess,bcs,ois);
  let drivers = Object.keys(vals).filter(k => vals[k] >= max - 8 && vals[k] >= 41);
  if(drivers.length===0) drivers = [Object.keys(vals).reduce((a,b)=>vals[a]>vals[b]?a:b)];
  const order = {ESS:0,BCS:1,OIS:2};
  drivers.sort((a,b)=>order[a]-order[b]);
  return drivers;
}
function getStrategy(category, drivers){
  const key = category + '|' + drivers.join('+');
  if(STRATEGY_MATRIX[key]) return {key, text:STRATEGY_MATRIX[key]};
  // fallback: combine individual strategies
  const texts = drivers.map(d => STRATEGY_MATRIX[category+'|'+d]).filter(Boolean);
  return {key:category+'|'+drivers.join('+')+' (combined)', text: texts.join(' ')};
}

function getCategoryLabel(catScoreKey, val){
  // helper to find original category label from score for display
  return val;
}

function assembleAssessment(scenarioKey){
  const essR = computeESS(state.ess), bcsR = computeBCS(state.bcs), oisR = computeOIS(state.ois);
  const hriCurrent = computeHRI(essR.score, bcsR.score, oisR.score);
  let ess=essR.score, bcs=bcsR.score, ois=oisR.score, hri=hriCurrent, scenarioLabel='Current Conditions', dT=0;
  if(scenarioKey!=='current'){
    const proj = projectScenario(state.ess, essR, bcsR.score, scenarioKey);
    ess = proj.ess; bcs = proj.bcs; ois = oisR.score;
    hri = computeHRI(ess, bcs, ois);
    scenarioLabel = SSP[scenarioKey].label;
    dT = SSP[scenarioKey].dT;
  }
  const hriCls = classify(hri, HRI_TABLE);
  const essCls = classify(ess, BANDS_GENERIC);
  const bcsCls = classify(bcs, BANDS_BCS);
  const oisCls = classify(ois, BANDS_GENERIC);
  const drivers = dominantDrivers(ess, bcs, ois);
  const strat = getStrategy(hriCls.priority, drivers);
  const b = state.building;
  const bi = state.bcs, oi = state.ois;
  const queryTags = buildQueryTags(ess, bcs, ois, drivers, bi, b, state.ess);
  const retrieved = retrieveKnowledge(queryTags, 8);
  return {essR,bcsR,oisR,ess,bcs,ois,hri,scenarioLabel,dT,hriCls,essCls,bcsCls,oisCls,drivers,strat,b,bi,oi,queryTags,retrieved,scenarioKey};
}

function buildPrompt(scenarioKey, mode){
  mode = mode || 'hera';
  const a = assembleAssessment(scenarioKey);
  const {essR,bcsR,oisR,ess,bcs,ois,hri,scenarioLabel,dT,hriCls,essCls,bcsCls,oisCls,drivers,strat,b,bi,oi} = a;
  const retrievedTop = a.retrieved.slice(0,6);
  const retrievedBlock = retrievedTop.length ? retrievedTop.map((c,i)=>`[${i+1}] (${c.source}) ${c.text}`).join('\n\n') : '(no matching reference chunks found in local knowledge base)';

  const caseStudyBlock = `=== CASE STUDY ===
Building: ${b.name}
Location: ${b.location}
Building category: ${b.category||'—'}
Construction year: ${b.year||'—'}
Construction era: ${b.era}
Construction material: ${b.material||'—'}
Current use: ${b.use}
Current occupancy: ${b.occupancy||'—'}
Typology: Late Khedival/Colonial-era load-bearing masonry construction (1880-1940) — limestone ashlar, lime mortars, terracotta ornament.

=== CLIMATE SCENARIO EVALUATED ===
Scenario: ${scenarioLabel}${scenarioKey!=='current' ? ` (IPCC AR6 projected temperature increase: +${dT}\u00b0C by 2100)` : ' (present-day baseline)'}

=== HERITAGE RISK ASSESSMENT RESULTS ===
Environmental Stress Score (ESS): ${ess.toFixed(1)}/100 — ${essCls.label} (Hazard)
  - Temperature indicator: input ${state.ess.temp}\u00b0C, score ${essR.parts.Temperature.toFixed(1)}
  - Relative Humidity indicator: input ${state.ess.rh}%, score ${essR.parts.Humidity.toFixed(1)}
  - Solar Radiation indicator: input ${state.ess.solar} W/m\u00b2, score ${essR.parts.Solar.toFixed(1)}

Building Condition Score (BCS): ${bcs.toFixed(1)}/100 — ${bcsCls.label} (Vulnerability)
  - Material Decay: ${bi.materialDecay}, score ${bcsR.parts.MaterialDecay.toFixed(1)} (weight 40%)
  - Cracking: ${bi.crack} mm, score ${bcsR.parts.Cracking.toFixed(1)} (weight 30%)
  - Surface Loss: ${bi.surfaceLoss}%, score ${bcsR.parts.SurfaceLoss.toFixed(1)} (weight 20%)
  - Biological Growth: ${bi.bioGrowth}, score ${bcsR.parts.BiologicalGrowth.toFixed(1)} (weight 10%)

Occupancy Impact Score (OIS): ${ois.toFixed(1)}/100 — ${oisCls.label} (Exposure)
  - Occupancy Density: ${oi.density} persons/m\u00b2, score ${oisR.parts.OccupancyDensity.toFixed(1)}
  - Visitor Load: ${oi.visitorLoad}, score ${oisR.parts.VisitorLoad.toFixed(1)}
  - Event Frequency: ${oi.eventFreq}, score ${oisR.parts.EventFrequency.toFixed(1)}

Heritage Risk Index (HRI) = 0.40\u00d7ESS + 0.40\u00d7BCS + 0.20\u00d7OIS = ${hri.toFixed(1)}/100
Risk Classification: ${hriCls.label}
Conservation Priority Category: ${hriCls.priority}
Dominant Risk Driver(s): ${drivers.join(' + ')}

=== RULE-BASED BASELINE STRATEGY (Expert Layer output) ===
${strat.text}`;

  if(mode === 'external'){
    return `You are an expert heritage conservation advisor. Generate a tailored, evidence-based conservation strategy for the adaptive reuse heritage building described below, following the principles of minimal intervention, reversibility, and respect for cultural significance (UNESCO and ICOMOS conservation doctrine).

${caseStudyBlock}

=== YOUR TASK ===
Using only the assessment data above and established heritage conservation literature (UNESCO Managing Cultural World Heritage; World Heritage Resource Manual; ICOMOS charters and climate change adaptation guidance; published restoration practice for Egyptian Khedival/Colonial-era masonry buildings), expand the rule-based baseline strategy above into a conservation action plan tailored specifically to this building's actual indicator readings — not generic advice.

Your response must:
1. Explain why each recommendation responds to the specific dominant risk driver(s) and indicator values reported above.
2. Stay within the rule-based baseline conservation priority category (${hriCls.priority}) — do not recommend interventions from a different response tier without explicit justification.
3. Respect minimal-intervention and reversibility principles; avoid treatments incompatible with historic masonry, lime mortars, or terracotta ornament.
4. Be structured under these headings:
   - Immediate Actions
   - Preventive Measures
   - Climate Adaptation Measures
   - Monitoring Plan
   - Maintenance Schedule
   - References / Precedents drawn upon
5. For each recommendation, cite the type of source supporting it (e.g. "per ICOMOS climate adaptation guidance" or "per UNESCO preventive conservation principles") rather than inventing specific page numbers or quotations.`;
  }

  return `You are an expert heritage conservation advisor. Generate a tailored, evidence-based conservation strategy for the adaptive reuse heritage building described below, following the principles of minimal intervention, reversibility, and respect for cultural significance (UNESCO and ICOMOS conservation doctrine).

${caseStudyBlock}

=== RETRIEVED REFERENCES (auto-matched to this building's risk drivers and profile from HERA's local knowledge base) ===
${retrievedBlock}

=== YOUR TASK ===
Using the assessment data above and the retrieved references, expand the rule-based baseline strategy into a conservation action plan tailored specifically to this building's actual indicator readings — not generic advice. You may also draw on established heritage conservation literature (ICOMOS charters, climate change adaptation guidance) where the retrieved references don't fully cover a point, but prioritize grounding recommendations in the retrieved references above.

Your response must:
1. Explain why each recommendation responds to the specific dominant risk driver(s) and indicator values reported above.
2. Stay within the rule-based baseline conservation priority category (${hriCls.priority}) — do not recommend interventions from a different response tier without explicit justification.
3. Respect minimal-intervention and reversibility principles; avoid treatments incompatible with historic masonry, lime mortars, or terracotta ornament.
4. Be structured under these headings:
   - Immediate Actions
   - Preventive Measures
   - Climate Adaptation Measures
   - Monitoring Plan
   - Maintenance Schedule
   - References / Sources Used
5. For each recommendation, cite its supporting reference using the bracketed numbers from the Retrieved References section above (e.g. "[2]"), and only fall back to a general citation (e.g. "per ICOMOS guidance") for points the retrieved references don't cover. Do not invent specific page numbers or quotations.`;
}

/* ============================== LOCAL SOLUTION GENERATOR ==============================
   Produces an actual conservation solution directly inside HERA (no external AI call),
   by templating the rule-based strategy + retrieved knowledge base chunks into the same
   six-heading structure used by the prompt. This is the answer itself, not a request for
   one — useful when the person doesn't want to go validate with an external model. */
const SECTION_TAGS = {
  immediate: ['intervention','minimalintervention','retrofitting','cracking'],
  preventive: ['materialdecay','biologicalgrowth','saltcrystallization','surfaceloss','vulnerability','maintenance'],
  climate: ['temperature','humidity','solar','wind','precipitation','freeze-thaw','thermoclastism','corrosion','windrain','windrain','aridregion','hotarid','egypt','mediterranean'],
  monitoring: ['monitoring','earlywarning','drm','documentation','planning'],
};
const MAINTENANCE_CADENCE = {
  'Routine Monitoring': 'Annual condition survey; clean drainage and gutters seasonally; photographic documentation every 12 months.',
  'Scheduled Maintenance': 'Bi-annual condition survey; routine cleaning and minor repairs on a 6-month cycle; review environmental logs quarterly.',
  'Preventive Conservation': 'Quarterly condition survey; environmental monitoring reviewed monthly; biological growth/material decay checks every 3 months.',
  'Conservation Upgrade': 'Monthly condition survey during works; weekly environmental monitoring; structural movement checks bi-weekly until stabilized.',
  'Immediate Intervention': 'Weekly (or continuous) monitoring until stabilized; daily visual checks on the affected elements; full re-assessment within 30 days of intervention.'
};

function climateNarrative(a){
  return `Environmental buffering measures — shading, ventilation, and drainage improvements — should target the specific climatic mechanisms (${a.drivers.includes('ESS') ? 'elevated temperature, humidity and solar exposure' : 'temperature, humidity and solar exposure'}) currently degrading this building's fabric, and should be re-evaluated whenever the Future HRI is projected under a more severe climate scenario.`;
}
function monitoringNarrative(a){
  return `Establish a monitoring regime — condition surveys, environmental data logging, and structural checks — at a frequency matching the <b>${a.hriCls.priority}</b> category, so early signs of deterioration are caught and acted on before they escalate.`;
}

function pickBySectionTags(chunks, tagList, max){
  max = max || 3;
  const matched = chunks.filter(c => c.tags.some(t => tagList.includes(t)));
  return matched.slice(0, max);
}

function sectionRetrieve(queryTags, sectionTagList, max){
  const filtered = queryTags.filter(t => sectionTagList.includes(t));
  const tagsToUse = filtered.length ? filtered : sectionTagList;
  return retrieveKnowledge(tagsToUse, max);
}

function generateLocalSolution(scenarioKey){
  const a = assembleAssessment(scenarioKey);
  const immediateNeeded = ['Immediate Intervention','Conservation Upgrade'].includes(a.hriCls.priority);
  const immediateChunks = immediateNeeded ? sectionRetrieve(a.queryTags, SECTION_TAGS.immediate, 2) : [];
  const preventiveChunks = sectionRetrieve(a.queryTags, SECTION_TAGS.preventive, 3);
  const climateChunks = sectionRetrieve(a.queryTags, SECTION_TAGS.climate, 3);
  const monitoringChunks = retrieveKnowledge(SECTION_TAGS.monitoring, 2);
  const allCitedChunks = [...immediateChunks,...preventiveChunks,...climateChunks,...monitoringChunks]
    .filter((c,i,arr)=>arr.findIndex(x=>x.id===c.id)===i);

  return {
    a,
    immediate: {
      text: immediateNeeded ? a.strat.text : 'No immediate emergency action is indicated at the current Conservation Priority Category — proceed directly to Preventive Conservation below.',
      refs: immediateChunks
    },
    preventive: {
      text: a.strat.text,
      refs: preventiveChunks
    },
    climate: {
      text: climateNarrative(a),
      refs: climateChunks
    },
    monitoring: {
      text: monitoringNarrative(a),
      refs: monitoringChunks
    },
    maintenance: {
      text: MAINTENANCE_CADENCE[a.hriCls.priority] || MAINTENANCE_CADENCE['Routine Monitoring']
    },
    references: allCitedChunks
  };
}

function copyPrompt(scenarioKey, mode){
  const text = buildPrompt(scenarioKey, mode);
  navigator.clipboard.writeText(text).then(()=>{
    const btn = document.getElementById('copyBtn');
    if(btn){ const old = btn.innerHTML; btn.innerHTML = `${icon('check',16)} Copied`; setTimeout(()=>{ btn.innerHTML=old; }, 1500); }
  });
}

function blankBuilding(){
  return {name:'Baron Palace', location:'Heliopolis, Cairo, Egypt', year:1907, category:'Palace',
    era:eraFromYear(1907), material:'Limestone', use:'Cultural Center', occupancy:'', images:[]};
}

function eraFromYear(year){
  const y = parseInt(year);
  if(!y) return '';
  if(y < 1880) return 'Pre-1880';
  if(y <= 1940) return '1880–1940 (Khedival/Colonial)';
  return 'Post-1940';
}

/* ============================================================================
   PHASE 2 — CONSERVATION ACTION PLAN
   Final module. Built entirely on top of the existing, untouched calculation
   layer (computeESS/BCS/OIS, computeHRI, classify, dominantDrivers,
   assembleAssessment, KNOWLEDGE_BASE, retrieveKnowledge, generateLocalSolution).
   ============================================================================ */

/* ---------- Critical Indicators ----------
   A sub-indicator is "critical" for Phase 2 purposes once its own score lands
   in Moderate/Fair or worse — i.e. the same band tables already used
   everywhere else in HERA (BANDS_GENERIC / BANDS_BCS), just applied per
   sub-indicator instead of per pillar. This is a new derived read of scores
   HERA already computes; it does not change how ESS/BCS/OIS/HRI themselves
   are calculated. */
function critLabelIsIssue(label){
  return ['Moderate','Fair','High','Poor','Severe','Critical'].includes(label);
}
function priorityFromLabel(label){
  return {Severe:'Immediate', Critical:'Immediate', High:'High', Poor:'High',
          Moderate:'Medium', Fair:'Medium'}[label] || 'Low';
}
function computeCriticalIndicators(essR, bcsR, oisR){
  const list = [];
  [['Temperature','temperature'],['Humidity','humidity'],['Solar','solar']].forEach(([partKey,key])=>{
    const score = essR.parts[partKey], cls = classify(score, BANDS_GENERIC);
    if(critLabelIsIssue(cls.label)) list.push({key, name:partKey, category:'ESS', score, label:cls.label, color:bandColor(cls.label)});
  });
  [['MaterialDecay','materialdecay'],['Cracking','cracking'],['SurfaceLoss','surfaceloss'],['BiologicalGrowth','biologicalgrowth']].forEach(([partKey,key])=>{
    const score = bcsR.parts[partKey], cls = classify(score, BANDS_BCS);
    if(critLabelIsIssue(cls.label)) list.push({key, name:partKey, category:'BCS', score, label:cls.label, color:bandColor(cls.label)});
  });
  let oisWorst = null;
  ['OccupancyDensity','VisitorLoad','EventFrequency'].forEach(partKey=>{
    const score = oisR.parts[partKey], cls = classify(score, BANDS_GENERIC);
    if(critLabelIsIssue(cls.label) && (!oisWorst || score > oisWorst.score)){
      oisWorst = {key:'occupancy', name:'Occupancy Pressure ('+partKey+')', category:'OIS', score, label:cls.label, color:bandColor(cls.label)};
    }
  });
  if(oisWorst) list.push(oisWorst);
  return list;
}

/* ---------- Issue → conservation-response templates ----------
   Original text, written for this module. Grounded in the same minimal-
   intervention / reversibility / compatibility / authenticity principles the
   proposal cites (Venice Charter, ICOMOS, UNESCO Managing Disaster Risks for
   World Heritage), and tailored to Egyptian hot-arid, lime-mortar/limestone
   masonry practice consistent with HERA's own knowledge base (kb17). */
const ISSUE_TEMPLATES = {
  temperature: {
    issue:'Thermal Stress on Masonry & Surface Finishes',
    expectedOutcome:'Reduced diurnal thermal cycling on exposed stone and render, lower risk of thermoclastic micro-cracking and exfoliation, decreased future ESS contribution to HRI.',
    recommendation:'Install reversible external shading (timber/aluminium louvers, retractable fabric awnings, or planted screens) on the most solar-exposed façades to reduce diurnal thermal cycling. Improve passive ventilation using existing openings rather than a mechanical HVAC retrofit that would penetrate historic fabric. Any shading structure must be independently supported, fully reversible, and visually recessive relative to the historic façade.',
    materials:['Timber or aluminium louvers (reversible fixings)','Retractable fabric awnings','UV-stable shading fabric'],
    expertise:['Architectural Conservator','Conservation Technician'],
    cost:2, duration:'3 months',
    warning:{doNot:'Do not apply reflective or dark-coloured coatings to reduce solar gain.', reason:'Coatings alter the historic surface appearance and can trap moisture beneath an impermeable layer.', consequence:'Accelerated subsurface decay and irreversible loss of surface authenticity.', reference:'ICOMOS Charter for Analysis, Conservation and Structural Restoration'}
  },
  humidity: {
    issue:'Moisture-Driven Deterioration (Salt Cycling & Biological Risk)',
    expectedOutcome:'Reduced amplitude of humidity fluctuation across the salt deliquescence point, lower future risk of subflorescence/efflorescence and biological growth, decreased future ESS contribution to HRI.',
    recommendation:'Improve passive ventilation and repair any blocked or damaged rainwater goods and perimeter drainage before considering mechanical dehumidification. Install unobtrusive environmental data loggers to establish a baseline before specifying further intervention — treat the cause (water ingress, poor ventilation) rather than only the symptom.',
    materials:['Lime-based repointing mortar (breathable)','Environmental data loggers','Perimeter drainage components'],
    expertise:['Conservation Technician','Structural Engineer'],
    cost:2, duration:'3 months',
    warning:{doNot:'Do not seal masonry with cement-based renders or impermeable coatings.', reason:'Historic lime-based masonry needs to breathe; impermeable renders trap moisture inside the wall.', consequence:'Trapped moisture accelerates salt crystallization damage and hastens render/plaster failure.', reference:'ICOMOS / Egyptian heritage conservation guidance'}
  },
  solar: {
    issue:'Excess Solar Radiation Exposure',
    expectedOutcome:'Reduced surface heating and UV exposure on finishes, slower thermoclastic micro-cracking, reduced future ESS contribution to HRI.',
    recommendation:'Introduce reversible shading elements on the most exposed elevations. Where non-historic glazing exists, UV-filtering film may be applied — never on original historic glass or openings. Monitor solar radiation seasonally to verify shading remains adequate under the selected climate scenario.',
    materials:['Reversible shading structures','UV-filtering film (non-historic glazing only)','Solar radiation monitoring sensor'],
    expertise:['Architectural Conservator'],
    cost:2, duration:'3 months',
    warning:{doNot:'Do not install permanent, fixed shading anchored directly into historic stonework.', reason:'Permanent fixings are irreversible and can introduce differential stress into historic masonry.', consequence:'Structural damage to masonry and loss of reversibility.', reference:'UNESCO Managing Disaster Risks for World Heritage'}
  },
  materialdecay: {
    issue:'Material Decay of Original Fabric',
    expectedOutcome:'Stabilized material substrate, arrested progression of decay, improved long-term structural durability, decreased future BCS contribution to HRI.',
    recommendation:'Undertake targeted consolidation of decayed stone and mortar using materials compatible with the original limestone fabric — hydraulic lime-based consolidants and repair mortars rather than Portland cement or synthetic resins. Test all repair materials for compatibility (porosity, salt content, mechanical strength) before application; any replacement stone should behave like the original but remain identifiable on close inspection, per the conservation ethic of honesty.',
    materials:['Hydraulic lime mortar','Compatible limestone (matched porosity)','Lime-based consolidant'],
    expertise:['Stone Conservator','Architectural Conservator'],
    cost:3, duration:'3 months',
    warning:{doNot:'Do not use Portland cement or synthetic resin-based repairs on historic limestone.', reason:'These materials are harder and less permeable than the original stone, trapping moisture and salts.', consequence:'Accelerated decay of surrounding original material and salt crystallization at the repair interface.', reference:'ICOMOS'}
  },
  cracking: {
    issue:'Structural Cracking',
    expectedOutcome:'Arrested crack propagation, restored structural continuity, reduced water-ingress pathways, decreased future BCS contribution to HRI.',
    recommendation:'Commission a structural engineer to assess whether cracking is active or dormant using crack-monitoring gauges before any grouting. Where confirmed appropriate, inject compatible lime-based grout into structural cracks, following the minimum-intervention hierarchy — traditional materials and techniques first, escalating to modern materials only where structural performance cannot otherwise be achieved.',
    materials:['Lime-based injection grout','Crack monitoring gauges (tell-tales)','Stainless steel or titanium pins (if reinforcement required)'],
    expertise:['Structural Engineer','Stone Conservator'],
    cost:3, duration:'3 months',
    warning:{doNot:'Do not inject rigid cement-based grout into active or unassessed cracks.', reason:'Rigid grout cannot accommodate ongoing structural movement and may worsen cracking elsewhere.', consequence:'New cracking adjacent to the repair and loss of structural monitoring data.', reference:'UNESCO Managing Disaster Risks for World Heritage — post-earthquake retrofitting precedent'}
  },
  surfaceloss: {
    issue:'Surface Loss / Material Erosion',
    expectedOutcome:'Reduced moisture penetration, decreased future material deterioration, improved long-term resilience, reduced future HRI.',
    recommendation:'Apply a compatible lime-based render or shelter coat only where surface loss has exposed the core masonry to direct weathering, matched in porosity and strength to the surrounding original material. Where losses affect ornament or inscriptions of documentary value, prioritize protective consolidation over reconstruction, and clearly record any new material to preserve legibility of the original fabric.',
    materials:['Lime-based shelter coat / render','Compatible limestone infill (where structurally needed)'],
    expertise:['Stone Conservator','Architectural Conservator'],
    cost:2, duration:'3 months',
    warning:{doNot:'Do not reconstruct lost ornamental or inscribed surfaces from conjecture.', reason:'Conjectural reconstruction misrepresents the historic record and is not reversible once applied.', consequence:'Loss of authenticity and diminished value as physical historic evidence.', reference:'Venice Charter / ICOMOS authenticity principles'}
  },
  biologicalgrowth: {
    issue:'Biological Growth (Algae, Fungi, Lichens)',
    expectedOutcome:'Reduced surface staining and biodeterioration, lower surface moisture retention, decreased future BCS contribution to HRI.',
    recommendation:'Remove biological growth using low-pressure water cleaning or soft brushing rather than aggressive chemical biocides. Where regrowth persists, apply a conservation-grade biocide tested for substrate compatibility, applied sparingly and only after mechanical cleaning. Address the underlying moisture source directly rather than relying on biocide alone.',
    materials:['Soft-bristle brushes','Low-pressure water cleaning equipment','Conservation-grade biocide (compatibility-tested)'],
    expertise:['Conservation Technician'],
    cost:1, duration:'2 days',
    warning:{doNot:'Do not use high-pressure water jetting or household bleach on historic stone.', reason:'High pressure erodes the stone surface; bleach can react with salts already present in the masonry.', consequence:'Accelerated surface erosion and potential salt-driven decay.', reference:'ICOMOS'}
  },
  occupancy: {
    issue:'Occupancy & Visitor Pressure',
    expectedOutcome:'Reduced humidity and thermal loading from visitor presence, reduced mechanical wear on floors and circulation routes, decreased future OIS contribution to HRI.',
    recommendation:'Introduce a visitor management plan — capped occupancy limits, timed-entry scheduling for high-demand periods, and protective circulation routes over sensitive floor and finish areas. For event use, restrict high-load events in the most vulnerable spaces and require a post-event condition check.',
    materials:['Protective walkway matting','Visitor counting sensors','Circulation barriers / stanchions'],
    expertise:['Routine Maintenance','Conservation Technician'],
    cost:1, duration:'2 weeks',
    warning:{doNot:'Do not permit unrestricted visitor access to structurally sensitive or actively deteriorating areas.', reason:'Uncontrolled foot traffic and event loads add mechanical and environmental stress on top of existing vulnerability.', consequence:'Accelerated wear, higher risk of accidental damage, and compounding of existing BCS/ESS risk factors.', reference:'UNESCO Managing Disaster Risks for World Heritage'}
  }
};

/* Scored variant of retrieveKnowledge for Evidence-tab confidence display.
   Mirrors the existing tag-overlap logic exactly; does not alter or call
   through retrieveKnowledge, so that function remains untouched. */
function retrieveKnowledgeScored(queryTags, topN){
  topN = topN || 6;
  const scored = KNOWLEDGE_BASE.map(chunk=>{
    let score = 0;
    queryTags.forEach(qt=>{ if(chunk.tags.includes(qt)) score += 1; });
    return Object.assign({matchScore:score}, chunk);
  }).filter(c=>c.matchScore>0);
  scored.sort((a,b)=>b.matchScore-a.matchScore);
  return scored.slice(0, topN);
}

/* Assembles the full Conservation Action Plan: reuses assembleAssessment()
   (existing, untouched) for HRI/drivers/scenario data, then layers per-
   indicator recommendations on top using ISSUE_TEMPLATES + retrieval. */
function buildActionPlan(scenarioKey){
  const essR = computeESS(state.ess), bcsR = computeBCS(state.bcs), oisR = computeOIS(state.ois);
  const hriCurrent = computeHRI(essR.score, bcsR.score, oisR.score);
  const a = assembleAssessment(scenarioKey);
  const criticalIndicators = computeCriticalIndicators(essR, bcsR, oisR);
  const b = a.b;

  let items = criticalIndicators.map(ci=>{
    const tmpl = ISSUE_TEMPLATES[ci.key];
    if(!tmpl) return null;
    const priority = priorityFromLabel(ci.label);
    const evidence = retrieveKnowledgeScored(Array.from(new Set([ci.key, ...a.queryTags])), 4);
    const why = `This recommendation responds to <b>${ci.name}</b> (indicator score ${ci.score.toFixed(1)}/100, classified <b>${ci.label}</b>). At the <b>${a.scenarioLabel}</b> scenario the Heritage Risk Index is <b>${a.hri.toFixed(1)}</b> (${a.hriCls.label}), against a Current (baseline) HRI of <b>${hriCurrent.toFixed(1)}</b>, with <b>${a.drivers.join(' + ')}</b> identified as the dominant risk driver(s). Given this building's <b>${b.material||'—'}</b> construction and its current adaptive reuse as a <b>${b.use}</b>, this intervention is prioritized within the <b>${a.hriCls.priority}</b> conservation category.`;
    return {id: ci.key+'_'+ci.name.replace(/\s+/g,''), issue:tmpl.issue, priority, why,
      expectedOutcome:tmpl.expectedOutcome, recommendation:tmpl.recommendation,
      materials:tmpl.materials, expertise:tmpl.expertise, cost:tmpl.cost, duration:tmpl.duration,
      warning:tmpl.warning, evidence, ci};
  }).filter(Boolean);

  if(items.length === 0){
    const evidence = retrieveKnowledgeScored(a.queryTags, 4);
    items.push({id:'general', issue:'Routine Preventive Care', priority: a.hriCls.label==='Very Low' ? 'Low' : priorityFromLabel(a.hriCls.label),
      why:`No individual indicator currently exceeds the Moderate risk threshold. At the <b>${a.scenarioLabel}</b> scenario the HRI is <b>${a.hri.toFixed(1)}</b> (${a.hriCls.label}), against a Current HRI of <b>${hriCurrent.toFixed(1)}</b>. Given the ${b.material||'—'} construction and ${b.use} use, routine preventive care is sufficient at this time.`,
      expectedOutcome:'Maintained current condition; early detection of any emerging deterioration.',
      recommendation:a.strat.text, materials:['Environmental monitoring sensors','Basic maintenance tools'],
      expertise:['Routine Maintenance'], cost:1, duration:'2 days',
      warning:{doNot:'Do not defer routine inspection.', reason:'Small issues left unchecked can escalate.', consequence:'Preventable deterioration becomes costly to reverse.', reference:'UNESCO Managing Disaster Risks for World Heritage'},
      evidence, ci:null});
  }
  const order = {Immediate:0, High:1, Medium:2, Low:3};
  items.sort((x,y)=>order[x.priority]-order[y.priority]);
  return {a, hriCurrent, criticalIndicators, items, essR, bcsR, oisR};
}

/* ---------- Case Study Library ----------
   Illustrative, general-knowledge precedent records for well-known Cairo
   adaptive-reuse heritage buildings. Kept deliberately qualitative (no
   invented dates/figures) pending full documentation upload; framed as
   prototype records, consistent with how the rest of HERA flags
   not-yet-integrated data sources. */
const CASE_STUDY_LIBRARY = [
  {id:'baron', name:'Baron Empain Palace', location:'Heliopolis, Cairo, Egypt',
   material:['Limestone','Reinforced Concrete (early)'], typology:['Palace'], adaptiveReuse:['Museum','Cultural Center'],
   climate:['hotarid','egypt'], techniques:['materialdecay','surfaceloss','occupancy'],
   summary:'An early-20th-century Cairo palace conserved and opened as a public visitor attraction — a museum-type adaptive reuse under hot-arid conditions with highly ornamental, climate-vulnerable surfaces.',
   strategies:['Structural consolidation of decorative concrete and stonework','Environmental controls introduced for public access','Visitor-flow management around fragile ornamental surfaces'],
   lessons:'Balancing public accessibility with conservation of ornamental, climate-vulnerable surfaces is the central challenge for museum-type adaptive reuse of Cairo-era palaces.',
   references:['Egyptian Ministry of Antiquities — general project record']},
  {id:'manial', name:'Prince Mohamed Ali Palace (Manial Palace)', location:'Rhoda Island, Cairo, Egypt',
   material:['Limestone','Limestone + Brick'], typology:['Palace'], adaptiveReuse:['Museum'],
   climate:['hotarid','egypt'], techniques:['materialdecay','humidity'],
   summary:'A large early-20th-century palace complex restored and operated as a museum, combining multiple architectural styles across several pavilions.',
   strategies:['Phased restoration across multiple structures within one complex','Conservation of decorative interior finishes alongside structural masonry repair'],
   lessons:'Multi-building heritage complexes benefit from a phased, prioritized conservation approach rather than one uniform intervention across the whole site.',
   references:['Egyptian Ministry of Antiquities — general project record']},
  {id:'sakakini', name:'Sakakini Palace', location:'Daher, Cairo, Egypt',
   material:['Limestone'], typology:['Palace'], adaptiveReuse:['Cultural Center','Vacant / Unused'],
   climate:['hotarid','egypt'], techniques:['cracking','materialdecay'],
   summary:'An ornate early-20th-century Cairo palace that underwent a long period of structural vulnerability before stabilization and conservation works — a precedent for recovering from a Critical/Immediate-Intervention-type condition.',
   strategies:['Emergency structural stabilization prior to further conservation','Facade and ornamental plaster conservation'],
   lessons:'Buildings that reach a Critical risk category can still be recovered, but require stabilization before any aesthetic or adaptive-reuse conservation work proceeds.',
   references:['Egyptian Ministry of Antiquities — general project record']},
  {id:'historiccairo', name:'Historic Cairo — General Precedent', location:'Historic Cairo, Egypt',
   material:['Limestone','Brick Masonry'], typology:['Landmark Building','Religious Building','Public/Civic Building'],
   adaptiveReuse:['Cultural Center','Educational','Mixed Use'], climate:['hotarid','egypt','aridregion'],
   techniques:['surfaceloss','biologicalgrowth','humidity'],
   summary:'A general reference class covering the wider stock of load-bearing masonry heritage buildings in Historic Cairo, sharing the same hot-arid climate and lime-based masonry vulnerabilities as this assessed building.',
   strategies:['Lime-based repair mortars matched to local masonry','Preventive maintenance cycles calibrated to hot-arid, low-humidity-swing conditions'],
   lessons:'Precedent from the broader Historic Cairo context is useful when a specific comparable building record is not yet available in the knowledge base.',
   references:['UNESCO World Heritage inscription documentation — Historic Cairo']}
];
function retrieveCaseStudies(building, drivers, maxN){
  maxN = maxN || 4;
  const scored = CASE_STUDY_LIBRARY.map(cs=>{
    let score = 0; const reasons = [];
    if(building.material && cs.material.some(m=>building.material.indexOf(m.split(' ')[0])>=0)){ score+=2; reasons.push('matching construction material'); }
    if(cs.typology.includes(building.category)){ score+=2; reasons.push('matching building typology'); }
    if(cs.adaptiveReuse.includes(building.use)){ score+=2; reasons.push('matching adaptive reuse function'); }
    if(cs.climate.includes('hotarid')){ score+=1; reasons.push('shared hot-arid climate context'); }
    (drivers||[]).forEach(d=>{ /* driver-to-technique is a loose thematic link, not exact match */ });
    return {cs, score, reasons};
  }).sort((x,y)=>y.score-x.score);
  return scored.slice(0, maxN);
}

/* ---------- Media Library (images / drawings / scans) ----------
   Intentionally empty: HERA's knowledge base currently holds paraphrased TEXT
   chunks only (KNOWLEDGE_BASE). No photographs, technical drawings or PDF
   scans have been indexed. This module is wired so that once real assets are
   uploaded and tagged with this same schema, retrieveMedia() will surface
   them automatically, matched to recommendations exactly like text retrieval
   already works — without any other code needing to change. Per spec, this
   module NEVER generates artificial images; it only ever displays retrieved
   entries from here. */
const MEDIA_LIBRARY = [];
function retrieveMedia(tags, topN){
  topN = topN || 3;
  if(!MEDIA_LIBRARY.length) return [];
  const scored = MEDIA_LIBRARY.map(m=>{
    let score = 0; tags.forEach(t=>{ if(m.tags.includes(t)) score += 1; });
    return {m, score};
  }).filter(s=>s.score>0);
  scored.sort((a,b)=>b.score-a.score);
  return scored.slice(0, topN).map(s=>s.m);
}

/* ---------- Internet Image Retrieval Service ----------
   Falls back to real, trusted online sources when the local knowledge base
   (MEDIA_LIBRARY, above) has no matching asset for a given recommendation or
   case study — per spec, priority is always: local KB first, online second.

   Source: Wikimedia Commons (commons.wikimedia.org). It is a curated,
   trusted repository (used directly by UNESCO, museums and heritage bodies),
   every result is a real uploaded photograph/scan with its own attribution
   and license metadata, and its public API supports anonymous cross-origin
   requests (origin=*) so it can be queried directly from this static page —
   no API key, no server, no AI-generated imagery.

   Results are cached (in-memory + localStorage) so the same query is never
   re-fetched needlessly, and the app still functions with no connection —
   getImages() just returns a graceful "offline" status the UI can render. */
const IMAGE_CACHE_KEY = 'hera_image_cache_v1';
const IMAGE_CACHE_TTL_MS = 30*24*60*60*1000; // 30 days

function loadImageCache(){
  try{
    const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem(IMAGE_CACHE_KEY) : null;
    state.imageCache = raw ? JSON.parse(raw) : {};
  }catch(e){ state.imageCache = {}; } // corrupt/unavailable storage — degrade gracefully, don't crash
}
function persistImageCache(){
  try{
    if(typeof localStorage !== 'undefined') localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(state.imageCache));
  }catch(e){ /* storage full/unavailable (e.g. private browsing) — safe to ignore, cache stays in-memory */ }
}
function stripTags(html){
  return (html||'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
}
function imageCacheKey(query){ return 'img:'+query.toLowerCase().trim(); }

async function searchWikimediaImages(query, maxN){
  maxN = maxN || 3;
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query+' filetype:bitmap')}&gsrlimit=${maxN}&gsrnamespace=6&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=480&format=json&origin=*`;
  const data = await fetchJSON(url, {timeoutMs:9000});
  const pages = data && data.query && data.query.pages ? Object.values(data.query.pages) : [];
  return pages
    .filter(p=>p.imageinfo && p.imageinfo[0])
    .map(p=>{
      const info = p.imageinfo[0];
      const meta = info.extmetadata || {};
      return {
        id: 'wc'+p.pageid,
        title: (p.title||'').replace(/^File:/,'').replace(/\.[a-zA-Z0-9]+$/,''),
        thumbUrl: info.thumburl || info.url,
        fullUrl: info.url,
        descriptionUrl: info.descriptionurl,
        credit: stripTags(meta.Artist && meta.Artist.value) || 'Unknown author',
        license: stripTags(meta.LicenseShortName && meta.LicenseShortName.value) || 'See source page',
        source: 'Wikimedia Commons'
      };
    });
}

/* Synchronous read + async populate: the very first call for a query returns
   a "loading" entry immediately (so the UI can render a spinner without
   blocking), kicks off the real fetch in the background, and triggers a
   re-render once it resolves. Every call after that is served straight from
   cache — no repeat network requests for the same query. */
function getImages(query, maxN){
  const key = imageCacheKey(query);
  const cached = state.imageCache[key];
  const fresh = cached && (Date.now() - (cached.ts||0) < IMAGE_CACHE_TTL_MS);
  if(cached && fresh) return cached;

  if(!cached || !fresh){
    state.imageCache[key] = {status:'loading', images:[], error:null, ts:Date.now()};
    if(!isOnline()){
      state.imageCache[key] = {status:'offline', images:[], error:'You appear to be offline.', ts:Date.now()};
      persistImageCache();
    } else {
      searchWikimediaImages(query, maxN).then(images=>{
        state.imageCache[key] = {status: images.length ? 'ready' : 'empty', images, error:null, ts:Date.now()};
        persistImageCache();
        render();
      }).catch(err=>{
        const msg = err.message === 'timeout' ? 'Image search timed out.' : 'Image retrieval failed (network/CORS).';
        state.imageCache[key] = {status:'error', images:[], error:msg, ts:Date.now()};
        persistImageCache();
        render();
      });
    }
  }
  return state.imageCache[key];
}
function retryImages(query, maxN){
  delete state.imageCache[imageCacheKey(query)];
  getImages(query, maxN);
  render();
}

/* ---------- Image rendering helpers (shared by Visual Guidance & Case Studies) ---------- */
function imageResultsHTML(query, maxN, captionForEmpty){
  const entry = getImages(query, maxN);
  if(entry.status === 'loading'){
    return `<div class="media-placeholder"><div class="media-placeholder-icon">${icon('search',26)}</div><div class="media-placeholder-text">Searching Wikimedia Commons…</div></div>`;
  }
  if(entry.status === 'offline'){
    return `<div class="media-placeholder"><div class="media-placeholder-icon">${icon('wifiOff',26)}</div><div class="media-placeholder-text">Offline</div><div class="media-placeholder-caption">Connect to the internet to retrieve images for this item.</div></div>`;
  }
  if(entry.status === 'error'){
    return `<div class="media-placeholder"><div class="media-placeholder-icon">${icon('alert',26)}</div><div class="media-placeholder-text">Image retrieval failed</div><div class="media-placeholder-caption">${entry.error}</div></div><button style="margin-top:8px;padding:7px 12px;font-size:12px;" onclick='retryImages(${JSON.stringify(query)},${maxN})'>${icon('refresh',15)} Retry</button>`;
  }
  if(entry.status === 'empty'){
    return mediaPlaceholder(captionForEmpty || 'No matching images found on Wikimedia Commons');
  }
  return `<div style="display:flex;gap:12px;flex-wrap:wrap;">${entry.images.map(img=>`
    <div class="img-card">
      <img class="img-card-thumb" src="${img.thumbUrl}" alt="${img.title}" loading="lazy" onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22220%22 height=%22150%22><rect width=%22100%25%22 height=%22100%25%22 fill=%22%231e1e21%22/><text x=%2250%25%22 y=%2250%25%22 fill=%22%239a9aa2%22 font-size=%2212%22 text-anchor=%22middle%22>Image unavailable</text></svg>'">
      <div class="img-card-caption">${img.title}</div>
      <div class="img-card-meta">${img.source} · ${img.license}</div>
      <a class="img-card-link" href="${img.descriptionUrl}" target="_blank" rel="noopener noreferrer">View original page →</a>
    </div>
  `).join('')}</div>`;
}

/* ---------- Shared render helpers ---------- */
const CAP_TABS = [
  {id:'strategy', label:'Strategy', ic:'clipboard'},
  {id:'implementation', label:'Implementations', ic:'layers'},
  {id:'cases', label:'Case Studies', ic:'landmark'},
  {id:'visual', label:'Visual Guidance & KB', ic:'image'}
];
function capTabsHTML(){
  return `<div class="cap-tabs">${CAP_TABS.map(t=>`<div class="cap-tab ${state.capTab===t.id?'active':''}" onclick="state.capTab='${t.id}';render()">${icon(t.ic,15)} ${t.label}</div>`).join('')}</div>`;
}
function priorityColor(p){ return {Immediate:'var(--crit)', High:'var(--high)', Medium:'var(--mod)', Low:'var(--good)'}[p] || 'var(--muted)'; }
function recCardHead(item){
  return `<div class="rec-head">
    <div class="rec-issue">${item.issue}</div>
    <div class="rec-priority" style="background:${priorityColor(item.priority)}22;color:${priorityColor(item.priority)};">${item.priority}</div>
  </div>`;
}
function costDollars(n){
  let out = '';
  for(let i=1;i<=4;i++) out += `<span class="cost-dollar ${i<=n?'active':''}">$</span>`;
  return out;
}
function mediaPlaceholder(caption){
  return `<div class="media-placeholder">
    <div class="media-placeholder-icon">${icon('image',26)}</div>
    <div class="media-placeholder-text">No indexed photograph yet</div>
    ${caption ? `<div class="media-placeholder-caption">${caption}</div>` : ''}
  </div>`;
}
function openCapModal(id){ state.capModalId = id; render(); }
function closeCapModal(){ state.capModalId = null; render(); }
function capModalHTML(){
  if(!state.capModalId) return '';
  const c = KNOWLEDGE_BASE.find(k=>k.id===state.capModalId) || MEDIA_LIBRARY.find(m=>m.id===state.capModalId);
  if(!c) return '';
  return `<div class="modal-overlay" onclick="if(event.target===this){closeCapModal();}">
    <div class="modal-box">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
        <h3 style="font-size:16px;">${c.source || c.title || 'Source'}</h3>
        <button class="ghost" style="padding:6px 10px;" onclick="closeCapModal()">${icon('close',16)}</button>
      </div>
      ${mediaPlaceholder('No image indexed for this source yet')}
      <div class="rec-row" style="margin-top:10px;">${c.text || c.caption || ''}</div>
      <div style="margin-top:8px;">${(c.tags||[]).map(t=>`<span class="kb-tag">${t}</span>`).join('')}</div>
    </div>
  </div>`;
}

/* ---------- Tab 1 · Assessment Summary ---------- */
function capSummary(plan){
  const {a, hriCurrent, criticalIndicators} = plan;
  const b = a.b;
  return `
    <div class="score-row">
      ${scoreCard('Current HRI', hriCurrent, HRI_TABLE)}
      ${scoreCard(a.scenarioLabel, a.hri, HRI_TABLE)}
      ${scoreCard('OIS (Exposure)', a.ois, BANDS_GENERIC)}
    </div>
    <div class="hri-banner">
      <div>
        <div style="font-size:12px;color:var(--muted);letter-spacing:.5px;">Risk Classification — ${a.scenarioLabel}</div>
        <div class="big">${a.hriCls.label}</div>
      </div>
      <div style="text-align:right;">
        <div class="tag" style="background:${bandColor(a.hriCls.label)}22;color:${bandColor(a.hriCls.label)};">${a.hriCls.priority}</div>
        <div style="font-size:13px;color:var(--muted);margin-top:8px;">Dominant Driver(s): ${a.drivers.join(' + ')}</div>
      </div>
    </div>
    <div class="twocol" style="margin-top:20px;">
      <div class="indicator-block">
        <div class="ihead"><span class="iname">Building</span></div>
        <div class="rec-row"><b>${b.name}</b> — ${b.location}<br>Category: ${b.category||'—'} · Era: ${b.era||'—'} · Year: ${b.year||'—'}</div>
      </div>
      <div class="indicator-block">
        <div class="ihead"><span class="iname">Building Profile</span></div>
        <div class="rec-row">Adaptive Reuse Function: <b>${b.use}</b><br>Building Material: <b>${b.material||'—'}</b><br>Selected Climate Scenario: <b>${a.scenarioLabel}</b></div>
      </div>
    </div>
    <div class="indicator-block">
      <div class="ihead"><span class="iname">Critical Indicators (${criticalIndicators.length})</span></div>
      ${criticalIndicators.length
        ? criticalIndicators.map(ci=>`<span class="rec-chip" style="border-color:${ci.color};color:${ci.color};">${ci.name} — ${ci.score.toFixed(1)} (${ci.label})</span>`).join('')
        : `<div class="rec-row" style="color:var(--muted);">No individual indicator currently exceeds the Moderate risk threshold.</div>`}
    </div>
    <div class="note">This summary carries into every other tab below. Switch scenarios back on the Climate Scenarios step to regenerate the whole plan for a different future.</div>
  `;
}

/* ---------- Tab 2 · Conservation Strategy ---------- */
function capStrategy(plan){
  return `
    <div class="future-block" style="margin-top:0;padding-top:0;border-top:none;">
      <h2 style="font-size:16px;">RAG-Grounded Baseline</h2>
      <div class="sub" style="margin-bottom:8px;">Rule-based conservation category expanded with retrieved knowledge base sources — generated by HERA's existing RAG engine.</div>
      ${renderSolutionSection(generateLocalSolution(state.scenario))}
    </div>
    <div class="future-block">
      <h2 style="font-size:16px;">Tailored Recommendations by Issue</h2>
      <div class="sub" style="margin-bottom:8px;">Generated from this building's actual Critical Indicators, HRI trajectory, and knowledge base retrieval.</div>
      ${plan.items.map(item=>`
        <div class="rec-card">
          ${recCardHead(item)}
          <div class="rec-row"><b>Why this is required:</b> ${item.why}</div>
          <div class="rec-row"><b>Expected Outcome:</b> ${item.expectedOutcome}</div>
          <div class="rec-row"><b>Recommendation:</b> ${item.recommendation}</div>
        </div>
      `).join('')}
    </div>
  `;
}

/* ---------- Tab 3 · Visual Guidance ---------- */
function capVisual(plan){
  return `
    <div class="note">Local knowledge base assets are used first. Where none exist, HERA automatically retrieves real, non-AI-generated photographs from <b>Wikimedia Commons</b> — a trusted source used directly by UNESCO and heritage institutions — matched to each recommendation. Each result shows its caption, source and license, with a link to the original page.</div>
    ${plan.items.map(item=>{
      const tags = item.evidence.flatMap(e=>e.tags);
      const localMedia = retrieveMedia(tags, 3);
      const top = item.evidence[0];
      const query = `${item.issue} heritage conservation ${plan.a.b.material||''}`.trim();
      return `<div class="diagram-strip">
        <div class="diagram-title">${item.issue}</div>
        <div class="diagram-flow">
          <div class="diagram-step">Recommendation</div><div class="diagram-arrow">→</div>
          <div class="diagram-step">Search Knowledge Base</div><div class="diagram-arrow">→</div>
          <div class="diagram-step">${top ? top.source.split(',')[0] : (localMedia.length?'Local KB match':'Wikimedia Commons')}</div><div class="diagram-arrow">→</div>
          <div class="diagram-step">Image / Caption</div>
        </div>
        <div class="diagram-caption">${top ? top.text : 'No matching text source in the current knowledge base — falling back to online image retrieval.'}</div>
        <div style="margin-top:14px;">
          ${localMedia.length
            ? `<div style="display:flex;gap:12px;flex-wrap:wrap;">${localMedia.map(m=>`<div style="cursor:pointer;" onclick="openCapModal('${m.id}')">${mediaPlaceholder(m.caption)}</div>`).join('')}</div>`
            : imageResultsHTML(query, 3, 'No matching images found for this recommendation')}
        </div>
      </div>`;
    }).join('')}
  `;
}

/* ---------- Tab 4 · Related Case Studies ---------- */
function capCases(plan){
  const matches = retrieveCaseStudies(plan.a.b, plan.a.drivers, 4);
  return matches.map(({cs, reasons})=>{
    const query = `${cs.name} ${cs.location}`;
    return `
    <div class="case-card">
      <div class="case-name">${cs.name}</div>
      <div class="case-loc">${cs.location}</div>
      ${imageResultsHTML(query, 3, cs.name+' — no matching images found online')}
      <div class="case-row"><b>Summary:</b> ${cs.summary}</div>
      <div class="case-row"><b>Applied Strategies:</b> ${cs.strategies.join('; ')}</div>
      <div class="case-row"><b>Lessons Learned:</b> ${cs.lessons}</div>
      <div class="case-row"><b>Why selected:</b> ${reasons.length ? reasons.join(', ') : 'general hot-arid regional precedent'}</div>
      <div class="case-row"><b>References:</b> ${cs.references.join('; ')}</div>
    </div>
  `;
  }).join('');
}


/* ---------- Tab 5 · Implementation Guide ---------- */
function capImplementation(plan){
  return plan.items.map(item=>`
    <div class="rec-card">
      ${recCardHead(item)}
      <div class="rec-meta">
        <div class="rec-meta-col"><div class="rec-meta-label">Materials Needed</div>${item.materials.map(m=>`<span class="rec-chip">${m}</span>`).join('')}</div>
        <div class="rec-meta-col"><div class="rec-meta-label">Required Expertise</div>${item.expertise.map(m=>`<span class="rec-chip">${m}</span>`).join('')}</div>
        <div class="rec-meta-col"><div class="rec-meta-label">Estimated Cost</div>${costDollars(item.cost)}</div>
        <div class="rec-meta-col"><div class="rec-meta-label">Estimated Duration</div><span class="rec-chip">${item.duration}</span></div>
        <div class="rec-meta-col"><div class="rec-meta-label">Implementation Priority</div><span class="rec-chip" style="border-color:${priorityColor(item.priority)};color:${priorityColor(item.priority)};">${item.priority}</span></div>
      </div>
    </div>
  `).join('');
}

/* ---------- Tab 6 · Warnings ---------- */
function capWarnings(plan){
  return plan.items.map(item=>`
    <div class="rec-card">
      <div class="rec-issue" style="margin-bottom:10px;">${item.issue}</div>
      <div class="caution-box">
        <b>DO NOT:</b> ${item.warning.doNot}<br>
        <b>Reason:</b> ${item.warning.reason}<br>
        <b>Potential Consequence:</b> ${item.warning.consequence}<br>
        <b>Reference:</b> ${item.warning.reference}
      </div>
    </div>
  `).join('');
}

/* ---------- Tab 7 · Evidence ---------- */
function capEvidence(plan){
  return plan.items.map(item=>`
    <div class="rec-card">
      <div class="rec-issue" style="margin-bottom:10px;">${item.issue}</div>
      ${item.evidence.length ? item.evidence.map((e,i)=>`
        <div class="rec-row" style="margin-bottom:10px;">
          <b>[${i+1}] ${e.source}</b><br>${e.text}<br>
          <span style="font-size:11px;color:var(--muted);">Confidence: ${e.matchScore} matching tag(s) · Document type: text reference chunk</span>
        </div>
      `).join('') : `<div class="rec-row" style="color:var(--muted);">No knowledge base matches for this recommendation.</div>`}
    </div>
  `).join('');
}

/* ---------- Tab 8 · Knowledge Base Explorer ---------- */
function categoryOfChunk(c){
  if(c.tags.includes('ess')) return 'Environmental / Climate Mechanisms';
  if(c.tags.includes('ois')) return 'Occupancy & Adaptive Reuse';
  if(c.tags.includes('drm') || c.tags.includes('prioritization') || c.tags.includes('monitoring') || c.tags.includes('planning')) return 'Disaster Risk Management & Monitoring';
  if(c.tags.includes('vulnerability') || c.tags.includes('intervention')) return 'Condition & Intervention Principles';
  return 'General Reference';
}
function capExplorer(){
  const groups = {};
  KNOWLEDGE_BASE.forEach(c=>{ const g = categoryOfChunk(c); (groups[g]=groups[g]||[]).push(c); });
  return `
    <div class="note">Everything indexed by HERA's RAG engine so far, organized by category. Photographs, technical drawings, case study images and material datasheets will appear here automatically once a real media library is uploaded — none are indexed yet.</div>
    ${Object.keys(groups).map(g=>`
      <div class="indicator-block">
        <div class="ihead"><span class="iname">${icon('book',16)} ${g} (${groups[g].length})</span></div>
        ${groups[g].map(c=>`
          <details style="margin-bottom:10px;">
            <summary style="cursor:pointer;font-size:13px;font-weight:600;">${c.source}</summary>
            <div class="rec-row" style="margin-top:6px;">${c.text}</div>
            <div style="margin-top:6px;">${c.tags.map(t=>`<span class="kb-tag">${t}</span>`).join('')}</div>
          </details>
        `).join('')}
      </div>
    `).join('')}
    <div class="indicator-block">
      <div class="ihead"><span class="iname">${icon('image',16)} Photographs / Drawings / Datasheets (0 local)</span></div>
      <div class="rec-row" style="color:var(--muted);">No visual or document-scan assets indexed locally yet — connect a media library to populate this section with priority local matches. In the meantime, Visual Guidance (Tab 3) and Case Studies (Tab 4) automatically fall back to live, non-AI-generated photographs from Wikimedia Commons.</div>
    </div>
  `;
}

/* ---------- Tab 9 · Interactive Image Viewer ---------- */
function capViewer(){
  return `
    <div class="note">The Interactive Image Viewer opens a large modal with caption, source, section, and the related recommendation whenever an image is clicked elsewhere in this module. No photographs are indexed yet — click any text source below to preview how the modal behaves once real images are connected.</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;">
      ${KNOWLEDGE_BASE.slice(0,6).map(c=>`<div class="rec-chip" style="cursor:pointer;padding:8px 12px;" onclick="openCapModal('${c.id}')">${c.source}</div>`).join('')}
    </div>
  `;
}

/* ---------- Router for the module ---------- */
function pagePhase2(){
  const plan = buildActionPlan(state.scenario);
  let body;
  switch(state.capTab){
    case 'implementation': body = capImplPanel(plan); break;
    case 'cases': body = capCasesGallery(plan); break;
    case 'visual': body = capVisualKBPanel(plan); break;
    case 'strategy': default: body = capStrategyPanel(plan);
  }
  return `<div class="cap-wrap">
    <div class="cap-titlebar">
      <div class="accentbar"></div>
      <h2>Conservation Action Plan</h2>
      <div class="sub">A structured, source-grounded implementation guide — ${plan.a.b.name}, ${plan.a.scenarioLabel} scenario.</div>
    </div>
    <div class="cap-layout">
      ${pinnedSummary(plan)}
      <div class="cap-main">
        ${capTabsHTML()}
        <div class="cap-panel">${body}</div>
      </div>
    </div>
  </div>${navRow(6,8)}${capModalHTML()}`;
}

const state = {
  step: 0,
  building: blankBuilding(),
  ess: {temp:24, rh:55, solar:cairoSolarDefault()},
  bcs: {materialDecay:'Moderate', crack:2, surfaceLoss:12, bioGrowth:'Limited'},
  ois: {density:1.5, visitorLoad:'Medium', eventFreq:'Weekly'},
  scenario: 'current',
  showPrompt: false,
  promptMode: 'hera',
  compareView: false,
  editingProjectId: null,
  projects: [],
  geo: {lat:null, lng:null, results:[], searching:false, fetching:false, fetched:null, elevation:null, airQuality:null, error:null, placeLabel:null, reverseLoading:false},
  capTab: 'strategy',
  capModalId: null,
  pillarModal: null,
  isOnline: isOnline(),
  imageCache: {}
};

const STEPS = ['Home','Building Info','Environmental (ESS)','Condition (BCS)','Occupancy (OIS)','Current HRI','Climate Scenarios','Conservation Action Plan'];

function go(step){ state.step = step; render(); window.scrollTo({top:0,behavior:'smooth'}); }

/* ============================== RENDER HELPERS ============================== */
function gauge(score, label, size=160){
  const r = size/2 - 14;
  const c = size/2;
  const circumference = Math.PI * r;
  const offset = circumference * (1 - score/100);
  const color = bandColor(label);
  return `
  <div class="gauge-wrap">
    <svg width="${size}" height="${size/2+20}" viewBox="0 0 ${size} ${size/2+20}">
      <path d="M14,${size/2} A${r},${r} 0 0 1 ${size-14},${size/2}" fill="none" stroke="var(--bg3)" stroke-width="14" stroke-linecap="round"/>
      <path d="M14,${size/2} A${r},${r} 0 0 1 ${size-14},${size/2}" fill="none" stroke="${color}" stroke-width="14" stroke-linecap="round"
        stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"/>
    </svg>
    <div class="gauge-score">${score.toFixed(1)}</div>
    <div class="gauge-label" style="color:${color};background:${color}22;">${label}</div>
  </div>`;
}

function barRow(name, val, weightLabel){
  const cls = classify(val, BANDS_GENERIC);
  const color = bandColor(cls.label);
  return `<div style="margin-bottom:12px;">
    <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px;">
      <span>${name}</span><span style="color:var(--muted)">${weightLabel||''} · ${val.toFixed(1)}</span>
    </div>
    <div class="barwrap"><div class="barfill" style="width:${val}%;background:${color};"></div></div>
  </div>`;
}

/* ============================== PILLAR DETAIL POPUPS ==============================
   Click a framework card on the landing to flip open a centered modal detailing
   each pillar's indicators, weightings and benchmark tables. Pure presentation —
   the numbers mirror the scoring in data/formulas.js. */
const PILLAR_DETAIL = {
  ess:{ code:'ESS', layer:'Hazard', name:'Environmental Stress Score',
    intro:'The climate load acting on the historic fabric — measured today and re-projected under IPCC AR6 SSP pathways.',
    weightNote:'Three indicators, equally weighted at 33.3% each.',
    indicators:[
      {name:'Indoor Temperature', unit:'°C', weight:'33.3%', optimal:'20–24', acceptable:'18–27', critical:'outside 18–27'},
      {name:'Relative Humidity', unit:'%', weight:'33.3%', optimal:'40–60', acceptable:'30–70', critical:'outside 30–70'},
      {name:'Solar Radiation', unit:'W/m²', weight:'33.3%', optimal:'< 200', acceptable:'200–500', critical:'> 500'}
    ]},
  bcs:{ code:'BCS', layer:'Vulnerability', name:'Building Condition Score',
    intro:'How susceptible the building already is — the measured condition of the historic fabric itself.',
    weightNote:'Four indicators, weighted by structural significance.',
    indicators:[
      {name:'Material Decay', unit:'category', weight:'40%', optimal:'None', acceptable:'Minor', critical:'Moderate–Severe'},
      {name:'Cracking width', unit:'mm', weight:'30%', optimal:'≤ 1', acceptable:'1–3', critical:'> 5'},
      {name:'Surface Loss', unit:'% area', weight:'20%', optimal:'≤ 5', acceptable:'5–15', critical:'> 30'},
      {name:'Biological Growth', unit:'category', weight:'10%', optimal:'None', acceptable:'Limited', critical:'Moderate–Severe'}
    ]},
  ois:{ code:'OIS', layer:'Exposure', name:'Occupancy Impact Score',
    intro:'The operational pressure of adaptive reuse — visitor and event load acting on the building.',
    weightNote:'Three indicators, equally weighted at 33.3% each.',
    indicators:[
      {name:'Occupancy Density', unit:'persons/m²', weight:'33.3%', optimal:'≤ 1', acceptable:'1–2', critical:'> 3'},
      {name:'Visitor Load', unit:'category', weight:'33.3%', optimal:'Low', acceptable:'Medium', critical:'High–Excessive'},
      {name:'Event Frequency', unit:'category', weight:'33.3%', optimal:'Monthly', acceptable:'Weekly', critical:'Several/wk–Daily'}
    ]},
  hri:{ code:'HRI', layer:'Risk Index', name:'Heritage Risk Index',
    intro:'The three assessed dimensions combined into a single 0–100 risk score — hazard and vulnerability weighted highest, per the framework\'s risk model.',
    weightNote:'HRI = 0.40·ESS + 0.40·BCS + 0.20·OIS',
    indicators:[
      {name:'Environmental Stress', unit:'ESS · hazard', weight:'40%', optimal:'0–20', acceptable:'21–60', critical:'61–100'},
      {name:'Building Condition', unit:'BCS · vulnerability', weight:'40%', optimal:'0–20', acceptable:'21–60', critical:'61–100'},
      {name:'Occupancy Impact', unit:'OIS · exposure', weight:'20%', optimal:'0–20', acceptable:'21–60', critical:'61–100'}
    ]}
};
const PILLAR_REFERENCES = [
  'Elmezayen, M. (2026). An AI-Assisted Heritage Risk Assessment and Decision-Support Framework — MSc Thesis Proposal, GIU.',
  'IPCC (2021–2023). Sixth Assessment Report (AR6) — SSP climate scenario pathways.',
  'UNESCO. Managing Disaster Risks for World Heritage — risk = hazard × vulnerability × exposure.',
  'Cairo solar radiation climatology — en.tutiempo.net/solar-radiation/cairo.html.'
];
const RISK_BANDS_DISPLAY = [
  {range:'0–20', label:'Very Low', priority:'Routine Monitoring'},
  {range:'21–40', label:'Low', priority:'Scheduled Maintenance'},
  {range:'41–60', label:'Moderate', priority:'Preventive Conservation'},
  {range:'61–80', label:'High', priority:'Conservation Upgrade'},
  {range:'81–100', label:'Critical', priority:'Immediate Intervention'}
];
function pillarModalHTML(){
  const id = state.pillarModal; if(!id) return '';
  const d = PILLAR_DETAIL[id]; if(!d) return '';
  return `<div class="modal-overlay pillar-overlay" onclick="if(event.target===this)closePillar()">
    <div class="flip-modal"><div class="flip-face">
      <div class="pill-head">
        <div><span class="pill-code">${d.code} · ${d.layer}</span><h3>${d.name}</h3></div>
        <button class="ghost pill-x" onclick="closePillar()">${icon('close',16)}</button>
      </div>
      <p class="pill-intro">${d.intro} <span class="pill-note-inline">${d.weightNote}</span></p>
      <div class="pill-cols">
        <div>
          <div class="pill-sub">${id==='hri'?'Components & weightings':'Indicators, weightings & benchmarks'}</div>
          <table class="detail-table">
            <thead><tr><th>${id==='hri'?'Component':'Indicator'}</th><th>Weight</th><th>Optimal</th><th>Acceptable</th><th>Critical</th></tr></thead>
            <tbody>${d.indicators.map(i=>`<tr>
              <td class="in">${i.name}<span class="uu">${i.unit}</span></td>
              <td class="w">${i.weight}</td>
              <td class="ok">${i.optimal}</td>
              <td class="mid">${i.acceptable}</td>
              <td class="bad">${i.critical}</td></tr>`).join('')}</tbody>
          </table>
        </div>
        <div>
          <div class="pill-sub">Score classification · 0–100</div>
          <table class="detail-table bands">
            <thead><tr><th>Score</th><th>Band</th><th>Conservation priority</th></tr></thead>
            <tbody>${RISK_BANDS_DISPLAY.map(bd=>`<tr>
              <td class="w">${bd.range}</td>
              <td><span class="band-dot" style="background:${bandColor(bd.label)}"></span>${bd.label}</td>
              <td>${bd.priority}</td></tr>`).join('')}</tbody>
          </table>
        </div>
      </div>
      <details class="pill-refs">
        <summary>${icon('book',14)} References</summary>
        <ul>${PILLAR_REFERENCES.map(r=>`<li>${r}</li>`).join('')}</ul>
      </details>
    </div></div>
  </div>`;
}
function openPillar(id){ state.pillarModal = id; render(); }
function closePillar(){ state.pillarModal = null; render(); }

/* ---------- Landing → assessment transition ---------- */
function startAssessment(){
  const ov = document.createElement('div');
  ov.className = 'route-transition';
  ov.innerHTML = `<span class="rt-word">HERA</span>`;
  document.body.appendChild(ov);
  requestAnimationFrame(()=>ov.classList.add('active'));
  setTimeout(()=>{ newAssessment(); }, 480);            // swap to assessment under the cover
  setTimeout(()=>{ ov.classList.add('out'); }, 640);    // lift the cover to reveal
  setTimeout(()=>{ ov.remove(); }, 1120);
}

/* ============================== BUILDING IMAGES ==============================
   Sourced two ways: (1) manual uploads stored as data URLs on state.building.images,
   or (2) an automatic Wikimedia Commons lookup by building name (reusing the existing
   getImages cache/retrieval). Manual uploads take priority when present. */
function collectBuildingImages(b){
  if(b.images && b.images.length){
    return {status:'ready', list:b.images.map((im,i)=>({url:im.url, caption:im.name||`${b.name} — image ${i+1}`, link:null}))};
  }
  const q = `${b.name||''} ${b.location||''}`.trim();
  if(!q) return {status:'empty', list:[]};
  const entry = getImages(q, 6);
  if(entry.status==='ready') return {status:'ready', list:entry.images.map(im=>({url:im.thumbUrl, caption:im.title, link:im.descriptionUrl}))};
  return {status:entry.status, list:[]};
}
function addBuildingImages(input){
  const files = Array.from(input.files||[]);
  if(!files.length) return;
  state.building.images = state.building.images || [];
  let pending = files.length;
  files.forEach(f=>{
    const rd = new FileReader();
    rd.onload = ()=>{ state.building.images.push({url:rd.result, name:f.name.replace(/\.[a-z0-9]+$/i,'')}); if(--pending===0) render(); };
    rd.onerror = ()=>{ if(--pending===0) render(); };
    rd.readAsDataURL(f);
  });
}
function removeBuildingImage(i){ if(state.building.images) state.building.images.splice(i,1); render(); }

/* ---------- Hover / button scrollers for image strips ---------- */
let _stripRAF = null;
function stripHoverStart(id, dir){
  const el = document.getElementById(id); if(!el) return;
  cancelAnimationFrame(_stripRAF);
  const tick = ()=>{ el.scrollLeft += dir*6; _stripRAF = requestAnimationFrame(tick); };
  tick();
}
function stripHoverStop(){ cancelAnimationFrame(_stripRAF); _stripRAF = null; }
function stripStep(id, dir){ const el = document.getElementById(id); if(el) el.scrollBy({left: dir*Math.min(el.clientWidth, 340), behavior:'smooth'}); }

/* ============================== CAP · PINNED SUMMARY ============================== */
function pinnedSummary(plan){
  const {a, criticalIndicators} = plan;
  const b = a.b;
  const imgs = collectBuildingImages(b);
  const color = bandColor(a.hriCls.label);
  let gallery;
  if(imgs.status==='ready' && imgs.list.length){
    gallery = `<div class="pin-track" id="pinTrack">${imgs.list.map(im=>`
      <figure class="pin-slide"><img src="${im.url}" alt="${(im.caption||'').replace(/"/g,'&quot;')}" loading="lazy" onerror="this.closest('.pin-slide').remove()"><figcaption>${im.caption||''}</figcaption></figure>`).join('')}</div>
      ${imgs.list.length>1?`
        <div class="pin-arrow left" onmouseenter="stripHoverStart('pinTrack',-1)" onmouseleave="stripHoverStop()" onclick="stripStep('pinTrack',-1)">${icon('arrowLeft',18)}</div>
        <div class="pin-arrow right" onmouseenter="stripHoverStart('pinTrack',1)" onmouseleave="stripHoverStop()" onclick="stripStep('pinTrack',1)">${icon('arrowRight',18)}</div>`:''}`;
  } else {
    const msg = imgs.status==='loading' ? 'Searching Wikimedia Commons…'
      : imgs.status==='offline' ? 'Offline — add images in Building Info'
      : (!b.name ? 'Add a building name to fetch images' : 'No images found — add your own in Building Info');
    gallery = `<div class="pin-empty">${icon('image',30)}<span>${msg}</span></div>`;
  }
  return `<aside class="cap-pin">
    <div class="pin-gallery">${gallery}</div>
    <div class="pin-body">
      <div class="pin-title">${b.name||'Untitled building'}</div>
      <div class="pin-loc">${icon('pin',13)} ${b.location||'—'}</div>
      <div class="pin-hri">
        <div class="pin-score" style="color:${color}">${a.hri.toFixed(1)}</div>
        <div class="pin-hri-meta">
          <span class="pin-band" style="background:${color}1f;color:${color}">${a.hriCls.label} Risk</span>
          <span class="pin-pri">${a.hriCls.priority}</span>
        </div>
      </div>
      <div class="pin-rows">
        <div class="pin-row"><span>Scenario</span><b>${a.scenarioLabel}</b></div>
        <div class="pin-row"><span>Dominant driver</span><b>${a.drivers.join(' + ')}</b></div>
        <div class="pin-row"><span>Adaptive reuse</span><b>${b.use||'—'}</b></div>
        <div class="pin-row"><span>Material</span><b>${b.material||'—'}</b></div>
      </div>
      <div class="pin-crit">
        <div class="pin-crit-h">Critical indicators · ${criticalIndicators.length}</div>
        ${criticalIndicators.length
          ? `<div class="pin-chips">${criticalIndicators.map(ci=>`<span class="rec-chip" style="border-color:${ci.color};color:${ci.color}">${ci.name} · ${ci.score.toFixed(1)}</span>`).join('')}</div>`
          : `<span class="pin-none">None above the Moderate threshold</span>`}
      </div>
    </div>
  </aside>`;
}

/* ---------- Merged CAP panels ---------- */
function capStrategyPanel(plan){
  return `${capStrategy(plan)}
    <div class="future-block">
      <h2 style="font-size:17px;">Evidence &amp; Sources</h2>
      <div class="sub" style="margin-bottom:10px;">Knowledge base passages matched to each recommendation, with confidence.</div>
      ${capEvidence(plan)}
    </div>`;
}
function capImplPanel(plan){
  return `${capImplementation(plan)}
    <div class="future-block">
      <h2 style="font-size:17px;">Cautions &amp; Do-Nots</h2>
      <div class="sub" style="margin-bottom:10px;">Incompatible treatments to avoid for each issue, with the reason and consequence.</div>
      ${capWarnings(plan)}
    </div>`;
}
function capVisualKBPanel(plan){
  return `${capVisual(plan)}
    <div class="future-block">
      <h2 style="font-size:17px;">Knowledge Base Explorer</h2>
      <div class="sub" style="margin-bottom:10px;">Everything indexed by HERA's RAG engine so far, organized by category.</div>
      ${capExplorer()}
    </div>`;
}

/* ---------- Case Studies gallery (Gallery4-style carousel, themed) ---------- */
function capCasesGallery(plan){
  const matches = retrieveCaseStudies(plan.a.b, plan.a.drivers, 5);
  return `
    <div class="gal-head">
      <div><span class="eyebrow">Precedents</span><h3 class="gal-title">Related case studies</h3></div>
      <div class="gal-nav">
        <button class="gal-btn" onclick="stripStep('galTrack',-1)" aria-label="Previous">${icon('arrowLeft',18)}</button>
        <button class="gal-btn" onclick="stripStep('galTrack',1)" aria-label="Next">${icon('arrowRight',18)}</button>
      </div>
    </div>
    <div class="gal-track" id="galTrack">
      ${matches.map(({cs, reasons})=>{
        const entry = getImages(`${cs.name} ${cs.location}`, 1);
        const img = (entry.status==='ready' && entry.images.length) ? entry.images[0].thumbUrl : null;
        return `<article class="gal-card">
          <div class="gal-media">
            ${img ? `<img src="${img}" alt="${cs.name}" loading="lazy" onerror="this.remove()">` : `<div class="gal-ph">${icon('landmark',34)}</div>`}
            <div class="gal-scrim"></div>
            <div class="gal-cap">
              <div class="gal-loc">${cs.location}</div>
              <div class="gal-name">${cs.name}</div>
              <p class="gal-desc">${cs.summary}</p>
              <div class="gal-why">${reasons.length ? reasons.join(' · ') : 'regional hot-arid precedent'}</div>
            </div>
          </div>
        </article>`;
      }).join('')}
    </div>
    <div class="gal-foot">Photographs retrieved live from Wikimedia Commons, matched to each precedent — no AI-generated imagery.</div>`;
}

/* ---------- Scroll-reveal observer (landing) ---------- */
let _revealObs = null;
function setupReveals(){
  if(_revealObs) _revealObs.disconnect();
  const els = document.querySelectorAll('.reveal');
  if(!els.length || typeof IntersectionObserver === 'undefined'){ els.forEach(el=>el.classList.add('in')); return; }
  _revealObs = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); _revealObs.unobserve(e.target); } });
  }, {threshold:0.12, rootMargin:'0px 0px -8% 0px'});
  els.forEach(el=>_revealObs.observe(el));
}

/* ---------- Sidebar rail (persistent step navigation) ---------- */
function sidebarHTML(){
  const steps = STEPS.map((s,i)=>{
    const active = !state.compareView && i===state.step;
    const done = !state.compareView && i<state.step;
    return `<button class="side-step ${active?'active':(done?'done':'')}" onclick="state.compareView=false;go(${i})" title="${s}">
      <span class="ic">${icon(STEP_ICONS[i],16)}</span>
      <span class="tx"><span class="k">Step ${i}</span><span class="l">${s}</span></span>
    </button>`;
  }).join('');
  return `<aside class="sidebar"><div class="side-panel">
    <div class="side-brand">
      <span class="side-mono">H</span>
      <span class="bt"><span class="nm">HERA</span><span class="sub">Heritage Risk Assessment<br>& Decision Support</span></span>
    </div>
    <div class="side-eyebrow">Assessment Workflow</div>
    <nav class="side-steps">${steps}</nav>
    <div class="side-foot">
      <button class="side-compare ${state.compareView?'active':''}" onclick="toggleCompare()">
        <span class="sc-ic">${icon('compare',16)}</span>
        <span class="sc-tx">${state.compareView ? 'Back to Assessment' : 'Compare Buildings'}</span>
        ${!state.compareView && state.projects.length ? `<span class="cnt">${state.projects.length}</span>` : ''}
      </button>
      <div class="side-cred">Prototype v1.3 · Mariam Elmezayen · GIU</div>
    </div>
  </div></aside>`;
}

/* ---------- Slim contextual topbar inside the content column ---------- */
function header(){
  const kicker = state.compareView ? 'Portfolio' : (state.step===0 ? 'Overview' : `Step ${state.step} of ${STEPS.length-1}`);
  const title = state.compareView ? 'Building Comparison' : STEPS[state.step];
  return `<div class="topbar">
    <div class="kicker"><span class="k">${kicker}</span><span class="t">${title}</span></div>
  </div>`;
}

function toggleCompare(){ state.compareView = !state.compareView; render(); window.scrollTo({top:0,behavior:'smooth'}); }

function newAssessment(){
  state.building = blankBuilding();
  state.ess = {temp:24, rh:55, solar:cairoSolarDefault()};
  state.bcs = {materialDecay:'Moderate', crack:2, surfaceLoss:12, bioGrowth:'Limited'};
  state.ois = {density:1.5, visitorLoad:'Medium', eventFreq:'Weekly'};
  state.scenario = 'current';
  state.editingProjectId = null;
  state.compareView = false;
  go(1);
}

function saveCurrentProject(){
  const essR = computeESS(state.ess), bcsR = computeBCS(state.bcs), oisR = computeOIS(state.ois);
  const hri = computeHRI(essR.score, bcsR.score, oisR.score);
  const cls = classify(hri, HRI_TABLE);
  const id = state.editingProjectId || ('p'+Date.now());
  const snapshot = {
    id,
    building: JSON.parse(JSON.stringify(state.building)),
    ess: JSON.parse(JSON.stringify(state.ess)),
    bcs: JSON.parse(JSON.stringify(state.bcs)),
    ois: JSON.parse(JSON.stringify(state.ois)),
    ess_score: essR.score, bcs_score: bcsR.score, ois_score: oisR.score,
    hri, band: cls.label, priority: cls.priority
  };
  const idx = state.projects.findIndex(p=>p.id===id);
  if(idx>=0) state.projects[idx] = snapshot; else state.projects.push(snapshot);
  state.editingProjectId = id;
  render();
}

function loadProject(id){
  const p = state.projects.find(p=>p.id===id);
  if(!p) return;
  state.building = JSON.parse(JSON.stringify(p.building));
  state.ess = JSON.parse(JSON.stringify(p.ess));
  state.bcs = JSON.parse(JSON.stringify(p.bcs));
  state.ois = JSON.parse(JSON.stringify(p.ois));
  state.editingProjectId = id;
  state.compareView = false;
  go(5);
}

function removeProject(id){
  state.projects = state.projects.filter(p=>p.id!==id);
  render();
}

/* ============================== PAGES ============================== */
/* ---------- Cinematic landing (step 0, full-bleed, no sidebar) ---------- */
function heroRoute(){
  // Wadi-Rum-style trek line: the assessment pipeline as an expedition route.
  const nodes = [
    {x:24,  y:168, n:'01', l:'ESS', d:'Environmental'},
    {x:132, y:74,  n:'02', l:'BCS', d:'Condition'},
    {x:236, y:132, n:'03', l:'OIS', d:'Occupancy'},
    {x:320, y:52,  n:'04', l:'HRI', d:'Risk Index'}
  ];
  const dots = nodes.map(p=>`
    <circle cx="${p.x}" cy="${p.y}" r="11" fill="none" stroke="rgba(255,255,255,.35)"/>
    <circle cx="${p.x}" cy="${p.y}" r="4.5" fill="#fff"/>
    <text x="${p.x+16}" y="${p.y-4}" fill="#fff" font-size="12" class="wp-label">${p.n} · ${p.l}</text>
    <text x="${p.x+16}" y="${p.y+10}" fill="rgba(255,255,255,.7)" font-size="10" class="wp-day">${p.d}</text>
  `).join('');
  return `<div class="hero-route" aria-hidden="true">
    <svg viewBox="0 0 360 210" fill="none">
      <path d="M24,168 C78,132 74,74 132,74 C186,74 188,140 236,132 C286,124 300,84 320,52"
        stroke="rgba(255,255,255,.5)" stroke-width="1.6" stroke-dasharray="4 6" stroke-linecap="round"/>
      ${dots}
    </svg>
  </div>`;
}

function pageHome(){
  const n = state.projects.length;
  return `<div class="landing">
    <nav class="landing-nav lnav">
      <div class="lnav-brand"><span class="mark">${icon('landmark',20)}</span><span class="nm">HERA</span></div>
      <div class="lnav-links">
        <button class="lnav-link" onclick="document.getElementById('framework').scrollIntoView({behavior:'smooth'})">The Framework</button>
        <button class="lnav-link" onclick="toggleCompare()">Compare${n?` · ${n}`:''}</button>
        <button class="lnav-cta" onclick="startAssessment()">${icon('arrowRight',15)} Start Assessment</button>
      </div>
    </nav>

    <header class="hero-cine">
      <video class="hero-video" autoplay muted loop playsinline preload="auto" poster="">
        <source src="/hero.mp4" type="video/mp4">
      </video>
      <div class="hero-scrim"></div>
      <div class="hero-inner">
        <div class="hero-left">
          <span class="hero-eyebrow"><span class="ew">AI-Assisted · Heritage Risk &amp; Decision Support</span></span>
          <h1><span class="hl"><span class="hw">Assess. Adapt.</span></span><span class="hl"><span class="hw"><em>Preserve.</em></span></span></h1>
          <div class="hero-meta">
            <span>MSc Thesis · GIU · 2026</span>
          </div>
        </div>
        ${heroRoute()}
      </div>
      <div class="hero-pager"><span class="cur">01</span><span class="track"></span><span>04</span></div>
    </header>

    <section class="landing-intro" id="about">
      <div class="intro-wrap reveal">
        <span class="eyebrow">What is HERA</span>
        <h2 id="twTarget" class="tw"><span class="tw-caret"></span></h2>
        <p class="tw-after">HERA reads environmental stress, building condition and occupancy into a single Heritage Risk
        Index — projected forward under IPCC climate scenarios — and turns that score into a prioritized,
        source-grounded conservation plan for adaptive-reuse heritage buildings.</p>
        <button class="btn-solid tw-after" onclick="startAssessment()"><span>Start Assessment</span> ${icon('arrowRight',17)}</button>
      </div>
    </section>

    <section class="landing-body" id="framework">
      <div class="ghost-word">HERITAGE</div>
      <div class="wrap">
        <div class="section-head reveal">
          <span class="eyebrow">The Framework</span>
          <h2>Four measures, one <em>defensible</em> index.</h2>
          <p>HERA layers three assessed dimensions into a single Heritage Risk Index, then translates that
          score into a concrete, source-grounded conservation response — not generic advice.</p>
        </div>
        ${n ? `<div class="note" style="margin-bottom:26px;"><b>${n} building${n>1?'s':''}</b> saved for comparison. Open <b>Compare buildings</b> to see which needs intervention first.</div>` : ''}
        <div class="frame-grid">
          <div class="frame-card reveal flip-card" onclick="openPillar('ess')" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openPillar('ess')}">
            <div class="fico">${icon('thermometer',26)}</div>
            <div class="fnum">01</div><div class="frule"></div>
            <div class="ftag">ESS · Hazard</div>
            <h3>Environmental Stress</h3>
            <p>Temperature, relative humidity and solar radiation — the climate load acting on the fabric.</p>
            <span class="flip-hint">${icon('search',13)} Indicators &amp; benchmarks</span>
          </div>
          <div class="frame-card reveal flip-card" onclick="openPillar('bcs')" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openPillar('bcs')}">
            <div class="fico">${icon('layers',26)}</div>
            <div class="fnum">02</div><div class="frule"></div>
            <div class="ftag">BCS · Vulnerability</div>
            <h3>Building Condition</h3>
            <p>Material decay, cracking, surface loss and biological growth — how susceptible the building is.</p>
            <span class="flip-hint">${icon('search',13)} Indicators &amp; benchmarks</span>
          </div>
          <div class="frame-card reveal flip-card" onclick="openPillar('ois')" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openPillar('ois')}">
            <div class="fico">${icon('users',26)}</div>
            <div class="fnum">03</div><div class="frule"></div>
            <div class="ftag">OIS · Exposure</div>
            <h3>Occupancy Impact</h3>
            <p>Density, visitor load and event frequency — the operational pressure of adaptive reuse.</p>
            <span class="flip-hint">${icon('search',13)} Indicators &amp; benchmarks</span>
          </div>
          <div class="frame-card reveal flip-card" onclick="openPillar('hri')" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openPillar('hri')}">
            <div class="fico">${icon('gauge',26)}</div>
            <div class="fnum">04</div><div class="frule"></div>
            <div class="ftag">HRI · Risk Index</div>
            <h3>Heritage Risk Index</h3>
            <p>The three measures combined into one 0–100 score — 0.40·ESS + 0.40·BCS + 0.20·OIS.</p>
            <span class="flip-hint">${icon('search',13)} Weightings &amp; classification</span>
          </div>
          <div class="frame-card wide o5 reveal">
            <div class="fw-l">
              <div class="ftag">05 · Climate Scenarios → Future HRI</div>
              <h3>What will the risk be in 2100?</h3>
              <p>The Current HRI is projected through IPCC AR6 climate pathways: each scenario shifts
              temperature, humidity and solar radiation, which drives a projected environmental stress and,
              in turn, a projected building condition — yielding the <b>Future HRI</b>. A rule-based expert
              layer then briefly translates that score into a conservation strategy.</p>
              <div class="o5-flow">
                <span class="o5-chip">Current HRI</span><span class="o5-arr">→</span>
                <span class="o5-chip alt">SSP2-4.5 · SSP5-8.5</span><span class="o5-arr">→</span>
                <span class="o5-chip">Projected T · RH · Solar</span><span class="o5-arr">→</span>
                <span class="o5-chip">Projected ESS → BCS</span><span class="o5-arr">→</span>
                <span class="o5-chip strong">Future HRI</span><span class="o5-arr">→</span>
                <span class="o5-chip">Strategy</span>
              </div>
            </div>
            <button class="btn-hero" onclick="startAssessment()">Start with a building ${icon('arrowRight',17)}</button>
          </div>
        </div>
      </div>
    </section>
    ${pillarModalHTML()}
  </div>`;
}

function pageBuilding(){
  const b = state.building;
  const categories = ['Palace','Villa','Landmark Building','Religious Building','Public/Civic Building','Other'];
  const materials = ['Limestone','Limestone + Brick','Brick Masonry','Reinforced Concrete (early)','Other'];
  const uses = ['Museum','Cultural Center','Administrative','Educational','Mixed Use','Vacant / Unused','Other'];
  return `<div class="card">
    <div class="accentbar"></div>
    <h2>Building Information</h2>
    <div class="sub">Think of this like opening a project file — defines scope for this adaptive reuse heritage building.</div>
    <div class="grid">
      <div class="field"><label>Building Name</label><input type="text" value="${b.name}" oninput="state.building.name=this.value"></div>
      <div class="field"><label>Location</label><input type="text" value="${b.location}" oninput="state.building.location=this.value"></div>
      <div class="field"><label>Construction Year</label><input type="number" value="${b.year}" oninput="state.building.year=this.value;state.building.era=eraFromYear(this.value)" onchange="render()"></div>
      <div class="field">
        <label>Building Category</label>
        <select class="iselect" onchange="state.building.category=this.value">
          ${categories.map(o=>`<option ${b.category===o?'selected':''}>${o}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Architectural Era</label>
        <input type="text" value="${b.era}" readonly style="opacity:.75;cursor:not-allowed;">
        <span class="hint">Auto-derived from construction year</span>
      </div>
      <div class="field">
        <label>Construction Material</label>
        <select class="iselect" onchange="state.building.material=this.value">
          ${materials.map(o=>`<option ${b.material===o?'selected':''}>${o}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Adaptive Reuse / Current Use</label>
        <select class="iselect" onchange="state.building.use=this.value">
          ${uses.map(o=>`<option ${b.use===o?'selected':''}>${o}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>Current Occupancy</label><input type="text" placeholder="e.g. staff & daily visitor count" value="${b.occupancy}" oninput="state.building.occupancy=this.value"></div>
    </div>

    <div class="field" style="margin-top:6px;">
      <label>Building Images <span class="hint" style="font-weight:400;">— shown in the Conservation Action Plan summary</span></label>
      <div class="img-upload">
        <label class="img-upload-btn">${icon('image',16)} Upload images<input type="file" accept="image/*" multiple style="display:none" onchange="addBuildingImages(this)"></label>
        <span class="img-upload-note">Optional — if left empty, HERA searches Wikimedia Commons for “<b>${b.name||'building name'}</b>”.</span>
      </div>
      ${(b.images && b.images.length) ? `<div class="img-thumbs">${b.images.map((im,i)=>`
        <span class="img-thumb"><img src="${im.url}" alt=""><button title="Remove" onclick="removeBuildingImage(${i})">${icon('close',12)}</button></span>`).join('')}</div>` : ''}
    </div>

    <div class="note"><b>Scope note:</b> This framework targets late Khedival/Colonial-era load-bearing masonry buildings (1880–1940) in Egypt's hot-arid climate — see your era-boundary rationale slide for the full justification.</div>
  </div>${navRow(0,2)}`;
}

function pageESS(){
  const i = state.ess;
  const r = computeESS(i);
  const cls = classify(r.score, BANDS_GENERIC);
  return `<div class="card">
    <div class="accentbar"></div>
    <h2>Environmental Stress Assessment (ESS)</h2>
    <div class="sub">Hazard layer — equal weighting (33.3% each) across all three indicators.</div>

    ${geoPanel()}

    <div class="indicator-block">
      <div class="ihead"><span class="iname">Indoor Temperature</span><span class="iweight">33.3%</span></div>
      <input type="number" value="${i.temp}" oninput="state.ess.temp=parseFloat(this.value)||0" onchange="render()">
      <div class="badge-row"><span class="badge">Optimal 20–24°C</span><span class="badge">Acceptable 18–27°C</span><span class="badge">Critical outside</span></div>
    </div>
    <div class="indicator-block">
      <div class="ihead"><span class="iname">Relative Humidity (%)</span><span class="iweight">33.3%</span></div>
      <input type="number" value="${i.rh}" oninput="state.ess.rh=parseFloat(this.value)||0;render()">
      <div class="badge-row"><span class="badge">Optimal 40–60%</span><span class="badge">Acceptable 30–70%</span><span class="badge">Critical outside</span></div>
    </div>
    <div class="indicator-block">
      <div class="ihead"><span class="iname">Solar Radiation (W/m²)</span><span class="iweight">33.3%</span></div>
      <input type="number" value="${i.solar}" oninput="state.ess.solar=parseFloat(this.value)||0;render()">
      <div class="badge-row"><span class="badge">Optimal &lt;200</span><span class="badge">Acceptable 200–500</span><span class="badge">Critical &gt;500</span></div>
    </div>

    <div style="display:flex;align-items:center;gap:32px;margin-top:24px;flex-wrap:wrap;">
      ${gauge(r.score, cls.label)}
      <div style="flex:1;min-width:220px;">
        ${barRow('Temperature', r.parts.Temperature)}
        ${barRow('Humidity', r.parts.Humidity)}
        ${barRow('Solar Radiation', r.parts.Solar)}
      </div>
    </div>
  </div>${navRow(1,3)}`;
}

function pageBCS(){
  const i = state.bcs;
  const r = computeBCS(i);
  const cls = classify(r.score, BANDS_BCS);
  const catOpts = ['None','Minor','Moderate','Severe'];
  const catOptsBG = ['None','Limited','Moderate','Severe'];
  return `<div class="card">
    <div class="accentbar"></div>
    <h2>Building Condition Assessment (BCS)</h2>
    <div class="sub">Vulnerability layer — weighted: Material Decay 40% · Cracking 30% · Surface Loss 20% · Biological Growth 10%.</div>

    <div class="twocol">
      <div class="indicator-block">
        <div class="ihead"><span class="iname">Material Decay</span><span class="iweight">40%</span></div>
        <select class="iselect" onchange="state.bcs.materialDecay=this.value;render()">
          ${catOpts.map(o=>`<option ${i.materialDecay===o?'selected':''}>${o}</option>`).join('')}
        </select>
      </div>
      <div class="indicator-block">
        <div class="ihead"><span class="iname">Cracking — Width (mm)</span><span class="iweight">30%</span></div>
        <input type="number" step="0.1" value="${i.crack}" oninput="state.bcs.crack=parseFloat(this.value)||0;render()">
      </div>
      <div class="indicator-block">
        <div class="ihead"><span class="iname">Surface Loss (% area)</span><span class="iweight">20%</span></div>
        <input type="number" value="${i.surfaceLoss}" oninput="state.bcs.surfaceLoss=parseFloat(this.value)||0;render()">
      </div>
      <div class="indicator-block">
        <div class="ihead"><span class="iname">Biological Growth</span><span class="iweight">10%</span></div>
        <select class="iselect" onchange="state.bcs.bioGrowth=this.value;render()">
          ${catOptsBG.map(o=>`<option ${i.bioGrowth===o?'selected':''}>${o}</option>`).join('')}
        </select>
      </div>
    </div>

    <div style="display:flex;align-items:center;gap:32px;margin-top:12px;flex-wrap:wrap;">
      ${gauge(r.score, cls.label)}
      <div style="flex:1;min-width:220px;">
        ${barRow('Material Decay', r.parts.MaterialDecay)}
        ${barRow('Cracking', r.parts.Cracking)}
        ${barRow('Surface Loss', r.parts.SurfaceLoss)}
        ${barRow('Biological Growth', r.parts.BiologicalGrowth)}
      </div>
    </div>
  </div>${navRow(2,4)}`;
}

function pageOIS(){
  const i = state.ois;
  const r = computeOIS(i);
  const cls = classify(r.score, BANDS_GENERIC);
  return `<div class="card">
    <div class="accentbar"></div>
    <h2>Occupancy Impact Assessment (OIS)</h2>
    <div class="sub">Exposure layer — equal weighting (33.3% each), non-climatic operational stressor.</div>

    <div class="indicator-block">
      <div class="ihead"><span class="iname">Occupancy Density (persons/m²)</span><span class="iweight">33.3%</span></div>
      <input type="number" step="0.1" value="${i.density}" oninput="state.ois.density=parseFloat(this.value)||0;render()">
    </div>
    <div class="indicator-block">
      <div class="ihead"><span class="iname">Visitor Load</span><span class="iweight">33.3%</span></div>
      <select class="iselect" onchange="state.ois.visitorLoad=this.value;render()">
        ${['Low','Medium','High','Excessive'].map(o=>`<option ${i.visitorLoad===o?'selected':''}>${o}</option>`).join('')}
      </select>
    </div>
    <div class="indicator-block">
      <div class="ihead"><span class="iname">Event Frequency</span><span class="iweight">33.3%</span></div>
      <select class="iselect" onchange="state.ois.eventFreq=this.value;render()">
        ${['Monthly','Weekly','Several/week','Daily'].map(o=>`<option ${i.eventFreq===o?'selected':''}>${o}</option>`).join('')}
      </select>
    </div>

    <div style="display:flex;align-items:center;gap:32px;margin-top:12px;flex-wrap:wrap;">
      ${gauge(r.score, cls.label)}
      <div style="flex:1;min-width:220px;">
        ${barRow('Occupancy Density', r.parts.OccupancyDensity)}
        ${barRow('Visitor Load', r.parts.VisitorLoad)}
        ${barRow('Event Frequency', r.parts.EventFrequency)}
      </div>
    </div>
  </div>${navRow(3,5)}`;
}

function pageResults(){
  const essR = computeESS(state.ess), bcsR = computeBCS(state.bcs), oisR = computeOIS(state.ois);
  const hri = computeHRI(essR.score, bcsR.score, oisR.score);
  const hriCls = classify(hri, HRI_TABLE);
  return `<div class="card">
    <div class="accentbar"></div>
    <h2>Current Heritage Risk Index</h2>
    <div class="sub">${state.building.name} — ${state.building.location}</div>

    <div class="score-row">
      ${scoreCard('ESS', essR.score, BANDS_GENERIC)}
      ${scoreCard('BCS', bcsR.score, BANDS_BCS)}
      ${scoreCard('OIS', oisR.score, BANDS_GENERIC)}
    </div>

    <div class="hri-banner">
      <div>
        <div style="font-size:12px;color:var(--muted);letter-spacing:.5px;">HRI = 0.40×ESS + 0.40×BCS + 0.20×OIS</div>
        <div class="big">${hri.toFixed(1)}</div>
      </div>
      <div style="text-align:right;">
        <div class="tag" style="background:${bandColor(hriCls.label)}22;color:${bandColor(hriCls.label)};">${hriCls.label} Risk</div>
        <div style="font-size:13px;color:var(--muted);margin-top:8px;">→ ${hriCls.priority}</div>
      </div>
    </div>

    <div class="future-block" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
      <div style="font-size:13px;color:var(--muted);max-width:420px;">Working on several heritage buildings at once? Save this assessment to compare risk across all of them and see which needs intervention first.</div>
      <button class="primary" onclick="saveCurrentProject()">${icon('save',16)} ${state.editingProjectId ? 'Update in Comparison' : 'Save to Comparison'}</button>
    </div>
    ${state.editingProjectId ? `<div class="note">Saved as part of your comparison set. <a href="#" onclick="toggleCompare();return false;" style="color:var(--purple2);">View Comparison →</a></div>` : ''}
  </div>${navRow(4,6)}`;
}

function scoreCard(label, val, table){
  const cls = classify(val, table);
  const color = bandColor(cls.label);
  return `<div class="score-card">
    <div class="label">${label}</div>
    <div class="val">${val.toFixed(1)}</div>
    <div class="cls" style="color:${color}">${cls.label}</div>
    <div class="barwrap"><div class="barfill" style="width:${val}%;background:${color};"></div></div>
  </div>`;
}

function buildCiteMap(chunks){
  const map = new Map();
  chunks.forEach(c=>{ if(!map.has(c.id)) map.set(c.id, map.size+1); });
  return map;
}
function citeChips(refs, citeMap){
  if(!refs || !refs.length) return '';
  return refs.map(c=>`<span class="cite" tabindex="0"><sup>${citeMap.get(c.id)}</sup><span class="cite-card">
    <div class="cite-card-title">${c.source}</div>
    <div class="cite-card-text">${c.text}</div>
    <div class="cite-card-link">View source</div>
  </span></span>`).join('');
}

function renderSolutionSection(sol){
  const cls = sol.a.hriCls;
  const citeMap = buildCiteMap(sol.references);
  return `<div class="future-block">
    <h2 style="font-size:18px;">Generated Conservation Solution</h2>
    <div class="sub" style="margin-bottom:8px;">Conservation Priority Category: <b style="color:var(--purple2)">${cls.priority}</b> (HRI ${sol.a.hri.toFixed(1)}, ${cls.label} risk). Hover a citation number for the exact source passage.</div>

    <div class="indicator-block">
      <div class="ihead"><span class="iname">1 · Immediate Interventions</span></div>
      <p style="font-size:13.5px;line-height:1.7;">${sol.immediate.text}${citeChips(sol.immediate.refs, citeMap)}</p>
    </div>

    <div class="indicator-block">
      <div class="ihead"><span class="iname">2 · Preventive Conservation</span></div>
      <p style="font-size:13.5px;line-height:1.7;">${sol.preventive.text}${citeChips(sol.preventive.refs, citeMap)}</p>
    </div>

    <div class="indicator-block">
      <div class="ihead"><span class="iname">3 · Climate Adaptation</span></div>
      <p style="font-size:13.5px;line-height:1.7;">${sol.climate.text}${citeChips(sol.climate.refs, citeMap)}</p>
    </div>

    <div class="indicator-block">
      <div class="ihead"><span class="iname">4 · Monitoring Plan</span></div>
      <p style="font-size:13.5px;line-height:1.7;">${sol.monitoring.text}${citeChips(sol.monitoring.refs, citeMap)}</p>
    </div>

    <div class="indicator-block">
      <div class="ihead"><span class="iname">5 · Long-Term Maintenance</span></div>
      <p style="font-size:13.5px;line-height:1.7;">${sol.maintenance.text}</p>
    </div>

    <div class="indicator-block">
      <div class="ihead"><span class="iname">Sources</span></div>
      ${sol.references.length ? `<div style="font-size:12.5px;line-height:2;">${sol.references.map((c,i)=>`<div><span class="cite" tabindex="0"><sup>${i+1}</sup><span class="cite-card">
        <div class="cite-card-title">${c.source}</div>
        <div class="cite-card-text">${c.text}</div>
        <div class="cite-card-link">View source</div>
      </span></span> ${c.source}</div>`).join('')}</div>` : '<div style="font-size:12px;color:var(--muted);">No knowledge base matches for this assessment.</div>'}
    </div>
  </div>`;
}

function pageClimate(){
  const essR = computeESS(state.ess), bcsR = computeBCS(state.bcs), oisR = computeOIS(state.ois);
  const hriCurrent = computeHRI(essR.score, bcsR.score, oisR.score);

  const proj245 = projectScenario(state.ess, essR, bcsR.score, 'ssp245');
  const proj585 = projectScenario(state.ess, essR, bcsR.score, 'ssp585');
  const hri245 = computeHRI(proj245.ess, proj245.bcs, oisR.score);
  const hri585 = computeHRI(proj585.ess, proj585.bcs, oisR.score);

  const scenarios = {
    current: {label:'Current Conditions', ess:essR.score, bcs:bcsR.score, ois:oisR.score, hri:hriCurrent},
    ssp245:  {label:'SSP2-4.5 (Moderate)', ess:proj245.ess, bcs:proj245.bcs, ois:oisR.score, hri:hri245},
    ssp585:  {label:'SSP5-8.5 (Severe)',   ess:proj585.ess, bcs:proj585.bcs, ois:oisR.score, hri:hri585}
  };
  const sel = scenarios[state.scenario];
  const selCls = classify(sel.hri, HRI_TABLE);
  const drivers = dominantDrivers(sel.ess, sel.bcs, sel.ois);
  const strat = getStrategy(selCls.priority, drivers);

  return `<div class="card">
    <div class="accentbar"></div>
    <h2>Climate Scenario Engine & Decision Matrix</h2>
    <div class="sub">IPCC AR6 SSP pathways projected onto Current HRI to generate the Future HRI.</div>

    <div class="indicator-block" style="margin-bottom:18px;">
      <div class="ihead"><span class="iname">${icon('globe',16)} What is an SSP?</span></div>
      <p style="font-size:13.5px;line-height:1.7;">
        <b>SSP</b> stands for <b>Shared Socioeconomic Pathway</b> — one of the future-scenario narratives used by the <b>IPCC</b> (Intergovernmental Panel on Climate Change) in its <b>AR6</b> (Sixth Assessment Report, 2021–2023). The first number identifies the socioeconomic storyline (SSP2 = "Middle of the Road," SSP5 = "Fossil-fueled Development"); the number after the dash is the approximate radiative forcing by 2100 in W/m² — higher means stronger warming. <b>SSP2-4.5</b> and <b>SSP5-8.5</b> are <b>independent, alternative futures, not sequential steps</b> — each is projected separately onto the same Current HRI baseline, so the three tabs below are parallel "what-if" branches rather than a single timeline.
      </p>
    </div>

    <div class="scenario-tabs">
      ${Object.keys(scenarios).map(k=>`<div class="scenario-tab ${state.scenario===k?'active':''}" onclick="state.scenario='${k}';render()">${scenarios[k].label}</div>`).join('')}
    </div>

    <table class="compare-table">
      <thead><tr><th>Scenario</th><th>ESS</th><th>BCS</th><th>OIS</th><th>HRI</th><th>Risk</th></tr></thead>
      <tbody>
        ${Object.keys(scenarios).map(k=>{
          const s = scenarios[k]; const c = classify(s.hri, HRI_TABLE);
          return `<tr style="${state.scenario===k?'background:var(--accent-soft)':''}">
            <td>${s.label}</td><td>${s.ess.toFixed(1)}</td><td>${s.bcs.toFixed(1)}</td><td>${s.ois.toFixed(1)}</td>
            <td><b>${s.hri.toFixed(1)}</b></td><td style="color:${bandColor(c.label)}">${c.label}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>

    <div class="future-block">
      <h2 style="font-size:18px;">Decision Matrix — ${sel.label}</h2>
      <div class="sub" style="margin-bottom:8px;">Dominant risk driver: <b style="color:var(--purple2)">${drivers.join(' + ')}</b></div>
      <div class="strategy-box">
        <div class="cat">${selCls.priority} · HRI ${sel.hri.toFixed(1)} (${selCls.label})</div>
        <div class="driver">Rule-based match: ${strat.key}</div>
        <p>${strat.text}</p>
      </div>
    </div>

    <div class="note">This category and dominant driver, for the scenario selected above, is what feeds the <b>Conservation Strategy</b> step next — continue to generate a fully tailored, source-cited action plan.</div>
  </div>${navRow(5,7)}`;
}

function pageStrategy(){
  const essR = computeESS(state.ess), bcsR = computeBCS(state.bcs), oisR = computeOIS(state.ois);
  const hriCurrent = computeHRI(essR.score, bcsR.score, oisR.score);
  const proj245 = projectScenario(state.ess, essR, bcsR.score, 'ssp245');
  const proj585 = projectScenario(state.ess, essR, bcsR.score, 'ssp585');
  const hri245 = computeHRI(proj245.ess, proj245.bcs, oisR.score);
  const hri585 = computeHRI(proj585.ess, proj585.bcs, oisR.score);
  const scenarios = {
    current: {label:'Current Conditions', ess:essR.score, bcs:bcsR.score, ois:oisR.score, hri:hriCurrent},
    ssp245:  {label:'SSP2-4.5 (Moderate)', ess:proj245.ess, bcs:proj245.bcs, ois:oisR.score, hri:hri245},
    ssp585:  {label:'SSP5-8.5 (Severe)',   ess:proj585.ess, bcs:proj585.bcs, ois:oisR.score, hri:hri585}
  };
  const sel = scenarios[state.scenario];
  const drivers = dominantDrivers(sel.ess, sel.bcs, sel.ois);

  return `<div class="card">
    <div class="accentbar"></div>
    <h2>Conservation Strategy</h2>
    <div class="sub">A defensible, source-cited action plan for ${sel.label} — retrieved from HERA's local knowledge base of conservation guidelines and precedent case studies, matched to this building's own risk drivers and indicator readings.</div>

    ${renderSolutionSection(generateLocalSolution(state.scenario))}

    <div class="future-block">
      <h2 style="font-size:18px;">AI Prompt Generator</h2>
      <div class="sub" style="margin-bottom:8px;">Want a second opinion, or to validate the solution above against a different / broader knowledge layer than HERA's own? Generate a paste-ready prompt for Claude, ChatGPT, or any other model.</div>

      <div class="scenario-tabs" style="margin-bottom:14px;">
        <div class="scenario-tab ${state.promptMode==='hera'?'active':''}" onclick="state.promptMode='hera';render()">Grounded in HERA's knowledge base</div>
        <div class="scenario-tab ${state.promptMode==='external'?'active':''}" onclick="state.promptMode='external';render()">External validation (general literature)</div>
      </div>

      ${state.promptMode==='hera' ? (() => {
        const qTags = buildQueryTags(sel.ess, sel.bcs, sel.ois, drivers, state.bcs, state.building, state.ess);
        const matched = retrieveKnowledge(qTags, 6);
        return `<div class="sub" style="margin-bottom:8px;">Sends HERA's matched knowledge base passages along with the assessment, so the AI's answer is grounded in and cites the same sources used in the Generated Solution above.</div>
        ${matched.length ? `<div class="indicator-block" style="margin-bottom:16px;">
          <div class="ihead"><span class="iname">${icon('book',16)} Matched knowledge base sources (${matched.length})</span></div>
          ${matched.map(c=>`<div style="font-size:12px;color:var(--muted);margin-bottom:8px;"><b style="color:var(--purple2);">${c.source}</b> — ${c.text}</div>`).join('')}
        </div>` : ''}`;
      })() : `<div class="sub" style="margin-bottom:8px;">Skips HERA's knowledge base entirely and instructs the AI to draw on its own general training knowledge of UNESCO/ICOMOS literature instead — use this if you want an independent cross-check rather than a HERA-grounded answer.</div>`}

      <button class="primary" onclick="state.showPrompt=!state.showPrompt;render()">${state.showPrompt ? 'Hide Prompt' : `${icon('spark',16)} Generate Full AI Prompt`}</button>
      ${state.showPrompt ? `
        <div style="margin-top:16px;">
          <textarea readonly style="width:100%;min-height:380px;background:var(--bg3);border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:'Inter',monospace;font-size:12px;line-height:1.6;padding:16px;white-space:pre-wrap;">${buildPrompt(state.scenario, state.promptMode)}</textarea>
          <div style="display:flex;gap:10px;margin-top:10px;">
            <button id="copyBtn" class="primary" onclick="copyPrompt('${state.scenario}','${state.promptMode}')">${icon('copy',16)} Copy to Clipboard</button>
            <span style="font-size:12px;color:var(--muted);align-self:center;">Paste directly into Claude or ChatGPT to get the tailored strategy for ${sel.label}</span>
          </div>
        </div>` : ''}
    </div>

    <div class="phase2"><b>RAG retrieval active:</b> HERA produces the conservation solution above directly from a local knowledge base paraphrased from Sesana et al. 2021 and the UNESCO Disaster Risk Management manual, auto-matched to this building's risk drivers. The AI Prompt Generator remains available for a second opinion — either grounded in the same knowledge base, or fully external for independent validation. <b>Next milestone:</b> expand the knowledge base with ICOMOS charters, Feilden, and Egyptian/Baron Palace-specific restoration reports, and move from keyword tag-matching to full semantic retrieval.</div>
  </div>${navRow(6,8)}`;
}

function pageCompare(){
  const list = [...state.projects].sort((a,b)=>b.hri-a.hri);
  return `<div class="card">
    <div class="accentbar"></div>
    <h2>Building Comparison & Resource Prioritization</h2>
    <div class="sub">For when you're managing several adaptive reuse heritage buildings with limited resources — see, at a glance, which ones need immediate mediation or intervention first.</div>

    ${list.length === 0 ? `
      <div class="note">No buildings saved yet. Run an assessment, then click <b>Save to Comparison</b> on the Results page to add it here.</div>
      <div class="navrow"><span></span><button class="primary" onclick="newAssessment()">${icon('arrowRight',16)} Start an Assessment</button></div>
    ` : `
      <table class="compare-table">
        <thead><tr><th>Building</th><th>Use</th><th>HRI</th><th>Risk</th><th>Priority</th><th>Action</th></tr></thead>
        <tbody>
          ${list.map((p,i)=>{
            const color = bandColor(p.band);
            return `<tr style="${i===0?'background:rgba(176,58,46,.06)':''}">
              <td><b>${p.building.name}</b>${i===0?' <span class="badge" style="border-color:'+color+';color:'+color+';background:'+color+'14;">Most Urgent</span>':''}<div style="font-size:11px;color:var(--muted);">${p.building.location}</div></td>
              <td>${p.building.use}</td>
              <td><b>${p.hri.toFixed(1)}</b></td>
              <td style="color:${color};font-weight:600;">${p.band}</td>
              <td style="font-size:12px;">${p.priority}</td>
              <td>
                <button style="padding:7px 10px;font-size:12px;" onclick="loadProject('${p.id}')">Open</button>
                <button style="padding:7px 10px;font-size:12px;" onclick="removeProject('${p.id}')">Remove</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>

      <div class="future-block">
        <h2 style="font-size:16px;">Relative Risk</h2>
        ${list.map(p=>barRow(p.building.name, p.hri, p.band)).join('')}
      </div>

      <div class="note"><b>How to read this:</b> Buildings are ranked by Heritage Risk Index (HRI), highest first. With limited resources, prioritize intervention on the building(s) at the top of the list — especially those flagged Critical or High Risk — before addressing lower-risk buildings.</div>

      <div class="navrow"><span></span><button class="primary" onclick="newAssessment()">+ Add Another Building</button></div>
    `}
  </div>`;
}

function navRow(prev, next){
  return `<div class="navrow">
    <button onclick="go(${prev})">${icon('arrowLeft',16)} Back</button>
    ${next<=7 && next!==prev ? `<button class="primary" onclick="go(${next})">Continue ${icon('arrowRight',16)}</button>` : `<button class="primary" onclick="go(0)">${icon('refresh',16)} Start New Assessment</button>`}
  </div>`;
}

/* ============================== ROUTER ============================== */
function render(){
  const pages = [pageHome, pageBuilding, pageESS, pageBCS, pageOIS, pageResults, pageClimate, pagePhase2];
  // Step 0 is the cinematic landing — rendered full-bleed with its own top nav,
  // no sidebar. Every other step (and the compare view) uses the app shell.
  if(!state.compareView && state.step===0){
    document.getElementById('app').innerHTML = pageHome();
    destroyGeoMap();
    setupReveals();
    return;
  }
  const body = state.compareView ? pageCompare() : pages[state.step]();
  document.getElementById('app').innerHTML =
    sidebarHTML() + `<main class="main"><div class="main-inner">` + header() + body + `</div></main>`;
  if(!state.compareView && state.step===2){ mountGeoMap(); } else { destroyGeoMap(); }
  setupReveals();
}
/* Expose new inline-handler targets on window (inline on* attributes resolve
   against window, exactly like the originals wired in main.js). */
Object.assign(window, {
  openPillar, closePillar, startAssessment,
  addBuildingImages, removeBuildingImage,
  stripHoverStart, stripHoverStop, stripStep
});
/* ============================== CONNECTIVITY ============================== */
loadImageCache(); // populate state.imageCache from localStorage, if available — degrades gracefully if not
window.addEventListener('online', ()=>{ state.isOnline = true; render(); });
window.addEventListener('offline', ()=>{ state.isOnline = false; render(); });


render(); // initial paint

export {
  state, render, go, toggleCompare, newAssessment, saveCurrentProject, loadProject, removeProject,
  geoSearch, geoFetchEnvironment, selectGeoResult, openCapModal, closeCapModal, copyPrompt, retryImages,
  eraFromYear
};

/* ============================== DATA & FORMULAS ============================== */
/* Sourced directly from: Mariam Elmezayen's MSc Thesis Proposal — */
/* "An AI-Assisted Heritage Risk Assessment and Decision-Support Framework", GIU 2026 */

const BANDS_GENERIC = [ // ESS / OIS / HRI classification
  {min:0,max:20,label:'Very Low'},
  {min:21,max:40,label:'Low'},
  {min:41,max:60,label:'Moderate'},
  {min:61,max:80,label:'High'},
  {min:81,max:100,label:'Severe'}
];
const BANDS_BCS = [
  {min:0,max:20,label:'Excellent'},
  {min:21,max:40,label:'Good'},
  {min:41,max:60,label:'Fair'},
  {min:61,max:80,label:'Poor'},
  {min:81,max:100,label:'Critical'}
];
const HRI_TABLE = [
  {min:0,max:20,label:'Very Low',priority:'Routine Monitoring'},
  {min:21,max:40,label:'Low',priority:'Scheduled Maintenance'},
  {min:41,max:60,label:'Moderate',priority:'Preventive Conservation'},
  {min:61,max:80,label:'High',priority:'Conservation Upgrade'},
  {min:81,max:100,label:'Critical',priority:'Immediate Intervention'}
];

function classify(score, table){
  // NOTE: bands are defined with integer min/max (e.g. 41-60, 61-80). Scores are
  // floats (e.g. 60.2), so matching on "score>=min && score<=max" leaves a gap
  // between 60 and 61 that no band covers — any score landing in that gap fell
  // through to the fallback (the LAST band, i.e. "Critical"), which is why a
  // score of 60.2 was previously showing as Critical while 60 showed Fair and
  // 61 showed Poor. Matching on score<=max only (bands are contiguous and
  // sorted ascending) removes the gap entirely, so classification is monotonic.
  for(const b of table){ if(score<=b.max) return b; }
  return table[table.length-1];
}
function bandColor(label){
  const map = {'Very Low':'var(--good)','Excellent':'var(--good)','Low':'var(--low)','Good':'var(--low)',
    'Moderate':'var(--mod)','Fair':'var(--mod)','High':'var(--high)','Poor':'var(--high)',
    'Severe':'var(--crit)','Critical':'var(--crit)'};
  return map[label] || 'var(--purple)';
}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function lerp(x,x0,x1,y0,y1){ if(x1===x0) return y0; const t=clamp((x-x0)/(x1-x0),0,1); return y0+t*(y1-y0); }

// piecewise scoring across breakpoints [[x,score],...]
function piecewise(x, pts){
  if(x<=pts[0][0]) return pts[0][1];
  for(let i=0;i<pts.length-1;i++){
    const [x0,y0]=pts[i], [x1,y1]=pts[i+1];
    if(x<=x1) return lerp(x,x0,x1,y0,y1);
  }
  return pts[pts.length-1][1];
}

/* ---------- ESS scoring (Table 6/7.3/8.6) ---------- */
function scoreTemperature(tempC){ // indoor temp °C, optimal 20-24, acceptable 18-27
  return piecewise(Math.abs(tempC-22), [[2,10],[5,40],[7,70],[12,100]]);
}
function scoreHumidity(rh){ // %, optimal 40-60, acceptable 30-70
  return piecewise(Math.abs(rh-50), [[10,10],[20,40],[30,70],[45,100]]);
}
function scoreSolar(wm2){ // W/m², optimal <200, acceptable 200-500, critical >500
  return piecewise(wm2, [[200,10],[350,35],[500,70],[900,100]]);
}
function computeESS(i){
  const t=scoreTemperature(i.temp), h=scoreHumidity(i.rh), s=scoreSolar(i.solar);
  return {score: (t+h+s)/3, parts:{Temperature:t,Humidity:h,Solar:s}};
}

/* ---------- BCS scoring (Table 10/11/12) ---------- */
const CAT_SCORE = {None:5, Minor:35, Limited:35, Moderate:65, Severe:95};
function scoreCrack(mm){ return piecewise(mm, [[1,10],[3,45],[5,75],[9,100]]); }
function scoreSurfaceLoss(pct){ return piecewise(pct, [[5,10],[15,45],[30,75],[55,100]]); }
function computeBCS(i){
  const md=CAT_SCORE[i.materialDecay], cr=scoreCrack(i.crack), sl=scoreSurfaceLoss(i.surfaceLoss), bg=CAT_SCORE[i.bioGrowth];
  return {score: md*0.40 + cr*0.30 + sl*0.20 + bg*0.10, parts:{MaterialDecay:md,Cracking:cr,SurfaceLoss:sl,BiologicalGrowth:bg}};
}

/* ---------- OIS scoring (Table 14/15/16) ---------- */
function scoreDensity(p){ return piecewise(p, [[1,10],[2,45],[3,75],[5,100]]); }
function computeOIS(i){
  const d=scoreDensity(i.density), v=CAT_SCORE_OIS(i.visitorLoad), e=CAT_SCORE_OIS(i.eventFreq);
  return {score:(d+v+e)/3, parts:{OccupancyDensity:d,VisitorLoad:v,EventFrequency:e}};
}
function CAT_SCORE_OIS(level){ return {Low:10,Monthly:10,Medium:40,Weekly:40,High:70,'Several/week':70,Excessive:95,Daily:95}[level]; }

/* ---------- HRI ---------- */
function computeHRI(ess,bcs,ois){ return 0.40*ess + 0.40*bcs + 0.20*ois; }

export {
  BANDS_GENERIC, BANDS_BCS, HRI_TABLE, classify, bandColor, clamp, lerp, piecewise,
  scoreTemperature, scoreHumidity, scoreSolar, computeESS,
  CAT_SCORE, scoreCrack, scoreSurfaceLoss, computeBCS,
  scoreDensity, computeOIS, CAT_SCORE_OIS, computeHRI
};

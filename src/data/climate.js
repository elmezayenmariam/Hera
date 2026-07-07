import { clamp, computeESS } from './formulas.js';

/* ---------- Climate Scenario Engine ----------
   No fixed formula exists in the proposal for translating SSP pathways into
   projected ESS/BCS — this is an explicit open question in the methodology.
   This prototype implements one transparent, documented approach:
   1) Apply IPCC AR6 temperature deltas to the raw environmental indicators
      (temperature shifts directly; humidity assumed to fall with regional
      aridification; solar exposure assumed to rise slightly with warming).
   2) Recompute ESS from the shifted indicators.
   3) Project BCS forward using a deterioration-acceleration coefficient (k),
      reflecting environmental stress (hazard) as the primary driver of
      material vulnerability realization, per the framework's theoretical basis.
   4) OIS is treated as non-climatic and held constant, consistent with the
      proposal's own worked example (Slide 29).
   k and the indicator-shift assumptions are adjustable constants below —
   flagged for expert/supervisor validation. */

const SSP = {
  current: {label:'Current Conditions', dT:0, dRH:0, dSolarPct:0},
  ssp245:  {label:'SSP2-4.5 (Moderate)', dT:2.7, dRH:-6, dSolarPct:8},
  ssp585:  {label:'SSP5-8.5 (Severe)',   dT:4.4, dRH:-10, dSolarPct:14}
};
const BCS_ACCELERATION_K = 0.75; // deterioration sensitivity to ESS increase

function projectScenario(rawESS, currentESSResult, currentBCSscore, scenarioKey){
  const s = SSP[scenarioKey];
  const projTemp = rawESS.temp + s.dT;
  const projRH = clamp(rawESS.rh + s.dRH, 0, 100);
  const projSolar = rawESS.solar * (1 + s.dSolarPct/100);
  const ess2 = computeESS({temp:projTemp, rh:projRH, solar:projSolar});
  const deltaESS = ess2.score - currentESSResult.score;
  const bcs2 = clamp(currentBCSscore + deltaESS * BCS_ACCELERATION_K, 0, 100);
  return {ess: ess2.score, bcs: bcs2, indicators:{projTemp,projRH,projSolar}};
}

export { SSP, BCS_ACCELERATION_K, projectScenario };

/* ============================== RAG KNOWLEDGE BASE ==============================
   Curated, paraphrased reference chunks derived from:
   - Sesana, Gagnon, Ciantelli, Cassar & Hughes (2021), "Climate change impacts on
     cultural heritage: A literature review," WIREs Climate Change 12:e710.
   - UNESCO/ICCROM/ICOMOS/IUCN (2010), "Managing Disaster Risks for World Heritage,"
     World Heritage Resource Manual.
   All entries are original paraphrase + synthesis, not reproductions of source text.
   Each entry carries 'tags' used by the retrieval engine to match HERA's computed
   risk drivers, indicator readings, and building profile. */
const KNOWLEDGE_BASE = [
  // --- ESS / climate mechanisms (Sesana et al. 2021) ---
  {id:'kb01', source:'Sesana et al. 2021, §3.1.1', tags:['ess','temperature','freeze-thaw','cracking','masonry'],
   text:'Freeze–thaw damage concentrates where temperatures oscillate repeatedly around 0°C; in most of Europe this risk is projected to fall under warming, but it can rise in regions that newly start crossing the freezing point. Where it occurs, repeated ice expansion in pore water causes structural cracking and disintegration of stone, brick and ceramic fabric.'},
  {id:'kb02', source:'Sesana et al. 2021, §3.1.2', tags:['ess','temperature','solar','thermoclastism','limestone','marble','cracking'],
   text:'Thermoclastism — expansion/contraction of surface mineral grains from diurnal and seasonal temperature swings under direct solar exposure — is expected to intensify in Mediterranean-type climates, producing micro-cracking, exfoliation and surface erosion, with marble and porous limestone particularly susceptible.'},
  {id:'kb03', source:'Sesana et al. 2021, §3.2.1', tags:['ess','precipitation','corrosion','limestone','surfaceloss','materialdecay'],
   text:'Increased precipitation accelerates corrosion and surface recession of carbonate stones (limestone, marble) through the "karst effect" — slightly acidic rainfall dissolving carbonate surfaces, intensified by rising atmospheric CO2. Effects are most pronounced where rainfall increases are coupled with urban air pollution.'},
  {id:'kb04', source:'Sesana et al. 2021, §3.2.2', tags:['ess','humidity','biologicalgrowth','wood','arid','mediterranean'],
   text:'Biological growth (algae, fungi, lichens, mold) on heritage materials is driven primarily by relative humidity and periods of surface wetness. Under climate change, biological degradation risk is projected to increase in boreal/temperate regions but to *decrease* in the Mediterranean, Middle East and other regions trending drier — relevant for hot-arid Egyptian conditions where lower humidity may reduce (but not eliminate) this risk relative to temperate-climate literature.'},
  {id:'kb05', source:'Sesana et al. 2021, §3.2.3', tags:['ess','humidity','saltcrystallization','efflorescence','subflorescence','surfaceloss'],
   text:'Salt crystallization cycles occur when relative humidity fluctuates across the deliquescence point of soluble salts already present in masonry. Volume change on crystallization exerts mechanical stress either beneath the surface (subflorescence, causing spalling) or on the surface (efflorescence, causing visual/readability loss). Central and arid-adjacent regions with strong humidity swings are flagged as higher risk for this mechanism.'},
  {id:'kb06', source:'Sesana et al. 2021, §3.3', tags:['ess','wind','solar','windrain','erosion','materialdecay'],
   text:'Wind and wind-driven rain (WDR) cause surface abrasion, accelerate water penetration into porous materials, and can transport pollutants, salts and sand — the latter especially relevant in arid environments where aeolian sand erosion is a recognized degradation pathway distinct from the wetter-climate literature.'},
  {id:'kb07', source:'Sesana et al. 2021, §4.1.3', tags:['ess','humidity','temperature','wood','hygroscopic','interior','occupancy'],
   text:'Indoor temperature and relative humidity fluctuations in uncontrolled historic buildings cause swelling/shrinkage cycles in hygroscopic wooden materials, leading to detachment of paint layers, gilding and coatings, and mechanical stress in masonry envelopes. Risk is elevated in buildings with significant seasonal humidity fluctuation and limited climate control — a relevant consideration for adaptive reuse functions (museum, cultural center) that introduce visitor-driven humidity loads.'},
  {id:'kb08', source:'Sesana et al. 2021, §5.6', tags:['ess','temperature','drought','fire','arid'],
   text:'Drought and extreme heat increase fire ignition and propagation risk, and under sustained extreme heat stone can undergo macro-degradation (cracking, soot accumulation, discolouration) and micro-degradation (mineralogical/textural change), compounding structural vulnerability over time.'},
  {id:'kb09', source:'Sesana et al. 2021, §3.2', tags:['ess','precipitation','waterpenetration','damp','materialdecay'],
   text:'Water is identified as the dominant agent of heritage material degradation overall: increased precipitation raises the risk of saturated soils, overloaded drainage, and damp penetration into masonry through capillary action and condensation, compounding corrosion, biological activity and salt-driven decay simultaneously.'},
  // --- BCS / condition & vulnerability framing (Sesana + UNESCO DRM) ---
  {id:'kb10', source:'UNESCO Managing Disaster Risks for World Heritage (2010), §1.5', tags:['vulnerability','maintenance','bcs','priority'],
   text:'Disaster/decay risk is not only a function of major hazard events — small, progressive vulnerability factors such as lack of maintenance, inadequate management and slow cumulative deterioration are equally important drivers that can turn an otherwise survivable hazard into a serious loss event. Addressing underlying vulnerability (e.g., active material decay, unrepaired cracking) is as important as addressing the hazard itself.'},
  {id:'kb11', source:'UNESCO Managing Disaster Risks for World Heritage (2010), §5.2', tags:['intervention','reversibility','minimalintervention','retrofitting'],
   text:'Post-earthquake retrofitting precedent (Kobe, 1995) establishes a clear order of preference for interventions: (1) traditional techniques with traditional materials, (2) traditional techniques combined with modern materials, (3) modern techniques with modern materials, (4) full replacement using modern techniques — used only when the preceding options cannot achieve adequate performance. This hierarchy operationalizes the minimal-intervention principle for heritage conservation decisions.'},
  // --- OIS / occupancy & adaptive reuse ---
  {id:'kb12', source:'Sesana et al. 2021, §4', tags:['ois','occupancy','museum','interior','humidity'],
   text:'Museums and adaptive-reuse cultural buildings housed in historic structures without modern climate control face elevated risk because visitor-driven humidity and thermal loads compound the building\'s baseline exposure to climatic stressors — underscoring the need to factor occupancy/visitor load into risk assessment alongside pure environmental hazard.'},
  // --- DRM cycle / prioritization / monitoring (UNESCO manual) ---
  {id:'kb13', source:'UNESCO Managing Disaster Risks for World Heritage (2010), §1.5', tags:['drm','cycle','prevention','response','recovery','monitoring'],
   text:'A disaster/risk management cycle for heritage properties comprises: risk identification & assessment; prevention & mitigation; emergency preparedness & response; and recovery/rehabilitation — with monitoring and periodic review feeding back into each stage. This cycle is the recommended structural basis for any conservation/risk plan.'},
  {id:'kb14', source:'UNESCO Managing Disaster Risks for World Heritage (2010), §4.3', tags:['prioritization', 'limitedresources', 'probability', 'consequence', 'multiplebuilding'],
   text:'Where resources for risk reduction are limited, prioritization should weigh three factors together: the probability of the risk scenario occurring, the severity of its consequences (physical, social, economic), and the magnitude of loss to irreplaceable heritage value if unaddressed — not probability or severity alone. This is the recommended basis for ranking which of several heritage assets needs intervention first when resources cannot cover all of them simultaneously.'},
  {id:'kb15', source:'UNESCO Managing Disaster Risks for World Heritage (2010), §5.1', tags:['monitoring','earlywarning','mitigation'],
   text:'Effective monitoring and early-warning systems are repeatedly identified as a high-value, comparatively low-cost mitigation measure — catching slow-developing risks (material decay, moisture ingress, structural movement) before they escalate is consistently cheaper than post-event recovery.'},
  {id:'kb16', source:'UNESCO Managing Disaster Risks for World Heritage (2010), §2.1', tags:['planning','documentation','management'],
   text:'A risk management plan should be treated as a living, periodically reviewed process rather than a static checklist — it should be integrated with the property\'s general management/conservation plan, define clear responsible parties, and be revisited after any significant event or condition change.'},
  {id:'kb17', source:'Sesana et al. 2021, §3.1', tags:['ess','aridregion','mediterranean','egypt','hotarid'],
   text:'Most existing climate-heritage damage-function literature is calibrated to European, temperate and Mediterranean-coastal conditions; hot-arid regions such as Egypt are comparatively under-represented, meaning lower-humidity-driven mechanisms (salt cycling tied to dry-wet oscillation, thermoclastism, wind-blown sand abrasion) are likely more diagnostic locally than the freeze-thaw and biological-growth mechanisms that dominate the temperate-climate literature.'},
  // --- Feilden, Conservation of Historic Buildings (3rd ed., 2003) ---
  {id:'kb18', source:'Feilden 2003, Ch.7 "Climatic causes of decay"', tags:['ess','temperature','solar','thermoclastism','hotarid','egypt','arid','cracking'],
   text:'Documented surface-temperature swings on masonry in hot, arid, low-latitude sites — including a recorded rise of roughly 15\u201341\u00b0C within under eight hours at Abu Simbel in Egyptian Nubia — illustrate why daily thermal cycling is most extreme in desert climates. Traditional heavy masonry construction in such climates historically relied on high thermal mass to buffer these swings; thin or rigid modern repair materials (e.g. hard cement render) lack this buffering and are prone to thermal cracking where applied to historic masonry.'},
  {id:'kb19', source:'Feilden 2003, Ch.7 "Climatic causes of decay"', tags:['wind','erosion','hotarid','egypt','arid','materialdecay'],
   text:'Wind-blown sand and grit are recorded as an active erosion mechanism at Egyptian desert sites — a windstorm carrying loose sand from the ground caused visible surface damage to carved stone at the Abu Simbel temple after its relocation. Wind also generally accelerates surface erosion of masonry independent of rainfall, by abrading exposed surfaces and, when combined with rain, driving water penetration into cracks and joints.'},
  {id:'kb20', source:'Feilden 2003, Ch.7 "Climatic causes of decay"', tags:['saltcrystallization','wind','humidity','materialdecay','subflorescence','surfaceloss'],
   text:'Rapid surface evaporation driven by wind can push salt crystallization to occur beneath the surface rather than on it, producing subsurface cavities and progressive internal breakup of stone (sometimes termed cavernous decay) as repeated crystallization cycles compound the damage — a mechanism particularly relevant to hot, windy, low-humidity environments where evaporation rates are high.'},
  {id:'kb21', source:'Feilden 2003, Ch.16 "Preventive maintenance of historic buildings"', tags:['maintenance','prevention','vulnerability','planning'],
   text:'A programme of regular preventive maintenance — routine inspection, prompt small repairs, and clearing of drainage/gutters — is consistently identified as less costly over time than deferring action until major deterioration forces large-scale intervention. Long-running institutional maintenance programmes are cited as evidence that consistent upkeep measurably reduces the scale of repair needed later, reinforcing preventive maintenance as the least invasive and most cost-effective form of conservation.'},
  {id:'kb22', source:'Feilden 2003, Ch.20 "Rehabilitation of historic buildings"', tags:['intervention','minimalintervention','ois','museum','occupancy','retrofitting'],
   text:'When selecting a new function for an adaptively reused heritage building, the guiding principle is to favour whichever viable use requires the least alteration to the historic fabric — the closer the new use is to a building\u2019s original character and structural capacity, the lower the intervention needed and the better its historic values are preserved. Multidisciplinary assessment (structural survey, defect schedule, condition typology) should precede any decision on adaptive function, since floor loading or occupancy demands of a proposed use can otherwise force costly structural strengthening that a better-matched use would avoid.'},
  // --- UNESCO, Managing Cultural World Heritage (World Heritage Resource Manual) ---
  {id:'kb23', source:'UNESCO Managing Cultural World Heritage, Part 4 "Monitoring"', tags:['monitoring','management','planning','documentation','drm'],
   text:'Monitoring within a heritage management system serves three linked purposes: confirming the management system itself is functioning, confirming it is producing the intended outcomes for the property, and identifying what corrective action or new initiative is required when shortcomings or new risks are detected. Monitoring outputs should feed back into planning on an ongoing basis rather than being treated as a one-off audit.'},
  {id:'kb24', source:'UNESCO Managing Cultural World Heritage, Appendix A "Developing responses/proposals"', tags:['planning','prioritization','management','documentation'],
   text:'A management response for a heritage property is best built around a clear long-term vision statement, translated into specific, measurable, achievable, relevant and time-bound objectives, and then into an action plan that assigns budget, responsible parties, timeframes and resource needs to each action — providing the structure through which a conservation plan, disaster-risk-management plan, or monitoring plan can be prioritized and implemented in practice.'},
  // --- ICOMOS, The Future of Our Pasts (2019) ---
  {id:'kb25', source:'ICOMOS Future of Our Pasts 2019, Heritage & Climate Change Outline Report', tags:['maintenance','prevention','prioritization','limitedresources','monitoring'],
   text:'Given uncertainty in long-term climate projections, routine maintenance is framed as the most robust first line of defence for heritage managers, since it improves resilience across a range of possible future climate outcomes rather than betting on one projected scenario. Because not every heritage asset can be saved under mounting climate pressure, the report calls for transparent, criteria-based prioritization — combining assessed cultural significance with assessed environmental risk — to decide where recording, salvage or full conservation effort is directed.'},
  // --- ICOMOS Climate Action Working Group, Climate Change Adaptation (Toolkit) ---
  {id:'kb26', source:'ICOMOS CAWG Climate Change Adaptation, "What can we do now?" §1-2', tags:['prevention','maintenance','monitoring','vulnerability','drm'],
   text:'So-called "win-win" adaptation actions — regular monitoring, routine maintenance, disaster preparedness and visitor/occupancy management — simultaneously improve a heritage building\u2019s current condition and its resilience to future climate hazards, making them a low-regret starting point regardless of which climate scenario ultimately materializes. Addressing non-climatic vulnerability factors (deferred maintenance, poor drainage, unmanaged occupancy pressure) is presented as building adaptive capacity even before climate-specific measures are introduced.'},
  {id:'kb27', source:'ICOMOS CAWG Climate Change Adaptation, "Preparing for change" §3, Fig.1', tags:['intervention','minimalintervention','reversibility','retrofitting'],
   text:'Adaptation interventions for heritage sit on a graduated spectrum from lowest to highest impact on authenticity: routine maintenance and repair sit at the low-intervention end; proactive conservation and physical modification occupy the middle; external protective structures, relocation/removal, and, at the extreme, managed loss represent progressively higher levels of intervention and impact. The framework recommends starting from the least invasive end of this spectrum and moving to higher-impact measures only once lower-impact options are judged insufficient to protect a place\u2019s significance.'}
];

/* Lightweight keyword retrieval: scores each KB chunk against a set of query tags
   derived from the live assessment (dominant drivers, indicator bands, building
   profile), returns the top N matches. No embeddings/network calls — pure
   client-side tag overlap, intentionally simple and auditable. */
function retrieveKnowledge(queryTags, topN){
  topN = topN || 6;
  const scored = KNOWLEDGE_BASE.map(chunk=>{
    let score = 0;
    queryTags.forEach(qt=>{ if(chunk.tags.includes(qt)) score += 1; });
    return {chunk, score};
  }).filter(s=>s.score>0);
  scored.sort((a,b)=>b.score-a.score);
  return scored.slice(0, topN).map(s=>s.chunk);
}

function buildQueryTags(ess, bcs, ois, drivers, bi, building, ess_i){
  const tags = new Set();
  drivers.forEach(d=>tags.add(d.toLowerCase()));
  // BCS sub-indicators
  if(bi.materialDecay && bi.materialDecay!=='Good') tags.add('materialdecay');
  if(bi.crack >= 2) tags.add('cracking');
  if(bi.surfaceLoss >= 10) tags.add('surfaceloss');
  if(bi.bioGrowth && bi.bioGrowth!=='None') tags.add('biologicalgrowth');
  // ESS indicators
  if(ess_i.rh >= 55) tags.add('humidity');
  if(ess_i.solar >= 250) tags.add('solar');
  tags.add('temperature'); tags.add('precipitation'); tags.add('wind');
  // Building profile
  if(building.material && /limestone|marble/i.test(building.material)) tags.add('limestone');
  if(/museum|cultural/i.test(building.use||'')) tags.add('museum');
  tags.add('ois'); tags.add('occupancy');
  tags.add('aridregion'); tags.add('hotarid'); tags.add('egypt');
  tags.add('prioritization'); tags.add('drm'); tags.add('monitoring');
  return Array.from(tags);
}


export { KNOWLEDGE_BASE, retrieveKnowledge, buildQueryTags };

/* ============================== NETWORK LAYER ==============================
   Shared helper for every external API call in the app (geocoding, weather,
   image retrieval). Adds: a hard timeout (AbortController) so a slow/stalled
   host can't hang the UI, an immediate offline short-circuit, and consistent
   error messages — instead of every call site re-implementing this. */
function isOnline(){ return (typeof navigator !== 'undefined' && 'onLine' in navigator) ? navigator.onLine : true; }

async function fetchJSON(url, {timeoutMs=8000, signal}={}){
  if(!isOnline()) throw new Error('offline');
  const controller = new AbortController();
  const combinedSignal = signal || controller.signal;
  const timer = setTimeout(()=>controller.abort(), timeoutMs);
  try{
    const res = await fetch(url, {signal: signal ? signal : controller.signal});
    if(!res.ok) throw new Error('HTTP '+res.status);
    return await res.json();
  }catch(err){
    if(err.name === 'AbortError') throw new Error('timeout');
    throw err;
  }finally{
    clearTimeout(timer);
  }
}

export { isOnline, fetchJSON };

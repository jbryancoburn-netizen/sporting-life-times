/* RETRO D-I men's basketball forecast core. Shared by rankings, predictor, and bracket.
   Team-only 1500-reset ratings stay unchanged. Venue points are provisional until holdout calibration.
   Optional scoring inputs cannot change win probability without independent validation. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.RETROForecast=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const version='retro-forecast-1.0';
  const homeCourtElo=100; // Legacy public matchup convention; NOT validated.
  function predict(a,b,options={}){
    if(!Number.isFinite(Number(a?.elo))||!Number.isFinite(Number(b?.elo)))return null;
    const site=options.site||'neutral';
    if(!['neutral','home','away'].includes(site))throw Error('Invalid RETRO site: '+site);
    const venue=site==='home'?homeCourtElo:site==='away'?-homeCourtElo:0;
    const difference=Number(a.elo)-Number(b.elo)+venue;
    const probability=1/(1+Math.pow(10,-difference/400));
    return {homeProbability:probability,awayProbability:1-probability,
      difference,venueAdjustment:venue,site,model:version,
      status:'PROVISIONAL_NOT_HOLDOUT_CALIBRATED'};
  }
  return Object.freeze({version,homeCourtElo,predict,
    probability:(a,b,site='neutral')=>predict(a,b,{site})?.homeProbability??null});
});

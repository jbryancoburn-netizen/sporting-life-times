/* Women-only RETRO forecast engine. Shared by Daily Ledger and team scorebugs.
   Publication gate: use held-out coefficients only after validated calibration.
   Never consult or mutate men's ratings or men's score-model coefficients. */
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.WBBRetroForecast=api;
})(typeof globalThis==='undefined'?this:globalThis,function(){
'use strict';
const finite=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))?Number(x):null;
const modelOK=c=>c?.model==='ncaaw-retro-exact-160-pass-forecast-v1'&&
  c?.gender==='women'&&c?.status==='HISTORICAL_HOLDOUT_VALIDATED'&&
  c?.release_checks?.passed===true&&c?.rating_engine?.passes===160&&
  c?.rating_engine?.initial_elo===1500&&
  finite(c?.parameters?.probability_scale)>0&&
  finite(c?.parameters?.elo_margin_slope)>0&&
  finite(c?.parameters?.mean_team_points)>0;
function forecast(homeRating,awayRating,location,calibration,ratings){
  if(ratings?.model!=='retro-clean-slate'||ratings?.gender!=='women'||
    ratings?.season!=='2026-27'||ratings?.starting_elo!==1500||
    ratings?.rankings?.length!==363||!homeRating||!awayRating)return null;
  const h=finite(homeRating.elo),a=finite(awayRating.elo);
  if(h===null||a===null||!['verified-home','neutral','unverified','disputed'].includes(location)||
    location==='disputed')return null;
  const ready=modelOK(calibration);
  const edge=location==='verified-home'?(finite(ratings?.parameters?.home_edge)??0):0;
  const difference=h-a+edge;
  const scale=ready?Number(calibration.parameters.probability_scale):1;
  const prob=1/(1+Math.pow(10,-scale*difference/400));
  if(!Number.isFinite(prob))return null;
  const margin=ready?Number(calibration.parameters.elo_margin_slope)*difference:null;
  const mean=ready?Number(calibration.parameters.mean_team_points):null;
  const homeScore=ready?mean+margin/2:null;
  const awayScore=ready?mean-margin/2:null;
  // A calibrated point projection does not fabricate a win or impose a maximum margin.
  return {home_probability:prob,away_probability:1-prob,
    projected_home_margin:margin,
    projected_home_score:homeScore,projected_away_score:awayScore,
    calibrated:ready,provisional:!ready,
    venue_status:location,verification:ready?'2025-26 untouched holdout passed':'Forecast calibration pending'};
}
function forMatch(game,ratings,calibration,location){
 const byId=new Map((ratings?.rankings||[]).map(t=>[String(t.team_id),t]));
 return forecast(byId.get(String(game.home_id)),byId.get(String(game.away_id)),
   location,calibration,ratings);
}
return {forecast,forMatch,modelOK};
});
/* USRS CFB roster-first preseason engine. No school-brand or historical Elo carryover. 
   Inputs must be verified and timestamped before kickoff; missing data is not zero talent. */
(function(global){'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const num=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
function playerValue(p){
  if(!p||!p.id||!p.position)return null;
  const production=num(p.productionIndex),recruit=num(p.recruitIndex);
  if(production===null&&recruit===null)return null;
  const weights={QB:1.7,OL:1.2,DL:1.2,EDGE:1.25,WR:1,TE:.9,RB:.85,LB:1,CB:1.05,S:1,K:.35,P:.3};
  const weight=weights[String(p.position).toUpperCase()]||1;
  // Proven collegiate production dominates recruiting potential.
  return weight*(production===null?recruit*.35:recruit===null?production:production*.85+recruit*.15);
}
function preseason(team){
  const players=Array.isArray(team?.players)?team.players:[];
  const ids=new Set(),values=[],errors=[];
  for(const p of players){
    if(!p?.id){errors.push('missing-player-id');continue}
    if(ids.has(String(p.id))){errors.push('duplicate-player-id:'+p.id);continue}
    ids.add(String(p.id));const v=playerValue(p);
    if(v!==null)values.push(v);
  }
  const coverage=players.length?values.length/players.length:0;
  if(!players.length||coverage<.8||errors.length)return {status:'uncertified',rating:null,coverage,errors};
  // Rank the effective contributors; depth still contributes with diminishing returns.
  values.sort((a,b)=>b-a);
  const score=values.reduce((sum,v,i)=>sum+v*(i<22?1:i<44?.4:.12),0);
  return {status:'needs-league-calibration',rating:null,rosterScore:score,coverage,errors:[]};
}
function calibrate(teams,parameters){
  // Calibration is valid only after out-of-sample historical fitting.
  if(!parameters?.backtested||!Number.isFinite(parameters.mean)||!Number.isFinite(parameters.sd)||parameters.sd<=0||!Number.isFinite(parameters.pointsPerSd))return teams.map(t=>({...t,preseason:preseason(t)}));
  return teams.map(t=>{const p=preseason(t);return {...t,preseason:p.status==='needs-league-calibration'?{...p,status:'calibrated',rating:clamp(1500+(p.rosterScore-parameters.mean)/parameters.sd*parameters.pointsPerSd,1100,1900)}:p}});
}
global.CFB_ROSTER_MODEL=Object.freeze({version:'0.1',playerValue,preseason,calibrate});
})(window);

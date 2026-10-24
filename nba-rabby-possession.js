// Rabby possession model v1; independent of the published Elo replay.
(function(root){'use strict';
function finite(x){return typeof x==='number'&&Number.isFinite(x)}
function validate(stats){
 if(!['official_nba_boxscores','attributed_nba_boxscores'].includes(stats?.source_type)||!Array.isArray(stats.games)||stats.games.length<20)return false;
 if(new Set(stats.games.map(g=>g.id)).size!==stats.games.length&&stats.source_type==='attributed_nba_boxscores')return false;
 return stats.games.every(g=>(stats.source_type==='official_nba_boxscores'||(g.id&&g.source&&typeof g.source_url==='string'&&g.source_url.startsWith('https://')))&&g.final===true&&g.regular_season===true&&['home','away'].every(k=>{
  const t=g[k];return t&&typeof t.code==='string'&&finite(t.points)&&finite(t.fga)&&finite(t.oreb)&&finite(t.tov)&&finite(t.fta)&&t.fga>0&&t.points>0;
 }));
}
function build(stats,minimum=5){
 if(!validate(stats))return null;
 const agg={};let allPoss=0,allPts=0,n=0;
 for(const g of stats.games){
  const h=g.home,a=g.away;
  const poss=t=>t.fga-t.oreb+t.tov+0.44*t.fta;
  const pace=(poss(h)+poss(a))/2;
  if(pace<60||pace>140)continue;
  for(const [t,opp] of [[h,a],[a,h]]){
   const x=agg[t.code]??={code:t.code,gp:0,poss:0,pf:0,pa:0};
   x.gp++;x.poss+=pace;x.pf+=t.points;x.pa+=opp.points;
  }
  allPoss+=pace;allPts+=h.points+a.points;n++;
 }
 if(n<20)return null;
 const basePace=allPoss/n,baseRating=100*(allPts/(2*allPoss));
 const teams={};
 for(const [code,t] of Object.entries(agg)){
  if(t.gp<minimum)continue;
  // Opponent- and season-level shrinkage prevents noisy small samples from
  // becoming extreme scores. Historical priors can replace this neutral prior
  // only when sourced and backtested.
  const weight=t.gp/(t.gp+12);
  teams[code]={gp:t.gp,pace:weight*t.poss/t.gp+(1-weight)*basePace,
   offense:weight*100*t.pf/t.poss+(1-weight)*baseRating,
   defense:weight*100*t.pa/t.poss+(1-weight)*baseRating};
 }
 return {teams,league:{pace:basePace,offense:baseRating},coverage:{games:n,teams:Object.keys(teams).length,minimum}};
}
function project(home,away,model,ratings){
 const h=model?.teams?.[home],a=model?.teams?.[away];
 if(!h||!a||!finite(ratings?.[home])||!finite(ratings?.[away]))return null;
 const possessions=(h.pace+a.pace)/2;
 const league=model.league.offense;
 const homeEfficiency=h.offense+a.defense-league;
 const awayEfficiency=a.offense+h.defense-league;
 // Calibrated NBA scoring home-court effect is intentionally NOT assumed.
 // Keep the scoring component neutral until an independent, rolling test
 // derives a defensible points-home parameter.
 const homePoints=possessions*homeEfficiency/100;
 const awayPoints=possessions*awayEfficiency/100;
 if(![homePoints,awayPoints].every(finite)||homePoints<70||awayPoints<70||homePoints>170||awayPoints>170)return null;
 const eloHome=1/(1+Math.pow(10,-(ratings[home]+45-ratings[away])/400));
 return {homePoints,awayPoints,possessions,margin:homePoints-awayPoints,total:homePoints+awayPoints,eloHome,
  projectedWinner:homePoints>=awayPoints?home:away,provisional:true};
}
root.RabbyPossessionModel={validate,build,project};
if(typeof module!=='undefined')module.exports={validate,build,project};
})(typeof window!=='undefined'?window:globalThis);

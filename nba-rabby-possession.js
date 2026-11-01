/* Rabby NBA possession forecast v2.
 * Scoring inputs: attributed, completed NBA box scores (FGA, OREB, TOV, FTA, PTS).
 * Independent USRS earned Elo is used ONLY for the win probability; never
 * overwritten by historical forecast priors or the scoring calculation.
 * Freeze historical margin/total calibration, do not fit it to today's games.
 */
(function(root){'use strict';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
function validate(stats){
 if(!['official_nba_boxscores','attributed_nba_boxscores'].includes(stats?.source_type)||!Array.isArray(stats.games)||stats.games.length<20)return false;
 const ids=new Set();
 return stats.games.every(g=>{
  if(!g?.id||ids.has(g.id)||g.final!==true||g.regular_season!==true||!Number.isFinite(Date.parse(g.date||'')))return false;
  ids.add(g.id);
  if(stats.source_type==='attributed_nba_boxscores'&&(!g.source||!/^https:\/\//.test(g.source_url||'')))return false;
  return ['home','away'].every(side=>{
   const t=g[side];return t&&/^[A-Z]{2,3}$/.test(t.code||'')&&
    ['points','fga','oreb','tov','fta'].every(k=>finite(t[k]))&&
    t.points>=60&&t.points<=180&&t.fga>0&&t.oreb>=0&&t.tov>=0&&t.fta>=0;
  })&&g.home.code!==g.away.code;
 });
}
function validCalibration(c){
 return c?.status==='historical_possession_diagnostic'&&
  Number(c.training_games)>=100&&Number(c.untouched_test_games)>=100&&
  ['margin','total'].every(k=>Array.isArray(c.coefficients?.[k])&&c.coefficients[k].length===2&&c.coefficients[k].every(finite));
}
function build(stats,minimum=4){
 if(!validate(stats)||!Number.isInteger(minimum)||minimum<1)return null;
 const totals={};let allPace=0,allPoss=0,allPoints=0,n=0;
 for(const g of [...stats.games].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date))){
  const h=g.home,a=g.away;
  const poss=t=>t.fga-t.oreb+t.tov+0.44*t.fta;
  const hPoss=poss(h),aPoss=poss(a),shared=(hPoss+aPoss)/2;
  const minutes=g.minutes??48,pace=shared*48/minutes;
  if(!finite(minutes)||minutes<48||minutes>90||hPoss<65||aPoss<65||hPoss>150||aPoss>150||pace<70||pace>130)continue;
  for(const [team,opponent] of [[h,a],[a,h]]){
   const row=totals[team.code]??={gp:0,poss:0,pace:0,pf:0,pa:0};
   row.gp++;row.poss+=shared;row.pace+=pace;row.pf+=team.points;row.pa+=opponent.points;
  }
  allPace+=pace;allPoss+=shared;allPoints+=h.points+a.points;n++;
 }
 if(n<20)return null;
 const basePace=allPace/n,baseOffense=100*allPoints/(2*allPoss),teams={};
 for(const [code,t] of Object.entries(totals)){
  if(t.gp<minimum)continue;
  // This 12-game neutral shrinkage and the frozen regression match the
  // already-documented 2025-26 possession-model validation method.
  const weight=t.gp/(t.gp+12);
  teams[code]={
   gp:t.gp,
   pace:weight*(t.pace/t.gp)+(1-weight)*basePace,
   offense:weight*(100*t.pf/t.poss)+(1-weight)*baseOffense,
   defense:weight*(100*t.pa/t.poss)+(1-weight)*baseOffense
  };
 }
 const cal=validCalibration(stats.calibration)?stats.calibration:null;
 // Never silently substitute an arbitrary scoring intercept for missing calibration.
 if(!cal)return null;
 return {teams,league:{pace:basePace,offense:baseOffense},
  calibration:{season:cal.season,trainingGames:cal.training_games,testGames:cal.untouched_test_games,
   coefficients:cal.coefficients,marginMAE:cal.metrics?.margin?.model_mae??null,totalMAE:cal.metrics?.total?.model_mae??null},
  coverage:{games:n,teams:Object.keys(teams).length,minimum,updatedAt:stats.updated_at,sourceType:stats.source_type}
 };
}
function project(home,away,model,ratings){
 const h=model?.teams?.[home],a=model?.teams?.[away];
 if(!h||!a||!finite(ratings?.[home])||!finite(ratings?.[away])||home===away)return null;
 const possessions=(h.pace+a.pace)/2,league=model.league.offense;
 const homeEff=h.offense+a.defense-league,awayEff=a.offense+h.defense-league;
 if(![possessions,homeEff,awayEff].every(finite)||possessions<70||possessions>130)return null;
 const baseHome=possessions*homeEff/100,baseAway=possessions*awayEff/100;
 // Home-court scoring is included once, in the frozen historical margin fit.
 const c=model.calibration.coefficients;
 const margin=c.margin[0]+c.margin[1]*(baseHome-baseAway);
 const total=c.total[0]+c.total[1]*(baseHome+baseAway);
 const homePoints=(total+margin)/2,awayPoints=(total-margin)/2;
 if(![homePoints,awayPoints,total,margin].every(finite)||homePoints<70||awayPoints<70||homePoints>170||awayPoints>170)return null;
 const homeWin=1/(1+10**(-(ratings[home]+40-ratings[away])/400));
 let homeScore=Math.round(homePoints),awayScore=Math.round(awayPoints);
 if(homeScore===awayScore){if(margin>0||(margin===0&&homeWin>=0.5))homeScore++;else awayScore++;}
 return {homePoints,awayPoints,homeScore,awayScore,margin,total,possessions,
  homeEfficiency:homeEff,awayEfficiency:awayEff,homeOffense:h.offense,awayOffense:a.offense,
  homeDefense:h.defense,awayDefense:a.defense,homeWin,eloHome:homeWin,
  projectedWinner:homeScore>awayScore?home:away,
  homeGames:h.gp,awayGames:a.gp,coverage:model.coverage,calibration:model.calibration,
  source:'Verified team possessions + historical calibrated margin and total',
  provisional:true};
}
root.RabbyPossessionModel={validate,build,project};
if(typeof module!=='undefined')module.exports={validate,build,project};
})(typeof window!=='undefined'?window:globalThis);

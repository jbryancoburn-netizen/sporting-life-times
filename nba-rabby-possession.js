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
function validatePriors(priors){
 const teams=priors?.teams;
 return priors?.season==='2025-26'&&/^https:\/\//.test(priors.source_url||'')&&
  teams&&Object.keys(teams).length===30&&Object.values(teams).every(t=>
   finite(t.offense)&&finite(t.defense)&&finite(t.pace)&&t.offense>85&&t.offense<140&&
   t.defense>85&&t.defense<140&&t.pace>85&&t.pace<115);
}
function build(stats,minimum=4,priors){
 if(!validate(stats)||!validatePriors(priors)||!Number.isInteger(minimum)||minimum<1)return null;
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
 const history=Object.values(priors.teams),historicalMean={
  offense:history.reduce((sum,x)=>sum+x.offense,0)/history.length,
  defense:history.reduce((sum,x)=>sum+x.defense,0)/history.length,
  pace:history.reduce((sum,x)=>sum+x.pace,0)/history.length
 };
 for(const [code,t] of Object.entries(totals)){
  if(t.gp<minimum)continue;
  // This 12-game neutral shrinkage and the frozen regression match the
  // already-documented 2025-26 possession-model validation method.
  const weight=t.gp/(t.gp+12),historicalWeight=6/(t.gp+12);
  const prior=priors.teams[code];
  if(!prior)return null;
  // Historical profiles enter as deviations from the 2025-26 league average,
  // not raw old scoring levels, avoiding artificial inflation/deflation.
  // Weight 6 was checked against 26 chronological 2026-27 previews; it is
  // a small pilot diagnostic, NOT a separate holdout or guarantee.
  teams[code]={
   gp:t.gp,priorWeight:historicalWeight,
   pace:basePace+weight*(t.pace/t.gp-basePace)+historicalWeight*(prior.pace-historicalMean.pace),
   offense:baseOffense+weight*(100*t.pf/t.poss-baseOffense)+historicalWeight*(prior.offense-historicalMean.offense),
   defense:baseOffense+weight*(100*t.pa/t.poss-baseOffense)+historicalWeight*(prior.defense-historicalMean.defense)
  };
 }
 const cal=validCalibration(stats.calibration)?stats.calibration:null;
 // Never silently substitute an arbitrary scoring intercept for missing calibration.
 if(!cal)return null;
 return {teams,league:{pace:basePace,offense:baseOffense},
  calibration:{season:cal.season,trainingGames:cal.training_games,testGames:cal.untouched_test_games,
   coefficients:cal.coefficients,marginMAE:cal.metrics?.margin?.model_mae??null,totalMAE:cal.metrics?.total?.model_mae??null},
  history:{season:priors.season,source:priors.source_url,effectiveGames:6,diagnosticGames:26,diagnosticMarginMAE:12.75,diagnosticTotalMAE:15.80,method:'2026-27 sequential exploratory pilot; not an untouched holdout'},
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
  homeGames:h.gp,awayGames:a.gp,coverage:model.coverage,calibration:model.calibration,history:model.history,
  source:'Verified 2026-27 possessions + sourced 2025-26 league-adjusted priors + frozen scoring calibration',
  provisional:true};
}
/* Scheduling context is observational. No fatigue points are assumed or
 * silently added to the forecast margin without separately tested effects.
 * Use Eastern calendar dates, not UTC hour gaps, for back-to-back games.
 */
function easternDay(value){
 const d=new Date(value);if(!Number.isFinite(+d))return null;
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',
  {timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'})
  .formatToParts(d).map(p=>[p.type,p.value]));
 return Math.floor(Date.UTC(+parts.year,+parts.month-1,+parts.day)/86400000);
}
function scheduleContext(team,tipoff,events=[]){
 const gameDay=easternDay(tipoff);
 if(!team||!Number.isFinite(gameDay)||!Array.isArray(events))return null;
 const prior=[];
 for(const g of events){
  const home=g.home||g.teams?.find(t=>t.home_away==='home')?.code;
  const away=g.away||g.teams?.find(t=>t.home_away==='away')?.code;
  if(home!==team&&away!==team)continue;
  const d=easternDay(g.date);
  if(Number.isFinite(d)&&d<gameDay)prior.push(d);
 }
 const days=[...new Set(prior)].sort((a,b)=>b-a);
 if(!days.length)return {known:false,restDays:null,backToBack:false,threeInFour:false,fourInSix:false,previousGame:null};
 const diff=gameDay-days[0];
 return {known:true,restDays:Math.max(0,diff-1),backToBack:diff===1,
  threeInFour:days.filter(d=>gameDay-d<=3).length>=2,
  fourInSix:days.filter(d=>gameDay-d<=5).length>=3,
  previousGame:days[0]};
}
function restDisplay(context){
 if(!context?.known)return 'No earlier game in verified ledger';
 const rest=context.restDays;
 const parts=[context.backToBack?'Back-to-back':rest===1?'1 day off':rest===0?'0 days off':rest+' days off'];
 if(context.threeInFour)parts.push('3 games in 4 days');
 else if(context.fourInSix)parts.push('4 games in 6 days');
 return parts.join(' · ');
}
root.RabbyPossessionModel={validate,build,project,scheduleContext,restDisplay};
if(typeof module!=='undefined')module.exports={validate,build,project,scheduleContext,restDisplay};
})(typeof window!=='undefined'?window:globalThis);

#!/usr/bin/env node
/* One published NBA RETRO forecast file. No projections are calculated in the browser.
   Calibrated to the existing NBA possession model and earned team Elo. */
const fs=require('node:fs');
const files={
 elo:'data/nba-elo-shadow-2026-27.json',
 games:'data/nba-possession-inputs.json',
 history:'data/nba-2025-26-team-advanced.json',
 schedule:'data/nba-upcoming-schedule.json',
 output:'data/nba-game-predictions.json'
};
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const elo=read(files.elo),stats=read(files.games),priors=read(files.history),schedule=read(files.schedule);
const fail=message=>{throw new Error('NBA predictions: '+message)};
const finite=Number.isFinite;
const teamCodes='ATL BOS BKN CHA CHI CLE DAL DEN DET GSW HOU IND LAC LAL MEM MIA MIL MIN NOP NYK OKC ORL PHI PHX POR SAC SAS TOR UTA WAS'.split(' ');
const codes=new Set(teamCodes);
if(elo.status!=='primary_live_earned_elo'||elo.parameters?.season_start_elo!==1500||elo.parameters?.home_elo!==40)fail('wrong earned RETRO model');
if(stats.source_type!=='attributed_nba_boxscores'||stats.games?.length<20||priors.season!=='2025-26')fail('missing qualified scoring inputs');
if(!/^https:\/\//.test(priors.source_url||'')||Object.keys(priors.teams||{}).length!==30)fail('invalid historical priors');
const c=stats.calibration;
if(c?.status!=='historical_possession_diagnostic'||c.training_games<100||c.untouched_test_games<100||!['margin','total'].every(k=>c.coefficients?.[k]?.length===2&&c.coefficients[k].every(finite)))fail('historical calibration missing');
const ratings=Object.fromEntries(elo.rankings.map(x=>[x.team,x.elo]));
if(teamCodes.some(t=>!finite(ratings[t])))fail('all 30 earned RETRO ratings are required');
const totals={},used=new Set();
let allPace=0,allPoss=0,allPoints=0,n=0;
for(const g of [...stats.games].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date))){
 if(!g.id||used.has(g.id)||g.final!==true||g.regular_season!==true||!Number.isFinite(Date.parse(g.date))||!/^https:\/\//.test(g.source_url||''))fail('invalid or duplicate completed game');
 used.add(g.id);
 const h=g.home,a=g.away;
 if(!h||!a||!codes.has(h.code)||!codes.has(a.code)||h.code===a.code)fail('invalid team pair');
 for(const t of [h,a])if(!['points','fga','oreb','tov','fta'].every(k=>finite(t[k]))||t.points<60||t.points>180||t.fga<=0||t.oreb<0||t.tov<0||t.fta<0)fail('invalid team box');
 const hp=h.fga-h.oreb+h.tov+.44*h.fta,ap=a.fga-a.oreb+a.tov+.44*a.fta;
 const poss=(hp+ap)/2,minutes=g.minutes??48,pace=poss*48/minutes;
 if(!finite(minutes)||minutes<48||minutes>90||hp<65||ap<65||hp>150||ap>150||pace<70||pace>130)continue;
 for(const [t,o] of [[h,a],[a,h]]){
  const row=totals[t.code]??={gp:0,poss:0,pace:0,pf:0,pa:0};
  row.gp++;row.poss+=poss;row.pace+=pace;row.pf+=t.points;row.pa+=o.points;
 }
 allPace+=pace;allPoss+=poss;allPoints+=h.points+a.points;n++;
}
if(n<20)fail('too few qualified games');
const basePace=allPace/n,baseOff=100*allPoints/(2*allPoss);
const history=Object.values(priors.teams),avg=k=>history.reduce((s,x)=>s+x[k],0)/history.length;
const mean={offense:avg('offense'),defense:avg('defense'),pace:avg('pace')};
const model={};
for(const t of teamCodes){
 const z=totals[t],p=priors.teams[t];if(!z||z.gp<4||!p)fail('missing team possession coverage: '+t);
 const w=z.gp/(z.gp+12),h=6/(z.gp+12);
 model[t]={games:z.gp,pace:basePace+w*(z.pace/z.gp-basePace)+h*(p.pace-mean.pace),
 offense:baseOff+w*(100*z.pf/z.poss-baseOff)+h*(p.offense-mean.offense),
 defense:baseOff+w*(100*z.pa/z.poss-baseOff)+h*(p.defense-mean.defense)};
}
const now=Date.now(),seen=new Set(),out=[];
for(const g of (schedule.games||[]).filter(x=>x.state==='pre'&&Date.parse(x.date)>now).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date))){
 const home=g.teams?.find(x=>x.home_away==='home'),away=g.teams?.find(x=>x.home_away==='away');
 if(!g.id||seen.has(g.id)||!home||!away||!codes.has(home.code)||!codes.has(away.code))fail('invalid scheduled future game');
 seen.add(g.id);
 const h=model[home.code],a=model[away.code],poss=(h.pace+a.pace)/2;
 const homeEff=h.offense+a.defense-baseOff,awayEff=a.offense+h.defense-baseOff;
 const baseHome=poss*homeEff/100,baseAway=poss*awayEff/100;
 const margin=c.coefficients.margin[0]+c.coefficients.margin[1]*(baseHome-baseAway);
 const total=c.coefficients.total[0]+c.coefficients.total[1]*(baseHome+baseAway);
 const hp=(total+margin)/2,ap=(total-margin)/2;
 if(![poss,homeEff,awayEff,margin,total,hp,ap].every(finite)||poss<70||poss>130||hp<70||hp>170||ap<70||ap>170)fail('out-of-bounds projection '+g.id);
 const homeWin=1/(1+10**(-(ratings[home.code]+40-ratings[away.code])/400));
 let homeScore=Math.round(hp),awayScore=Math.round(ap);
 if(homeScore===awayScore){if(margin>0||(margin===0&&homeWin>=.5))homeScore++;else awayScore++;}
 const favorite=margin>=0?home.code:away.code,half=Math.round(Math.abs(margin)*2)/2;
 out.push({
  id:String(g.id).replace(/^espn-nba-/,''),date:g.date,
  home:home.code,away:away.code,
  spread_team:half===0?null:favorite,spread_points:half,
  spread_label:half===0?'EVEN':favorite+' -'+half.toFixed(1),
  projected_home_score:homeScore,projected_away_score:awayScore,
  projected_total:Math.round(total*10)/10,
  home_win_probability:Math.round(homeWin*1000)/1000,
  away_win_probability:Math.round((1-homeWin)*1000)/1000,
  scoring_favorite:favorite,elo_favorite:homeWin>=.5?home.code:away.code,
  data_games_home:h.games,data_games_away:a.games
 });
}
if(!out.length)fail('no upcoming scheduled games; refusing to replace existing forecasts with an empty file');
const result={schema_version:1,league:'NBA',season:'2026-27',generated_at:new Date().toISOString(),
 schedule_updated_at:schedule.updated_at||null,scoring_updated_at:stats.updated_at||null,
 model:'RETRO earned Elo + existing frozen-calibration possession forecast',
 rounding:'nearest 0.5 point',coverage:{ranked_teams:30,verified_box_scores:n,scheduled_upcoming:out.length,projected_upcoming:out.length},games:out};
if(result.coverage.projected_upcoming!==result.coverage.scheduled_upcoming)fail('forecast coverage incomplete');
fs.writeFileSync(files.output,JSON.stringify(result,null,2)+'\n');
console.log('NBA forecasts published:',out.length,'of',out.length,'upcoming games');

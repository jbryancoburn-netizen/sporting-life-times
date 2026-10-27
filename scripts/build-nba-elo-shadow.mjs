#!/usr/bin/env node
// Read-only shadow Elo replay: NEVER writes the active Elo publication.
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>JSON.parse(readFileSync(new URL('../data/'+p,import.meta.url),'utf8'));
const live=read('nba-2026-27-current-provisional.json');
const active=read('nba-elo-active.json');
assert.equal(active.primary_rankings_path,'data/nba-elo-shadow-2026-27.json','Active NBA ratings must be the 1500-reset model');
assert.equal(live.season,'2026-27');
const teams=live.rankings.map(r=>r.team).sort();
assert.equal(teams.length,30);
assert.equal(new Set(teams).size,30);
const earned=Object.fromEntries(teams.map(t=>[t,1500]));
const priorFinal=read('nba-2025-26-final.json');
assert.equal(priorFinal.season,'2025-26');
const priorMap=Object.fromEntries(priorFinal.rankings.map(r=>[r.team,r.elo]));
assert.deepEqual(Object.keys(priorMap).sort(),teams,'Prior-season team coverage differs');
const played=Object.fromEntries(teams.map(t=>[t,0]));
const forecastPrior=Object.fromEntries(teams.map(t=>[t,1500+.75*(priorMap[t]-1500)]));
const seen=new Set();
const games=[...live.events].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
let sum=0;
const replay=[];
for(const g of games){
 assert.ok(!seen.has(g.id),'Duplicate final '+g.id);seen.add(g.id);
 assert.ok(teams.includes(g.home)&&teams.includes(g.away)&&g.home!==g.away,'Invalid teams');
 assert.ok(Number.isInteger(g.home_score)&&Number.isInteger(g.away_score)&&g.home_score!==g.away_score,'Invalid final score');
 assert.ok(Number.isFinite(Date.parse(g.date)),'Invalid date');
 const beforeH=earned[g.home],beforeA=earned[g.away];
 const weightH=.75*10/(10+played[g.home]),weightA=.75*10/(10+played[g.away]);
 const predictiveH=(1-weightH)*beforeH+weightH*forecastPrior[g.home];
 const predictiveA=(1-weightA)*beforeA+weightA*forecastPrior[g.away];
 const forecastP=1/(1+10**((predictiveA-predictiveH-40)/400));
 const p=1/(1+10**((beforeA-beforeH-40)/400));
 const mov=Math.sqrt(Math.max(1,Math.abs(g.home_score-g.away_score))/10);
 const y=Number(g.home_score>g.away_score);
 const change=24*mov*(y-p);
 earned[g.home]+=change;earned[g.away]-=change;
 played[g.home]++;played[g.away]++;
 replay.push({id:g.id,date:g.date,home:g.home,away:g.away,home_score:g.home_score,away_score:g.away_score,home_before:beforeH,away_before:beforeA,home_win_probability:p,forecast_home_win_probability:forecastP,forecast_prior_weight_home:weightH,forecast_prior_weight_away:weightA,home_elo_change:change,home_after:earned[g.home],away_after:earned[g.away]});
}
assert.equal(replay.length,live.games_played,'Published finals count mismatch');
assert.ok(Math.abs(Object.values(earned).reduce((s,x)=>s+x,0)-45000)<1e-7,'Zero-sum invariant failed');
const ratings=teams.map(team=>({team,elo:Number(earned[team].toFixed(3)),games:games.filter(g=>g.home===team||g.away===team).length})).sort((a,b)=>b.elo-a.elo||a.team.localeCompare(b.team));
const liveMap=Object.fromEntries(live.rankings.map(r=>[r.team,r.elo]));
const result={league:'NBA',season:'2026-27',status:'shadow_not_published',model:'team_only_reset1500_home40_k24_sqrt_mov',source:'data/nba-2026-27-current-provisional.json',games_played:replay.length,parameters:{season_start_elo:1500,home_elo:40,k:24,mov:'sqrt(max(1,abs(margin))/10)',historical_prediction_prior:'2025-26 final team Elo, regression .75; prediction blend weight .75*10/(10+team_games), never applied to earned Elo'},rankings:ratings.map(x=>({...x,forecast_prior:forecastPrior[x.team],live_elo:liveMap[x.team],difference_from_live:Number((x.elo-liveMap[x.team]).toFixed(3))})),events:replay};
if(!process.argv.includes('--write')){
 const saved=read('nba-elo-shadow-2026-27.json');
 assert.equal(saved.games_played,result.games_played,'Shadow snapshot stale: game count');
 assert.equal(saved.events?.length,result.events.length,'Shadow snapshot event count');
 for(let i=0;i<result.events.length;i++){
  const actual=result.events[i],stored=saved.events[i];
  assert.equal(stored.id,actual.id,'Shadow game order/id mismatch');
  for(const key of ['home_elo_change','forecast_home_win_probability','home_win_probability'])
   assert.ok(Number.isFinite(stored[key])&&Math.abs(stored[key]-actual[key])<1e-9,'Shadow event mismatch '+actual.id+' '+key);
 }
 const savedMap=Object.fromEntries(saved.rankings.map(x=>[x.team,x]));
 for(const row of result.rankings)assert.ok(Math.abs(savedMap[row.team]?.elo-row.elo)<.001,'Shadow Elo mismatch '+row.team);
}
if(process.argv.includes('--write')){writeFileSync(new URL('../data/nba-elo-shadow-2026-27.json',import.meta.url),JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify({status:'PASS',mode:'shadow_only',games:replay.length,teams:ratings.length,elo_sum:Object.values(earned).reduce((s,x)=>s+x,0),leader:ratings[0],production_unchanged:true},null,2));

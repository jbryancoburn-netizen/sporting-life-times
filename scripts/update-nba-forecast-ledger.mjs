#!/usr/bin/env node
/* NBA Rabby prospective, immutable scoring snapshots; never backfill old games. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const rabby=require('../nba-rabby-possession.js');
const root=new URL('../data/',import.meta.url);
const input=p=>JSON.parse(readFileSync(new URL(p,root),'utf8'));
const digest=v=>createHash('sha256').update(v).digest('hex');
const hash=p=>digest(readFileSync(new URL(p,root),'utf8'));
const round=(x,n=3)=>Number(x.toFixed(n));
const mean=arr=>arr.length?arr.reduce((s,x)=>s+x,0)/arr.length:null;
function validate(ledger){
 assert.equal(ledger.schema,'rabby-nba-prospective-v1');
 assert.equal(ledger.season,'2026-27');
 assert.ok(Array.isArray(ledger.forecasts)&&ledger.results&&typeof ledger.results==='object');
 assert.ok(!ledger.exceptions||(typeof ledger.exceptions==='object'&&!Array.isArray(ledger.exceptions)));
 const keys=new Set(),games=new Map();
 for(const f of ledger.forecasts){
  assert.ok(f.id&&['early','near_tipoff'].includes(f.phase));
  assert.ok(Number.isFinite(Date.parse(f.captured_at))&&Number.isFinite(Date.parse(f.date)));
  assert.ok(Date.parse(f.captured_at)+10*60000<Date.parse(f.date),'Post-tipoff or cutoff forecast: '+f.id);
  assert.ok(f.away!==f.home&&/^[A-Z]{2,3}$/.test(f.away)&&/^[A-Z]{2,3}$/.test(f.home));
  assert.ok(Number.isInteger(f.away_score)&&Number.isInteger(f.home_score)&&f.away_score!==f.home_score);
  assert.ok(Number.isFinite(f.home_win_prob)&&f.home_win_prob>0&&f.home_win_prob<1);
  assert.ok(f.inputs?.earned_sha256&&f.inputs?.boxscores_sha256&&f.inputs?.priors_sha256&&f.model_version);
  const key=f.id+':'+f.phase;assert.ok(!keys.has(key),'Duplicate forecast '+key);keys.add(key);
  const before=games.get(f.id);
  if(before){assert.equal(before.home,f.home);assert.equal(before.away,f.away);}
  else games.set(f.id,{home:f.home,away:f.away});
 }
 for(const [id,x] of Object.entries(ledger.exceptions||{})){
  assert.ok(games.has(id),'Unpredicted fixture exception '+id);
  assert.equal(x.reason,'schedule_changed');
  assert.ok(Number.isFinite(Date.parse(x.detected_at))&&Number.isFinite(Date.parse(x.original_date))&&Number.isFinite(Date.parse(x.revised_date)));
 }
 for(const [id,g] of Object.entries(ledger.results)){
  assert.ok(games.has(id),'Unpredicted result '+id);
  assert.equal(g.home,games.get(id).home);assert.equal(g.away,games.get(id).away);
  assert.ok(Number.isInteger(g.home_score)&&Number.isInteger(g.away_score)&&g.home_score!==g.away_score);
 }
 return true;
}
function metrics(ledger){
 // Separate early vs near-tipoff; also partition by immutable model source hash.
 // A new model version must never inherit the previous version's reputation.
 const summarize=(forecasts)=>{
  const rows=forecasts.filter(f=>ledger.results[f.id]&&!ledger.exceptions?.[f.id]).map(f=>{
   const g=ledger.results[f.id],margin=g.home_score-g.away_score,total=g.home_score+g.away_score;
   return {teams:(Math.abs(g.home_score-f.home_score)+Math.abs(g.away_score-f.away_score))/2,
    margin:Math.abs(f.margin-margin),total:Math.abs(f.total-total),
    baseline:Math.abs(f.league_total_baseline-total),
    brier:(f.home_win_prob-Number(margin>0))**2,
    winner:Number((f.home_win_prob>=.5)===(margin>0))};
  });
  const x=k=>rows.length?round(mean(rows.map(r=>r[k]))):null;
  return {sample:rows.length,team_score_mae:x('teams'),margin_mae:x('margin'),
   total_mae:x('total'),league_total_baseline_mae:x('baseline'),
   elo_brier:x('brier'),elo_winner_accuracy:x('winner')};
 };
 const phases=['early','near_tipoff'],result={};
 for(const phase of phases)result[phase]=summarize(ledger.forecasts.filter(f=>f.phase===phase));
 const versions=[...new Set(ledger.forecasts.map(f=>f.model_version))].sort();
 result.by_model_version=Object.fromEntries(versions.map(version=>[version,{
  forecasts:ledger.forecasts.filter(f=>f.model_version===version).length,
  ...Object.fromEntries(phases.map(phase=>[phase,summarize(ledger.forecasts.filter(f=>f.phase===phase&&f.model_version===version))]))
 }]));
 return result;
}
function updateLedger(previous,sources,now=new Date().toISOString()){
 const {schedule,earned,stats,history,fingerprints}=sources,t=Date.parse(now);
 assert.ok(Number.isFinite(t),'Invalid capture time');
 assert.ok(Array.isArray(schedule?.games),'NBA schedule unavailable');
 const scheduleStamp=Date.parse(schedule.updated_at||'');
 // Grade existing forecasts even when schedules are stale, but never freeze new ones.
 const freshSchedule=Number.isFinite(scheduleStamp)&&scheduleStamp<=t+300000&&t-scheduleStamp<=60*60000;
 assert.equal(earned.status,'primary_live_earned_elo','Forecasts require true earned USRS Elo');
 assert.equal(earned.parameters?.season_start_elo,1500);
 assert.equal(earned.parameters?.home_elo,40);
 assert.equal(earned.games_played,earned.events?.length);
 const ratings=Object.fromEntries((earned.rankings||[]).map(r=>[r.team,r.elo]));
 assert.equal(Object.keys(ratings).length,30);
 const model=rabby.build(stats,4,history);
 assert.ok(model&&model.coverage.teams===30,'Missing team possession coverage');
 const verified=new Map(earned.events.map(g=>[g.id,g]));
 assert.equal(verified.size,earned.events.length,'Duplicate IDs in earned Elo final ledger');
 const earnedHasFutureFinal=earned.events.some(g=>!Number.isFinite(Date.parse(g.date))||Date.parse(g.date)>=t);
 // Provider identifiers are not guaranteed identical. ESPN and NBA official
 // boxscore records can refer to the same contest with different ID schemes.
 // Match only when final team identity, exact final points and game time agree.
 const agrees=(box,final)=>{
  const stamped=Math.abs(Date.parse(box.date)-Date.parse(final.date));
  return box.home.code===final.home&&box.away.code===final.away&&
   box.home.points===final.home_score&&box.away.points===final.away_score&&
   Number.isFinite(stamped)&&stamped<24*3600000;
 };
 const reconcileBox=box=>{
  const direct=verified.get(box.id);
  if(direct)return agrees(box,direct);
  const matches=earned.events.filter(g=>agrees(box,g));
  return matches.length===1;
 };
 assert.ok(stats.games.every(reconcileBox),'Possession data not reconcilable to earned Elo');
 assert.ok(Date.parse(stats.updated_at)<=t+300000,'Future-dated possession dataset');
 assert.ok(stats.games.every(g=>Date.parse(g.date)<t),'Future game in historic scoring inputs');
 const ledger=previous?structuredClone(previous):{
  schema:'rabby-nba-prospective-v1',season:'2026-27',created_at:now,updated_at:now,
  method:'First qualifying early (>2h) or near-tipoff (10-120m) snapshot is final. Never create a retrospective forecast.',
  forecasts:[],results:{},exceptions:{},metrics:{}
 };
 validate(ledger);
 if(!ledger.exceptions)ledger.exceptions={};
 const present=new Set(ledger.forecasts.map(f=>f.id+':'+f.phase));
 let added=0,graded=0,flagged=0,skippedStale=0;
 const seen=new Set();
 for(const g of schedule.games){
  if(!g.id||seen.has(g.id))continue;seen.add(g.id);
  const until=Date.parse(g.date)-t;
  const earlier=ledger.forecasts.filter(f=>f.id===g.id);
  const away=g.teams?.find(z=>z.home_away==='away')?.code;
  const home=g.teams?.find(z=>z.home_away==='home')?.code;
  const timeChanged=earlier.length&&Number.isFinite(Date.parse(g.date))&&earlier.some(f=>f.away!==away||f.home!==home||Date.parse(f.date)!==Date.parse(g.date));
  if(timeChanged){
   if(!ledger.exceptions[g.id]){
    ledger.exceptions[g.id]={reason:'schedule_changed',detected_at:now,
     original_date:earlier[0].date,revised_date:g.date};flagged++;
   }
   continue;
  }
  if(g.state!=='pre'||verified.has(g.id)||!Number.isFinite(until)||until<=10*60000||until>24*3600000)continue;
  if(!freshSchedule||earnedHasFutureFinal){skippedStale++;continue;}
  const phase=until<=2*3600000?'near_tipoff':'early';
  if(present.has(g.id+':'+phase))continue;
  const a=away,h=home;
  if(!ratings[a]||!ratings[h]||a===h)continue;
  const p=rabby.project(h,a,model,ratings);
  if(!p)continue;
  ledger.forecasts.push({
   id:g.id,date:g.date,away:a,home:h,phase,captured_at:now,
   away_score:p.awayScore,home_score:p.homeScore,total:round(p.total),
   margin:round(p.margin),pace:round(p.possessions),home_win_prob:round(p.homeWin,6),
   league_total_baseline:round(2*model.league.pace*model.league.offense/100),
   source_games:model.coverage.games,away_games:p.awayGames,home_games:p.homeGames,
   model_version:fingerprints.model,
   inputs:{earned_sha256:fingerprints.earned,boxscores_sha256:fingerprints.stats,
    priors_sha256:fingerprints.history,schedule_sha256:fingerprints.schedule}
  });
  present.add(g.id+':'+phase);added++;
 }
 for(const [id,g] of verified){
  if(ledger.results[id]||ledger.exceptions[id])continue;
  const forecast=ledger.forecasts.find(f=>f.id===id);if(!forecast)continue;
  if(forecast.home!==g.home||forecast.away!==g.away)
   throw Error('Verified final identity contradicts frozen forecast: '+id);
  if(!Number.isFinite(Date.parse(g.date))||Date.parse(g.date)+60*60000>t)continue;
  if(!Number.isInteger(g.home_score)||!Number.isInteger(g.away_score)||g.home_score===g.away_score)continue;
  ledger.results[id]={away:g.away,home:g.home,away_score:g.away_score,
   home_score:g.home_score,verified_at:now,source:'USRS 1500-reset earned Elo verified final'};
  graded++;
 }
 if(added||graded||flagged){
  ledger.forecasts.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)||a.phase.localeCompare(b.phase));
  ledger.updated_at=now;ledger.metrics=metrics(ledger);
 }
 validate(ledger);
 return {ledger,added,graded,flagged,skippedStale,changed:!!(added||graded||flagged)};
}
export {updateLedger,validate,metrics};
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const path=new URL('nba-rabby-forecast-ledger.json',root);
 const previous=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):null;
 const sources={schedule:input('nba-upcoming-schedule.json'),
  earned:input('nba-elo-shadow-2026-27.json'),
  stats:input('nba-possession-inputs.json'),
  history:input('nba-2025-26-team-advanced.json'),
  fingerprints:{earned:hash('nba-elo-shadow-2026-27.json'),
   stats:hash('nba-possession-inputs.json'),
   history:hash('nba-2025-26-team-advanced.json'),
   schedule:hash('nba-upcoming-schedule.json'),
   model:digest(readFileSync(new URL('../nba-rabby-possession.js',import.meta.url),'utf8')).slice(0,20)}
 };
 const {ledger,added,graded,flagged,skippedStale,changed}=updateLedger(previous,sources);
 if(changed||!existsSync(path))writeFileSync(path,JSON.stringify(ledger,null,2)+'\n');
 console.log('Rabby NBA forecast ledger:',ledger.forecasts.length,'frozen,',added,'new,',graded,'graded,',flagged,'reschedules,',skippedStale,'stale withheld; early',ledger.metrics.early?.sample||0,'near-tipoff',ledger.metrics.near_tipoff?.sample||0);
}
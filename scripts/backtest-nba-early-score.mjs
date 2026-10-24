#!/usr/bin/env node
// Chronological diagnostic only: never promotes or changes the live model.
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const model=require('../nba-rabby-early-score.js');
const read=p=>JSON.parse(readFileSync(new URL('../data/'+p,import.meta.url),'utf8'));
const opening=read('nba-2026-27-preseason-provisional.json');
const current=read('nba-2026-27-current-provisional.json');
const games=[...current.events].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)||a.id.localeCompare(b.id));
assert.equal(new Set(games.map(g=>g.id)).size,games.length,'Duplicate game IDs');
const ratings=Object.fromEntries(opening.rankings.map(r=>[r.team,r.elo]));
const p=opening.parameters,rows=[];
// Without final-whistle timestamps, only prior Eastern-calendar-date games
// qualify as training data. Games played on the same date never train each other.
const day=v=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));
for(const date of [...new Set(games.map(g=>day(g.date)))].sort()){
 const training=games.filter(g=>day(g.date)<date);
 const fitted=model.build(training);
 for(const game of games.filter(g=>day(g.date)===date)){
  if(!fitted)continue;
  const prediction=model.project(game.home,game.away,fitted,ratings);
  if(!prediction)continue;
  const avgMargin=training.reduce((s,g)=>s+g.home_score-g.away_score,0)/training.length;
  const actualMargin=game.home_score-game.away_score,actualTotal=game.home_score+game.away_score;
  rows.push({id:game.id,date:game.date,training_games:training.length,training_last_date:day(training.at(-1).date),
   predicted_home:prediction.homePoints,predicted_away:prediction.awayPoints,
   margin_absolute_error:Math.abs(prediction.margin-actualMargin),
   total_absolute_error:Math.abs(prediction.total-actualTotal),
   baseline_margin_absolute_error:Math.abs(avgMargin-actualMargin),
   baseline_total_absolute_error:Math.abs(fitted.total-actualTotal),
   brier:(prediction.homeWin-(actualMargin>0?1:0))**2});
 }
 for(const g of games.filter(g=>day(g.date)===date)){
  const expected=1/(1+10**(-(ratings[g.home]+p.home_elo-ratings[g.away])/400));
  const delta=p.k*(1+p.mov_weight*Math.log10(1+Math.abs(g.home_score-g.away_score)))*((g.home_score>g.away_score?1:0)-expected);
  ratings[g.home]+=delta;ratings[g.away]-=delta;
 }
}
assert.ok(rows.every(r=>r.training_last_date<day(r.date)),'Training leakage');
for(const r of current.rankings)assert.ok(Math.abs(ratings[r.team]-r.elo)<.002,'Independent replay mismatch '+r.team);
assert.ok(rows.every(r=>Object.values(r).every(v=>typeof v!=='number'||Number.isFinite(v))),'Non-finite diagnostic');
const avg=key=>rows.length?rows.reduce((s,r)=>s+r[key],0)/rows.length:null;
const report={model:'Experimental early-season NBA Elo score model',status:'diagnostic_only_not_release_approval',
 games_available:games.length,evaluated_games:rows.length,evaluated_dates:[...new Set(rows.map(r=>day(r.date)))],
 method:'Train only on completed games from earlier Eastern calendar dates; replay independent Elo from fixed opening baseline after each date. Baseline uses prior-game mean total and mean home margin.',
 metrics:{margin_mae:avg('margin_absolute_error'),baseline_margin_mae:avg('baseline_margin_absolute_error'),total_mae:avg('total_absolute_error'),baseline_total_mae:avg('baseline_total_absolute_error'),elo_win_brier:avg('brier')},
 limitations:['Tiny current-season sample; no historical-season validation or calibration claim.','No archived pregame forecasts; reconstructed diagnostic only.','Scoring totals are league means, identical to the simple baseline; no matchup-specific pace or efficiency inputs.','No roster or injury inputs.'],rows};
writeFileSync(new URL('../data/nba-early-score-backtest.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,rows:undefined},null,2));

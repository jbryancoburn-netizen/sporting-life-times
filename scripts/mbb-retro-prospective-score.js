#!/usr/bin/env node
/* Score genuine pregame RETRO margin forecasts against verified final scores.
   Historical GitHub snapshots and current-day captures remain separate and auditable. */
'use strict';
const fs=require('node:fs');
const load=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const baselinePath='data/mbb-retro-spread-benchmark-2026-11-06-07.json';
const capturePath='data/mbb-retro-pregame-spreads-2026-27.json';
const outputPath='data/mbb-retro-prospective-score-2026-27.json';
const results=load('data/mbb-retro-live-finals.json');
const baseline=load(baselinePath);
const archive=fs.existsSync(capturePath)?load(capturePath):{forecasts:[]};
if(!Array.isArray(results.games)||!Array.isArray(baseline.forecasts)||!Array.isArray(archive.forecasts))throw Error('Invalid scoring inputs');
const byId=new Map(results.games.map(g=>[String(g.id),g]));
const seen=new Set(), scored=[], exclusions={unmatched:0,late_or_invalid_tipoff:0,placeholder_tipoff:0,team_conflict:0,postgame_ratings:0,invalid_forecast:0,invalid_final:0,duplicate:0};
const eastern=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
for(const [source,rows] of [['archived_git_snapshot',baseline.forecasts],['daily_pretip_capture',archive.forecasts]]){
  for(const p of rows){
    const id=String(p.game_id);
    if(seen.has(id)){exclusions.duplicate++;continue;}
    seen.add(id);
    const g=byId.get(id);
    if(!g){exclusions.unmatched++;continue;}
    const rec=Date.parse(p.recorded_at),tip=Date.parse(p.tipoff_at);
    if(!Number.isFinite(rec)||!Number.isFinite(tip)||rec>=tip){exclusions.late_or_invalid_tipoff++;continue;}
    if(eastern.format(new Date(tip))==='23:59'){exclusions.placeholder_tipoff++;continue;}
    if(String(p.home_id)!==String(g.home_id)||String(p.away_id)!==String(g.away_id)){exclusions.team_conflict++;continue;}
    if(!p.ratings_as_of||p.ratings_as_of>=p.game_date){exclusions.postgame_ratings++;continue;}
    const forecast=p.projected_home_margin,prob=p.home_win_probability;
    if(typeof forecast!=='number'||!Number.isFinite(forecast)||typeof prob!=='number'||prob<=0||prob>=1){exclusions.invalid_forecast++;continue;}
    const h=g.home_score,a=g.away_score;
    if(!Number.isInteger(h)||!Number.isInteger(a)||h===a||h<=0||a<=0){exclusions.invalid_final++;continue;}
    const actual=h-a,err=forecast-actual,win=actual>0?1:0;
    scored.push({game_id:id,date:p.game_date,source,actual_home_margin:actual,predicted_home_margin:forecast,
      absolute_error:Math.abs(err),signed_error:err,home_win_probability:prob,
      correct_winner:forecast===0?false:(forecast>0)===(actual>0),no_winner_pick:forecast===0,
      venue_verification:p.venue_verification||'unverified'});
  }
}
const round=x=>Number(x.toFixed(4));
function summarize(rows){
  const n=rows.length, sum=fn=>rows.reduce((a,r)=>a+fn(r),0);
  if(!n)return {games:0,correct_winners:0,winner_accuracy:null,decisive_winner_accuracy:null,
    no_winner_picks:0,margin_mae:null,margin_rmse:null,within_5_points:null,within_10_points:null,brier:null,
    signed_margin_bias:null,mean_projected_absolute_margin:null,mean_actual_absolute_margin:null};
  const won=sum(r=>r.correct_winner?1:0),noPick=sum(r=>r.no_winner_pick?1:0);
  return {games:n,correct_winners:won,winner_accuracy:round(won/n),
    decisive_winner_accuracy:n-noPick?round(won/(n-noPick)):null,no_winner_picks:noPick,
    margin_mae:round(sum(r=>r.absolute_error)/n),
    margin_rmse:round(Math.sqrt(sum(r=>r.signed_error**2)/n)),
    within_5_points:round(sum(r=>r.absolute_error<=5?1:0)/n),
    within_10_points:round(sum(r=>r.absolute_error<=10?1:0)/n),
    brier:round(sum(r=>(r.home_win_probability-(r.actual_home_margin>0?1:0))**2)/n),
    signed_margin_bias:round(sum(r=>r.signed_error)/n),
    mean_projected_absolute_margin:round(sum(r=>Math.abs(r.predicted_home_margin))/n),
    mean_actual_absolute_margin:round(sum(r=>Math.abs(r.actual_home_margin))/n)};
}
const days=[...new Set(scored.map(x=>x.date))].sort();
const out={season:'2026-27',status:'VERIFIED_PRETIPOFF_MARGIN_AUDIT',
 method:'Saved pregame GitHub forecast versions (Nov 6-7) plus immutable pretipoff captures, exact game/team IDs, no postgame ratings. Errors in points. Zero projected margin means no winner pick.',
 source_finals:'data/mbb-retro-live-finals.json',results_through:results.games.map(g=>g.date).filter(Boolean).sort().at(-1)||null,
 baseline:summarize(scored.filter(r=>r.source==='archived_git_snapshot')),
 prospective:summarize(scored.filter(r=>r.source==='daily_pretip_capture')),
 combined:summarize(scored), by_day:days.map(date=>({date,...summarize(scored.filter(r=>r.date===date))})),
 exclusions,details:scored.sort((a,b)=>a.date.localeCompare(b.date)||a.game_id.localeCompare(b.game_id))};
fs.writeFileSync(outputPath,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({status:out.status,baseline:out.baseline,prospective:out.prospective,combined:out.combined,exclusions}));

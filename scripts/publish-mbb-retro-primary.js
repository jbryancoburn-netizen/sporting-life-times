#!/usr/bin/env node
/* Publish the preferred RETRO preseason ratings without importing chronological Elo.
   Completed prior-season games determine independent RETRO team strength.
   Existing verified roster adjustment is carried over unchanged and explicitly labeled.
*/
const fs=require('node:fs');
require('../mbb-retro.js');
const prior=JSON.parse(fs.readFileSync('data/mbb-2025-2026-results.json','utf8'));
const pre=JSON.parse(fs.readFileSync('data/ncaam-2026-27-preseason-player-quality-live.json','utf8'));
const cross=JSON.parse(fs.readFileSync('data/ncaam-2026-27-espn-team-crosswalk.json','utf8'));
if(!prior.audit?.complete||prior.games?.length<4000||pre.rankings?.length!==365)throw Error('Cannot certify RETRO input');
const calculated=globalThis.MBB_RETRO.calculate(prior.games);
const ids=new Map(cross.teams.map(t=>[String(t.id),String(t.espn_id)]));
let mapped=0;
const rankings=pre.rankings.map(t=>{
 const id=ids.get(String(t.team_id));
 const previous=id==null?undefined:calculated.ratings[id];
 if(Number.isFinite(previous))mapped++;
 const base=Number.isFinite(previous)?previous:1500;
 return {...t,base_elo:+base.toFixed(4),elo:+(base+t.offseason_adjustment).toFixed(4),retro_prior_2025_26:Number.isFinite(previous)?+previous.toFixed(4):null,retro_coverage:Number.isFinite(previous)?'matched':'unmatched-baseline'};
}).sort((a,b)=>b.elo-a.elo||a.team.localeCompare(b.team)).map((t,i)=>({...t,rank:i+1}));
if(mapped<330)throw Error('Insufficient historical RETRO identity coverage: '+mapped+'/365');
const out={model:'retro-roster-adjusted',season:'2026-27',status:'provisional-retro-preseason',games_played:0,source_season:'2025-26',retro_games:calculated.games,retro_matched_teams:mapped,roster_adjustment_source:'data/ncaam-2026-27-preseason-player-quality-live.json',note:'RETRO previous-season network rating plus separately estimated offseason player-quality adjustment; 2026-27 games have not begun. Historical RETRO backtest did not validate the combined preseason model.',rankings};
fs.writeFileSync('data/ncaam-2026-27-retro-primary.json',JSON.stringify(out,null,2)+'\n');
console.log('Published '+rankings.length+' teams; '+mapped+' matched to 2025-26 RETRO; '+calculated.games+' historical games.');

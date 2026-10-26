#!/usr/bin/env node
/* 2026-27 clean-slate MBB RETRO: every Division I team starts at 1500.
   No prior-season Elo, roster adjustment, or recruiting adjustment is imported.
   Completed 2026-27 games alone determine changes to the RETRO ratings.
*/
const fs=require('node:fs');
require('../mbb-retro.js');
const pre=JSON.parse(fs.readFileSync('data/ncaam-2026-27-preseason-player-quality-live.json','utf8'));
if(!Array.isArray(pre.rankings)||pre.rankings.length!==365)throw Error('Expected 365 Division I teams');
const seen=new Set();
const rankings=pre.rankings.map(t=>{
  const id=String(t.team_id);
  if(seen.has(id))throw Error('Duplicate team '+id);
  seen.add(id);
  return {team_id:t.team_id,team:t.team,base_elo:1500,elo:1500,rank:1,games_played:0,retro_prior_2025_26:null,retro_coverage:'clean-slate'};
}).sort((a,b)=>String(a.team).localeCompare(String(b.team)));
const out={model:'retro-clean-slate',season:'2026-27',status:'preseason-all-tied',games_played:0,starting_elo:1500,source_season:null,roster_adjustment_source:null,note:'All 365 teams begin at 1500. No historical or roster adjustments. RETRO ratings must update from completed 2026-27 games only; chronological Elo remains a separate comparator.',rankings};
fs.writeFileSync('data/ncaam-2026-27-retro-primary.json',JSON.stringify(out,null,2)+'\n');
console.log('Published '+rankings.length+' teams at exactly 1500.');

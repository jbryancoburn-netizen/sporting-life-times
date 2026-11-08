#!/usr/bin/env node
/* Compatibility results ledger rebuilt from the SAME verified canonical finals
   used by the active RETRO publisher. Do not join finals to a rolling future
   fixture list, which formerly produced a misleading empty results file. */
'use strict';
const fs=require('node:fs');
const source='data/mbb-retro-live-finals.json';
const dest='data/mbb-2026-2027-results.json';
const input=JSON.parse(fs.readFileSync(source,'utf8'));
if(input.season!=='2026-27'||!Array.isArray(input.games))throw Error('Missing verified 2026-27 final-score ledger');
const byId=new Map(), excluded={non_division_i_identity:0,invalid_final:0};
for(const g of input.games){
  const id=String(g.id||''),home=String(g.home_id||''),away=String(g.away_id||'');
  // Only D-I vs D-I has canonical NCAA IDs and RETRO eligibility.
  if(!/^ncaa:\d+$/.test(home)||!/^ncaa:\d+$/.test(away)){excluded.non_division_i_identity++;continue;}
  const hs=g.home_score,as=g.away_score,day=String(g.date||'');
  if(!/^espn:\d+$/.test(id)||home===away||!/^20\d\d-\d\d-\d\d$/.test(day)||
     !Number.isInteger(hs)||!Number.isInteger(as)||hs<=0||as<=0||hs===as){
    excluded.invalid_final++;continue;
  }
  const row={id,date:day,home_id:home,away_id:away,home_score:hs,away_score:as,
    neutral:g.neutral===true,site_verified:g.site_verified===true,
    site:g.neutral===true?'neutral':g.site_verified===true?'home':null};
  const earlier=byId.get(id);
  if(earlier && JSON.stringify(earlier)!==JSON.stringify(row))throw Error('Conflicting finals: '+id);
  byId.set(id,row);
}
const games=[...byId.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
if(input.games.length && !games.length)throw Error('Refusing to publish empty results from nonempty verified finals');
const out={season:'2026-27',source:'MBB RETRO canonical verified finals, data/mbb-retro-live-finals.json',
  games,excluded_non_di:excluded.non_division_i_identity,excluded_invalid:excluded.invalid_final};
fs.writeFileSync(dest,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({games:games.length,excluded,source_rows:input.games.length}));

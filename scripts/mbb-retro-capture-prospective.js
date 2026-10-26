#!/usr/bin/env node
/* Capture immutable, dated, same-game RETRO forecasts; no results are used. */
const fs=require('node:fs');
require('../mbb-retro.js');
const schedule=JSON.parse(fs.readFileSync('data/ncaam-2026-27-upcoming-forecasts.json','utf8'));
const dest='data/mbb-retro-prospective-predictions-2026-27.json';
const archive=fs.existsSync(dest)?JSON.parse(fs.readFileSync(dest,'utf8')):{season:'2026-27',predictions:[]};
const today=new Date().toISOString().slice(0,10);
const now=new Date().toISOString();
const known=new Set(archive.predictions.map(x=>String(x.game_id)));
let captured=0,skipped=0;
for(const g of schedule.games||[]){
 if(!g.id||!g.home_id||!g.away_id||!/^\\d{4}-\\d{2}-\\d{2}$/.test(g.date)||g.date<=today||known.has(String(g.id))||g.home_score!=null||g.away_score!=null){skipped++;continue;}
 // The schedule lacks verified venue and tipoff time. Do not invent either.
 // Only a verified home designation permits an edge; neutral is explicit.
 if(g.site!=='home'&&g.site!=='neutral'){skipped++;continue;}
 const p={game_id:String(g.id),home_id:String(g.home_id),away_id:String(g.away_id),game_date:g.date,recorded_at:now,tipoff_at:null,venue:g.site,source:'ncaam-2026-27-upcoming-forecasts.json'};
 for(const edge of [65,100]){
  const ratings=globalThis.MBB_RETRO.calculate([],{baseline:1500,homeEdge:edge}).ratings;
  const a=ratings[p.home_id]??1500,b=ratings[p.away_id]??1500;
  p['p_home_'+edge]=1/(1+10**((b-a-(g.site==='neutral'?0:edge))/400));
 }
 archive.predictions.push(p);known.add(p.game_id);captured++;
}
fs.writeFileSync(dest,JSON.stringify(archive,null,2)+'\n');
console.log(JSON.stringify({captured,skipped,total:archive.predictions.length,warning:'No capture without verified venue; tipoff must be supplied before scoring.'}));

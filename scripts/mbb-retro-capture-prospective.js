#!/usr/bin/env node
/* Prospective forecasts: no future results, no inferred venues or tipoff times. */
const fs=require('node:fs');
require('../mbb-retro.js');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const schedule=read('data/mbb-retro-verified-upcoming-2026-27.json');
const dest='data/mbb-retro-prospective-predictions-2026-27.json';
const archive=fs.existsSync(dest)?read(dest):{season:'2026-27',predictions:[]};
const now=new Date(),seen=new Set(archive.predictions.map(x=>String(x.game_id)));
const resultsPath='data/mbb-2026-2027-results.json';
const completed=fs.existsSync(resultsPath)?read(resultsPath).games:[];
if(!Array.isArray(completed))throw Error('Invalid completed games');
let captured=0,skipped=0;
for(const g of schedule.games||[]){
 const tip=Date.parse(g.tipoff_at),site=g.site;
 if(!g.id||!g.home_id||!g.away_id||!Number.isFinite(tip)||tip<=now.getTime()||!['home','neutral'].includes(site)||seen.has(String(g.id))||g.home_score!=null||g.away_score!=null){skipped++;continue;}
 const earlier=completed.filter(x=>x.date&&Date.parse(x.date)<now.getTime()&&Number.isFinite(Number(x.home_score))&&Number.isFinite(Number(x.away_score))&&x.home_score!==''&&x.away_score!==''&&x.id!==g.id);
 const p={game_id:String(g.id),home_id:String(g.home_id),away_id:String(g.away_id),game_date:g.date,recorded_at:now.toISOString(),tipoff_at:new Date(tip).toISOString(),venue:site,completed_games_used:earlier.length};
 const ratings=globalThis.MBB_RETRO.calculate(earlier,{baseline:1500,homeEdge:100}).ratings;
 const a=ratings[p.home_id]??1500,b=ratings[p.away_id]??1500;
 p.p_home_100=1/(1+10**((b-a-(site==='neutral'?0:100))/400));
 archive.predictions.push(p);seen.add(p.game_id);captured++;
}
if(captured)fs.writeFileSync(dest,JSON.stringify(archive,null,2)+'\n');
console.log(JSON.stringify({captured,skipped,total:archive.predictions.length,warning:'Missing verified tipoff/venue records skipped; no forecasts fabricated.'}));

#!/usr/bin/env node
/* Build completed-game feed from existing validated event identities and forecasts. */
const fs=require('node:fs');
const events=JSON.parse(fs.readFileSync('data/ncaam-2026-27-source-events.json','utf8')).events;
const fixtures=JSON.parse(fs.readFileSync('data/ncaam-2026-27-upcoming-forecasts.json','utf8')).games;
const ids=new Map(fixtures.map(g=>[String(g.id),g]));
const games=[],seen=new Set();
for(const e of events){
 const id=String(e.contest_id),f=ids.get(id);
 if(!f||e.status!=='final'||seen.has(id))continue;
 const h=Number(e.home_score),a=Number(e.away_score);
 if(e.home_score===''||e.away_score===''||!Number.isInteger(h)||!Number.isInteger(a)||h===a)continue;
 games.push({id,date:e.game_date,home_id:f.home_id,away_id:f.away_id,home_score:h,away_score:a,site:f.site??null});
 seen.add(id);
}
const out={season:'2026-27',source:'NCAA team-ID fixture crosswalk + ESPN completed event feed',games};
fs.writeFileSync('data/mbb-2026-2027-results.json',JSON.stringify(out,null,2)+'\n');
console.log('Verified completed-game joins:',games.length);

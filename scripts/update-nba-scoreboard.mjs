#!/usr/bin/env node
// Snapshot NBA scores & schedule into a same-origin JSON file for GitHub Pages.
// Results still enter Elo only via separately audited final-score updater.
import {writeFileSync} from 'node:fs';
const now=new Date();
const dateId=d=>d.toISOString().slice(0,10).replaceAll('-','');
const games=new Map();
const days=[-1,0,1,2];
for(const offset of days){
 const d=new Date(now);d.setUTCDate(d.getUTCDate()+offset);
 const url='https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates='+dateId(d)+'&limit=100';
 const r=await fetch(url,{signal:AbortSignal.timeout(18000),headers:{Accept:'application/json'}});
 if(!r.ok)throw Error('NBA scoreboard HTTP '+r.status+' '+dateId(d));
 const body=await r.json();
 if(!Array.isArray(body.events))throw Error('NBA scoreboard missing events '+dateId(d));
 for(const ev of body.events){
   if(!ev?.id||!ev?.date)continue;
   const c=ev.competitions?.[0],home=c?.competitors?.find(x=>x.homeAway==='home'),away=c?.competitors?.find(x=>x.homeAway==='away');
   if(!home||!away)continue;
   games.set(String(ev.id),{id:String(ev.id),date:ev.date,status:ev.status?.type?.shortDetail||'Scheduled',state:ev.status?.type?.state||'pre',final:ev.status?.type?.completed===true,home:home.team?.abbreviation,away:away.team?.abbreviation,home_score:home.score??null,away_score:away.score??null});
 }
}
if(games.size===0)throw Error('NBA scoreboard unexpectedly empty');
const data={league:'NBA',season:'2026-27',source:'ESPN NBA game scores and schedule; independent USRS Elo',updated_utc:now.toISOString(),games:[...games.values()].sort((a,b)=>a.date.localeCompare(b.date))};
writeFileSync(new URL('../data/nba-scoreboard.json',import.meta.url),JSON.stringify(data,null,2)+'\n');
console.log('Published '+data.games.length+' NBA scoreboard fixtures');

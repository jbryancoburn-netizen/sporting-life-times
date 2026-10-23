#!/usr/bin/env node
// Independent NBA Elo replay from ESPN FINAL scores and the published preseason baseline.
// Retains original K=20, home Elo=45, MOV factor 1+.4*log10(1+margin).
// ESPN provides results only, never ratings. This script never updates frozen 2025-26.
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const source=new URL('../data/nba-2026-27-preseason-provisional.json',import.meta.url);
const target=new URL('../data/nba-2026-27-current-provisional.json',import.meta.url);
const baseline=JSON.parse(readFileSync(source,'utf8'));
const old=JSON.parse(readFileSync(target,'utf8'));
assert.equal(baseline.status,'provisional_historical_regression_only');
assert.equal(baseline.season,'2026-27');
const teams=new Set(baseline.rankings.map(r=>r.team));
assert.equal(teams.size,30);
const alias={NY:'NYK',GS:'GSW',SA:'SAS',NO:'NOP',UTAH:'UTA',WSH:'WAS'};
const normal=x=>alias[x]||x;
const start=new Date('2026-10-20T00:00:00Z');
const end=new Date();
const maxEnd=new Date('2027-06-30T00:00:00Z');
assert.ok(end>=start,'season has not started');
assert.ok(end<maxEnd,'season window expired: update season configuration');
const dateId=d=>d.toISOString().slice(0,10).replaceAll('-','');
const collected=new Map();
async function fetchDate(date) {
 const url='https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates='+dateId(date)+'&limit=100';
 const response=await fetch(url,{headers:{'User-Agent':'SportingLifeTimes-Elo/1.0 (historical result audit)','Accept':'application/json'},signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('ESPN HTTP '+response.status+' on '+dateId(date));
 const data=await response.json();
 if(!Array.isArray(data.events))throw Error('ESPN events absent for '+dateId(date));
 for(const event of data.events) {
   const competition=event.competitions?.[0];
   const complete=event.status?.type?.completed===true;
   if(!complete)continue;
   const seasonType=event.season?.type??competition?.type?.type;
   // NBA regular-season is ESPN type 2. Omit preseason and postseason.
   if(Number(seasonType)!==2)continue;
   if(event.season?.year && Number(event.season.year)!==2027)throw Error('Unexpected ESPN NBA season year '+event.season.year);
   if(!Array.isArray(competition?.competitors)||competition.competitors.length!==2)throw Error('Incomplete competitors '+event.id);
   const home=competition.competitors.find(x=>x.homeAway==='home');
   const away=competition.competitors.find(x=>x.homeAway==='away');
   if(!home||!away)throw Error('Invalid competitor home/away '+event.id);
   const h=normal(home.team?.abbreviation),a=normal(away.team?.abbreviation);
   if(!teams.has(h)||!teams.has(a)||h===a)throw Error('Unknown NBA team '+event.id+' '+h+' '+a);
   const hs=Number(home.score),as=Number(away.score);
   if(!Number.isInteger(hs)||!Number.isInteger(as)||hs<0||as<0||hs===as)throw Error('Bad final score '+event.id);
   const id='espn-nba-'+event.id;
   const time=new Date(event.date).toISOString();
   const result={id,home:h,away:a,home_score:hs,away_score:as,date:time};
   if(collected.has(id)&&JSON.stringify(collected.get(id))!==JSON.stringify(result))throw Error('Contradictory ESPN result '+id);
   collected.set(id,result);
 }
}
for(let day=new Date(start);day<=end;day.setUTCDate(day.getUTCDate()+1)){
 await fetchDate(day);
}
// Fail closed rather than inadvertently dropping or revising an already published result.
for(const previous of old.events||[]){
 const match=collected.get(previous.id);
 if(!match)throw Error('Previously published final missing from source '+previous.id);
 for(const field of ['home','away','home_score','away_score']){
   if(previous[field]!==match[field])throw Error('Published game was revised: '+previous.id+' '+field);
 }
}
if(collected.size<(old.games_played||0))throw Error('Results count regressed');
const round=(x,n)=>Number(x.toFixed(n));
const ratings=Object.fromEntries(baseline.rankings.map(x=>[x.team,x.elo]));
const events=[...collected.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
for(const event of events){
 const diff=ratings[event.home]+baseline.parameters.home_elo-ratings[event.away];
 const expected=1/(1+10**(-diff/400));
 const actual=event.home_score>event.away_score?1:0;
 const mov=1+baseline.parameters.mov_weight*Math.log10(1+Math.abs(event.home_score-event.away_score));
 const delta=baseline.parameters.k*mov*(actual-expected);
 ratings[event.home]+=delta;ratings[event.away]-=delta;
 event.home_elo_change=round(delta,6);
 delete event.date;
}
const ranked=Object.entries(ratings).map(([team,elo])=>({team,elo:round(elo,3)})).sort((a,b)=>b.elo-a.elo||a.team.localeCompare(b.team));
const result={league:'NBA',season:'2026-27',status:'provisional_live_from_historical_baseline',games_played:events.length,preseason_status:baseline.status,source:'ESPN FINAL NBA regular-season scores; Sporting Life & Times independent Elo',rankings:ranked,events};
assert.equal(result.rankings.length,30);
assert.equal(result.events.length,result.games_played);
const oldLedger=new Map((old.events||[]).map(x=>[x.id,x]));
for(const ev of events){const prev=oldLedger.get(ev.id);if(prev&&Math.abs(prev.home_elo_change-ev.home_elo_change)>.005)throw Error('Previously published Elo delta diverged: '+ev.id);}
writeFileSync(target,JSON.stringify(result,null,2)+'\n');
console.log('NBA final-score Elo replay: '+events.length+' games, 30 teams. No frozen data changed.');

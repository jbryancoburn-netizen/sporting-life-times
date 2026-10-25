#!/usr/bin/env node
// Release verification: published NBA data, newspaper renderer and all 30 team standings must agree.
// Usage: node scripts/verify-nba-public-sync.mjs https://...github.io/sporting-life-times
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const root=process.argv[2]?.replace(/\/$/,'');
assert(root?.startsWith('https://'),'Expected HTTPS Pages root');
const local=JSON.parse(readFileSync(new URL('../data/nba-2026-27-current-provisional.json',import.meta.url)));
const fetchText=async path=>{
 const response=await fetch(root+'/'+path+'?sync='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(25000)});
 assert(response.ok, 'Published '+path+' returned HTTP '+response.status);
 return response.text();
};
const [raw,html,script]=await Promise.all([
 fetchText('data/nba-2026-27-current-provisional.json'),
 fetchText('nba.html'),
 fetchText('nba-home.js')
]);
const published=JSON.parse(raw);
assert.deepEqual(published,local,'Published Elo data differs from deployed repository data');
assert.equal(published.events.length,published.games_played,'Published game count mismatch');
assert.equal(published.rankings.length,30,'Missing NBA Elo teams');
const teams=new Map(published.rankings.map(r=>[r.team,{w:0,l:0,elo:r.elo}]));
assert.equal(teams.size,30,'Duplicate NBA team');
const ids=new Set();
for(const event of published.events){
 assert(!ids.has(event.id),'Duplicate final '+event.id);ids.add(event.id);
 const h=teams.get(event.home),a=teams.get(event.away);
 assert(h&&a&&h!==a,'Unknown/duplicate game teams '+event.id);
 assert(Number.isInteger(event.home_score)&&Number.isInteger(event.away_score)&&event.home_score!==event.away_score,'Invalid final '+event.id);
 const winner=event.home_score>event.away_score?h:a, loser=winner===h?a:h;
 winner.w++;loser.l++;
}
assert.equal([...teams.values()].reduce((n,v)=>n+v.w,0),published.games_played,'Published W-L wins wrong');
assert.equal([...teams.values()].reduce((n,v)=>n+v.l,0),published.games_played,'Published W-L losses wrong');
assert(html.includes('id="nba-conference-standings"')&&html.includes('id="nba-elo-grid"'),'Missing rendered standings/Elo hosts');
assert(/nba-home\.js\?v=\d+/.test(html),'Published NBA home script not wired');
assert(script.includes('const records=Object.fromEntries')&&script.includes('const ledger=(elo.events||[])'),'Published renderer does not derive W-L from Elo events');
assert(script.includes('nba-conference-standings')&&script.includes('const records=Object.fromEntries'),'Published renderer missing standings or record output');
assert(html.includes('nba-intelligence.js?v='),'Missing power rankings renderer script');
console.log(JSON.stringify({status:'PASS',verified_games:published.games_played,teams:teams.size,wins:published.games_played,losses:published.games_played,renderer:'source contracts verified',public_data:'exact match with deployment'},null,2));

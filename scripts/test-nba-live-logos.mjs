#!/usr/bin/env node
// Offline regression of real NBA live-score rendering with ESPN abbreviation aliases.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../nba-live-game.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../nba-live-game.html',import.meta.url),'utf8');
assert.ok(html.includes('nba-live-game.js?v=20261031-fix-utah-logo'));
async function run(abbreviation){
 const ids=['score','updated','live-leaders','quarters','team-stats','players','plays'];
 const nodes=Object.fromEntries(ids.map(id=>[id,{innerHTML:'',textContent:''}]));
 const handlers={};
 const away={homeAway:'away',team:{abbreviation:'POR',displayName:'Portland'},score:59,linescores:[]};
 const home={homeAway:'home',team:{abbreviation,displayName:'Utah'},score:42,linescores:[]};
 const response={header:{competitions:[{competitors:[away,home],status:{type:{description:'Halftime'}}}]},boxscore:{teams:[],players:[]},plays:[]};
 const sandbox={
  location:{search:'?game=401909277'},
  document:{getElementById:id=>nodes[id],addEventListener:(name,fn,capture)=>{handlers[name]={fn,capture};}},
  URLSearchParams,AbortController,Date,console,
  fetch:async()=>({ok:true,json:async()=>response}),
  setTimeout,clearTimeout,setInterval:()=>{}
 };
 vm.runInNewContext(source,sandbox,{filename:'nba-live-game.js'});
 await new Promise(resolve=>setImmediate(resolve));
 return {nodes,handlers};
}
const mappings={UTAH:'UTA',UT:'UTA',NY:'NYK',GS:'GSW',SA:'SAS',NO:'NOP',WSH:'WAS',POR:'POR'};
for(const [alias,want] of Object.entries(mappings)){
 const {nodes,handlers}=await run(alias);
 assert.ok(nodes.score.innerHTML.includes('src="assets/nba-logos/'+want+'.png"'),
  alias+' must render canonical logo '+want+'.png');
 if(alias!==want)assert.ok(!nodes.score.innerHTML.includes('src="assets/nba-logos/'+alias+'.png"'));
 assert.ok(existsSync(new URL('../assets/nba-logos/'+want+'.png',import.meta.url)));
 assert.ok(handlers.error?.capture===true,'Fallback must capture image errors');
 if(alias==='UTAH'){
  assert.ok(nodes.quarters.innerHTML.includes('UTA</td>'));
  assert.ok(!nodes.quarters.innerHTML.includes('UTAH</td>'));
 }
}
console.log('PASS: all ESPN aliases map to existing local NBA logos; fallback installed');

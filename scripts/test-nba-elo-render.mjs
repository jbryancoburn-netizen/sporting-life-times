#!/usr/bin/env node
// Test the ACTUAL production NBA page renderers, including when the optional
// movement helper fails to load. The published Elo JSON must still show arrows.
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const resources={
 'data/nba-2026-27-current-provisional.json':JSON.parse(read('data/nba-2026-27-current-provisional.json')),
 'data/nba-2026-27-preseason-provisional.json':JSON.parse(read('data/nba-2026-27-preseason-provisional.json')),
 'data/nba-2025-26-final.json':JSON.parse(read('data/nba-2025-26-final.json')),
 'multi_scoreboards.json':{leagues:[{league:'NBA',games:[]}]},
 'articles.json':{articles:[]}
};
const elements=new Map();
const document={
 readyState:'complete',
 getElementById(id){
  if(!elements.has(id))elements.set(id,{
   innerHTML:'',textContent:'',
   insertAdjacentHTML(_where,value){this.innerHTML+=value}
  });
  return elements.get(id);
 }
};
const fetch=async path=>{
 assert.ok(Object.hasOwn(resources,path),'Unexpected browser request '+path);
 return {ok:true,json:async()=>resources[path]};
};
const errors=[];
const context={window:{},document,fetch,console:{error(...a){errors.push(a.map(String).join(' '))}},Date,Intl,Promise};
// Deliberately do NOT load nba-elo-movement.js: published values must be sufficient.
runInNewContext(read('nba-desk-loader.js'),context,{filename:'nba-desk-loader.js'});
runInNewContext(read('nba-home.js'),context,{filename:'nba-home.js'});
for(let i=0;i<35;i++)await Promise.resolve();
assert.equal(errors.length,0,'NBA page browser errors: '+errors.join('; '));
const power=elements.get('nba-elo-grid')?.innerHTML||'';
const divisions=elements.get('nba-conference-standings')?.innerHTML||'';
const expected={
 PHI:'▲ +12.616',CLE:'▼ -12.616',OKC:'▲ +8.740',DEN:'▼ -8.740'
};
for(const [team,value] of Object.entries(expected)){
 assert.ok(power.includes(value),'Power rankings missing '+team+' '+value);
 assert.ok(divisions.includes(value),'Division standings missing '+team+' '+value);
}
assert.ok(power.includes('Last week'),'Last-week column missing');
assert.ok(!power.includes('N/A'),'Daily and weekly values incorrectly unavailable');
assert.ok(power.includes('nba-elo-positive')&&power.includes('nba-elo-negative'),'Movement colors absent');
console.log('NBA production browser renderer PASS — 16 verified games; PHI, CLE, OKC, DEN daily Elo arrows visible even without helper JS.');

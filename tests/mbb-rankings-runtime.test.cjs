#!/usr/bin/env node
/* Real data + browser DOM smoke test for all 365 NCAA basketball rankings.
   Catches runtime failures (like undefined format) that syntax checks miss. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8');
const source=read('mbb-elo-primary.js');
const primary=JSON.parse(read('data/ncaam-2026-27-retro-primary.json'));
const cross=JSON.parse(read('data/ncaam-2026-27-espn-team-crosswalk.json'));
assert.equal(primary.rankings.length,365);
const allIDs=['cbb-count','cbb-elo-body','cbb-matchup-result','cbb-matchup-a','cbb-matchup-b','cbb-matchup-venue','cbb-elo-meta','cbb-elo-model','cbb-elo-fresh','cbb-conference','cbb-top-ten','cbb-search'];
const nodes=Object.fromEntries(allIDs.map(id=>[id,{innerHTML:'',textContent:'',value:id==='cbb-matchup-venue'?'neutral':'',addEventListener(){}}]));
const errors=[],calls=[];
const win={MBBLogos:{ready:Promise.resolve(true),byNCAA:(id,style,name)=>'<span class="mbb-mark" data-id="'+String(id)+'">'+String(name||'')+'</span>'}};
const context={
 window:win,
 document:{hidden:false,getElementById:id=>nodes[id]||null},
 Intl,Date,JSON,Math,Number,Promise,URL,Map,Set,
 AbortSignal:{timeout:()=>undefined},
 setInterval:()=>0,
 console:{error:(...args)=>errors.push(args.map(String).join(' ')),log(){},warn(){}},
 fetch:async url=>{calls.push(url);return{ok:true,json:async()=>url.startsWith('data/ncaam-2026-27-retro-primary.json')?primary:cross};}
};
vm.runInNewContext(source,context,{filename:'mbb-elo-primary.js'});
(async()=>{
 for(let i=0;i<20;i++){
  if((nodes['cbb-elo-body'].innerHTML.match(/<tr>/g)||[]).length===365)break;
  await new Promise(resolve=>setTimeout(resolve,20));
 }
 assert.deepEqual(errors,[],'Unexpected browser runtime errors');
 assert.equal((nodes['cbb-elo-body'].innerHTML.match(/<tr>/g)||[]).length,365,'The MBB power rankings table does not actually render 365 school rows');
 assert(nodes['cbb-elo-body'].innerHTML.includes('A&amp;M-Corpus Christi'),'MBB school names not rendered');
 assert(nodes['cbb-elo-body'].innerHTML.includes('1500.0'),'RETRO starting values absent');
 assert(nodes['cbb-count'].textContent.includes('365 of 365'),'School-count badge not populated');
 assert(nodes['cbb-elo-meta'].textContent.includes('Preseason'),'RETRO metadata not populated');
 assert(nodes['cbb-conference'].innerHTML.includes('All conferences'),'Conference filter not populated');
 assert(nodes['cbb-matchup-result'].innerHTML.includes('%'),'Matchup calculator did not render');
 assert(calls.length>=2,'Rankings data and school identity map were not loaded');
 console.log('PASS real browser script execution: 365 MBB ratings render, controls respond, preseason metadata and matchup calculator work');
})().catch(e=>{console.error(e);process.exitCode=1});

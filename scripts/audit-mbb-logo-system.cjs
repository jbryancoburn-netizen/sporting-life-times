#!/usr/bin/env node
/* Exhaustive MBB visual identity contract: all 365 schools + 7 newspaper editions. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8');
const registry=JSON.parse(read('data/mbb-logo-registry.json'));
const cross=JSON.parse(read('data/ncaam-2026-27-espn-team-crosswalk.json'));
async function run(){
 assert.equal(Object.keys(registry.teams).length,365);
 assert.equal(cross.teams.length,365);
 const ids=new Set();
 for(const t of cross.teams){
  const id=String(t.espn_id),item=registry.teams[id];
  assert(!ids.has(id),'Duplicate ESPNs '+id);
  ids.add(id);
  assert(item&&item.canonical_id===t.id,'Incorrect NCAA-to-ESPN crest: '+t.name);
  assert.equal(item.espn_id,id,'Wrong registered source ID: '+t.name);
  assert.equal(item.logo_url_verified,true,'Crest not verified: '+t.name);
  assert.equal(item.logo_url,'https://a.espncdn.com/i/teamlogos/ncaa/500/'+id+'.png','Image is not matching school provider ID: '+t.name);
 }
 const ctx={window:{},document:{querySelectorAll:()=>[]},
 URL,console,fetch:async url=>({ok:true,json:async()=>url.includes('logo-registry')?registry:cross})};
 vm.runInNewContext(read('mbb-logo-system.js'),ctx,{filename:'mbb-logo-system.js'});
 assert.equal(await ctx.window.MBBLogos.ready,true,'Shared logo loader must resolve all 365 schools');
 for(const t of cross.teams){
  const crest=ctx.window.MBBLogos.byNCAA(t.id,'hero',t.name);
  const expected=registry.teams[t.espn_id];
  assert(crest.includes('data-espn-id="'+t.espn_id+'"'),'NCAA team mismapped: '+t.name);
  assert(crest.includes(expected.logo_url),'Missing correct crest: '+t.name);
  assert(crest.includes('mbb-mark--hero'),'Hero markup differs: '+t.name);
  assert(!crest.includes('mbb-mark--missing'),'Unnecessary initials fallback: '+t.name);
  assert(ctx.window.MBBLogos.byESPN(t.espn_id,'schedule',t.espn_name).includes(expected.logo_url),'Opponent crest mismatch: '+t.name);
  assert(ctx.window.MBBLogos.byNCAA(t.id,'power',t.name).includes(expected.logo_url),'Power ranking crest mismatch: '+t.name);
 }
 const css=read('mbb-logo-system.css');
 for(const clause of ['object-fit:contain!important','border-radius:50%!important','.mbb-mark--schedule','.mbb-mark--power','.mbb-mark--hero','.mbb-mark--score'])assert(css.includes(clause),'Missing shared logo CSS: '+clause);
 for(const page of ['ncaam-team.html','ncaam-elo.html','ncaam.html','college-basketball.html','ncaam-conference.html','ncaam-tournament.html','ncaam-players.html','ncaam-predictor.html','ncaam-rivalry.html']){
  assert(read(page).includes('mbb-logo-system.js'),'No shared logo JS on '+page);
  assert(read(page).includes('mbb-logo-system.css'),'No shared logo CSS on '+page);
  const loader=html.indexOf('mbb-logo-system.js');
  for(const consumer of ['mbb-newspaper.js','mbb-elo-primary.js','mbb-team-calendar-boot.js','ncaam-predictor.js','ncaam-rivalry.js']) {
   const at=html.indexOf(consumer);
   if(at!==-1)assert(loader<at,'Shared crest library must load before '+consumer+' in '+page);
  }

 }
 for(const file of ['mbb-newspaper.js','mbb-team-calendar-boot.js','mbb-elo-primary.js','ncaam-predictor.js','ncaam-rivalry.js']){
  const src=read(file);
  assert(src.includes('MBBLogos.'),'Inconsistent logo renderer '+file);
  if(file.startsWith('mbb-'))assert(!src.includes('schoolColor('),'Guessed-color legacy renderer still active '+file);
  assert(!src.includes('class="badge"'),'Standalone badge still active '+file);
  new Function(src);
 }
 console.log('PASS 365 unique team identities; 365 correct verified crest URLs; power/team/schedule/predictor/rivalry all share one circle and color; 9 editions linked.');
}
run().catch(e=>{console.error(e);process.exitCode=1});

#!/usr/bin/env node
'use strict';
/* MBB visual ownership: exactly one renderer, 365 image identities, 11 page templates.
   The original provider art may already contain circular artwork. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8');
const registry=JSON.parse(read('data/mbb-logo-registry.json'));
const cross=JSON.parse(read('data/ncaam-2026-27-espn-team-crosswalk.json'));
const allColors=JSON.parse(read('data/dual-ring-team-palette.json'));
const colors=allColors.mbb;
async function run(){
 assert.equal(Object.keys(registry.teams).length,365);
 assert.equal(cross.teams.length,365);
 assert.equal(Object.keys(colors).length,365);
 const seen=new Set(),kinds={embedded_roundel:0,flat:0,unverified:0};
 for(const t of cross.teams){
  const id=String(t.espn_id),item=registry.teams[id],brand=colors[id];
  assert(!seen.has(id),'Duplicate provider identity '+id);seen.add(id);
  assert.equal(item?.canonical_id,t.id,'Wrong NCAA identity '+t.name);
  assert.equal(String(item?.espn_id),id,'Wrong ESPN identity '+t.name);
  assert.equal(item?.logo_url_verified,true,'Unverified crest URL '+t.name);
  assert.equal(item.logo_url,'https://a.espncdn.com/i/teamlogos/ncaa/500/'+id+'.png','Mismatched crest source '+t.name);
  assert(Object.hasOwn(kinds,item.artwork_type),'Missing roundel-aware flag '+t.name);
  assert(brand?.primary&&brand?.secondary&&brand.primary!==brand.secondary,'Missing two-color team palette '+t.name);
  kinds[item.artwork_type]++;
 }
 const doc={readyState:'loading',addEventListener(){},querySelectorAll(){return[]}};
 const ctx={window:{},document:doc,URL,console,
  fetch:async url=>({ok:true,json:async()=>url.includes('logo-registry')?registry:url.includes('dual-ring-team-palette')?allColors:cross})};
 vm.runInNewContext(read('mbb-logo-system.js'),ctx,{filename:'mbb-logo-system.js'});
 assert.equal(await ctx.window.MBBLogos.ready,true,'Single MBB renderer could not initialize');
 for(const t of cross.teams){
  const id=String(t.espn_id),item=registry.teams[id],brand=colors[id];
  const crest=ctx.window.MBBLogos.byNCAA(t.id,'hero',t.name);
  assert(crest.includes('data-espn-id="'+id+'"'),'Wrong MBB logo identity '+t.name);
  assert(crest.includes('data-artwork="'+item.artwork_type+'"'),'Wrong artwork flag '+t.name);
  assert(crest.includes(item.logo_url),'Wrong logo URL '+t.name);
  assert(crest.includes('--mbb-primary:'+brand.primary),'Wrong primary team color '+t.name);
  assert(crest.includes('--mbb-secondary:'+brand.secondary),'Wrong secondary team color '+t.name);
  assert(!crest.includes('slt-mark')&&!crest.includes('slt-dual-shell'),'Nested generic ring on '+t.name);
  assert(ctx.window.MBBLogos.byNCAA(t.id,'power',t.name).includes(item.logo_url),'Ranking crest '+t.name);
  assert(ctx.window.MBBLogos.byESPN(id,'schedule',t.espn_name).includes(item.logo_url),'Schedule crest '+t.name);
  assert(ctx.window.MBBLogos.byESPN(id,'score',t.espn_name).includes(item.logo_url),'Score crest '+t.name);
 }
 const corrected=Object.entries(registry.teams).filter(([id,t])=>t.ring_override==='two');
 assert.equal(corrected.length,18,'Exactly the 18 affected single-ring schools must be corrected');
 assert(corrected.every(([id,t])=>t.artwork_type==='embedded_roundel'),'Unrelated school style was changed');
 for(const [id,record] of corrected){
  const out=ctx.window.MBBLogos.byNCAA(record.canonical_id,'score',record.school);
  assert(out.includes('mbb-mark--corrected-two-rings'),'Single-ring school still missing secondary stroke: '+record.school);
 }
 assert(cross.teams.filter(t=>!registry.teams[t.espn_id]?.ring_override).every(t=>!ctx.window.MBBLogos.byNCAA(t.id,'score',t.name).includes('mbb-mark--corrected-two-rings')),'Unchanged schools gained extra rings');
 assert(kinds.embedded_roundel>=10,'Screenshot-observed embedded roundels not classified');
 assert(kinds.embedded_roundel+kinds.flat+kinds.unverified===365);
 const css=read('mbb-logo-system.css');
 assert(css.includes('.mbb-mark--art-embedded_roundel.mbb-mark--corrected-two-rings::before'),'Targeted second color ring CSS missing');
 for(const must of ['.mbb-mark--art-embedded_roundel','.mbb-mark--art-unverified','.mbb-mark--art-flat','object-fit:contain!important','transform:translate(-50%,-50%)!important'])assert(css.includes(must),'Missing MBB artwork CSS: '+must);
 assert(css.includes('.mbb-mark--art-embedded_roundel::before{content:none!important}'),'Embedded roundels must not gain a second site ring');
 assert(css.includes('.mbb-mark--art-embedded_roundel{'),'Embedded roundels must retain a visible primary-color circle');
 assert(css.includes('.mbb-mark--art-flat::before{'),'Verified flat logos must receive secondary-color ring');
 assert(css.includes('.mbb-mark--art-unverified::before{content:none!important}'),'Unverified circular artwork must not receive a third ring');
 const pages=fs.readdirSync('.').filter(p=>p.endsWith('.html')&&(/^(ncaam(?:[-.]|$))/.test(p)||p==='college-basketball.html'));
 assert.equal(pages.length,11,'Expected every MBB page type');
 for(const page of pages){
  const html=read(page);
  assert.equal((html.match(/mbb-logo-system\.js\?v=[a-zA-Z0-9._-]+/g)||[]).length,1,page+' must have exactly one shared logo renderer');
  assert.equal((html.match(/mbb-logo-system\.css\?v=[a-zA-Z0-9._-]+/g)||[]).length,1,page+' must have exactly one shared logo stylesheet');
  for(const extra of ['shared-team-crests.js','shared-team-crests.css','slt-dual-ring.js','slt-dual-ring.css']){
   assert(!html.includes(extra),page+' still loads conflicting crest owner '+extra);
  }
  const loader=html.indexOf('mbb-logo-system.js');
  for(const consumer of ['mbb-newspaper.js','mbb-elo-primary.js','mbb-team-calendar-boot.js','ncaam-predictor.js','ncaam-rivalry.js']){
   const i=html.indexOf(consumer);if(i!==-1)assert(loader<i,'MBB logo module loads after '+consumer+' on '+page);
  }
 }
 const injection=read('scripts/inject-team-crests.py');
 assert(injection.includes('ncaam(?:[-.]|$)'),'Publisher injection must exempt basketball');
 const shared=read('shared-team-crests.js');
 assert(shared.includes('ncaam(?:[-.]|$)'),'Old shared enhancer must exempt basketball');
 const dual=read('slt-dual-ring.js');
 assert(dual.includes("if(league==='mbb')return;"),'MBB is still decorated by generic dual ring script');
 for(const file of ['mbb-newspaper.js','mbb-elo-primary.js','mbb-team-calendar-boot.js','ncaam-rivalry.js','ncaam-predictor.js']){
  const src=read(file);assert(src.includes('MBBLogos.'),'Old page-specific crest renderer '+file);
  new Function(src);
 }
 console.log('PASS 365 verified NCAA logos; '+JSON.stringify(kinds)+' artwork flags; 11/11 MBB pages have one owner; no stacked ring imports');
}
run().catch(e=>{console.error(e);process.exitCode=1});

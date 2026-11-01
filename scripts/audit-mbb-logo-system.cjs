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
 assert(Object.values(registry.teams).every(t=>!t.ring_override),'Legacy per-school ring exceptions remain');
 assert.equal(kinds.flat,362,'Every visually inspected non-roundel must be classified flat');
 assert.equal(kinds.embedded_roundel,3,'Intrinsic circular team artwork is explicitly documented');
 const css=read('mbb-logo-system.css');
 assert(css.includes('border:var(--mbb-ring) solid var(--mbb-primary'),'Primary outer stroke missing');
 assert(css.includes('border:var(--mbb-ring) solid var(--mbb-secondary'),'Secondary inner stroke missing');
 assert(css.includes('inset:0!important'),'White spacer between rings returned');
 assert(css.includes('.mbb-mark::after{content:none!important'),'Third decorative band returned');
 assert(!css.includes('--art-')&&!css.includes('corrected-two-rings'),'Artwork metadata must not change the two-ring shell');
 for(const must of ['object-fit:contain!important','transform:translate(-50%,-50%)!important','clip-path:none!important'])assert(css.includes(must),'Missing safe centering rule '+must);
 assert(!read('ncaaw-team.html').includes('.wbb-identity .mbb-mark__img{'),'Women-specific image sizing overrides shared badge');
 for(const t of cross.teams)assert(ctx.window.MBBLogos.byESPN(t.espn_id,'score',t.espn_name).includes('data-ring-count="2"'),'Missing shared two-ring contract '+t.name);
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

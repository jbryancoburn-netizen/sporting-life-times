#!/usr/bin/env node
'use strict';
// Protect 628 four-league palettes and the two-ring layout against regressions.
const fs=require('node:fs'),assert=require('node:assert/strict');
const read=path=>fs.readFileSync(path,'utf8');
const d=JSON.parse(read('data/dual-ring-team-palette.json'));
const pale=color=>{if(!/^#[a-f0-9]{6}$/i.test(color||''))return true;return [1,3,5].every(i=>parseInt(color.slice(i,i+2),16)>=222)};
let count=0;
for(const [kind,expected] of Object.entries({nba:30,euroleague:20,mbb:365,soccer:213})){
 const entries=Object.entries(d[kind]||{});
 assert.equal(entries.length,expected,kind+' missing club color entries');
 for(const [id,club] of entries){
  for(const ring of ['primary','secondary']){
   assert(/^#[a-f0-9]{6}$/i.test(club[ring]||''),kind+' '+id+' '+ring+' invalid color');
   assert(!pale(club[ring]),kind+' '+id+' '+ring+' is white/near-white');
  }
  assert.notEqual(club.primary.toLowerCase(),club.secondary.toLowerCase(),kind+' '+id+' duplicate colors');
  count++;
 }
}
const version='two-clean-rings-20261029';
const files=fs.readdirSync('.').filter(p=>p.endsWith('.html'));
const pages=files.filter(p=>read(p).includes('data-slt-league='));
assert(pages.length>=40&&pages.length<=45,'Unexpected shared two-ring page population: '+pages.length);
for(const page of pages){
 const html=read(page);
 assert(html.includes('slt-dual-ring.css?v='+version),'Stale double-ring geometry on '+page);
 assert(html.includes('slt-dual-ring.js?v='+version),'Stale color lookup on '+page);
}
const css=read('slt-dual-ring.css');
assert(css.includes('background:transparent!important'),'Colored ring mask must have no white fill');
assert(css.includes('transform:translate(-50%,-50%)!important'),'Non-MBB image centering missing');
const mbbPages=files.filter(p=>/^(?:ncaam(?:[-.]|$)|college-basketball\.html$)/.test(p));
assert.equal(mbbPages.length,11,'Expected 11 basketball page templates');
for(const page of mbbPages){
 const html=read(page);
 const styles=html.match(/mbb-logo-system\.css\?v=[a-zA-Z0-9._-]+/g)||[];
 const renderers=html.match(/mbb-logo-system\.js\?v=[a-zA-Z0-9._-]+/g)||[];
 assert.equal(styles.length,1,page+' must load one versioned shared MBB stylesheet');
 assert.equal(renderers.length,1,page+' must load one versioned shared MBB renderer');
 assert(!html.includes('slt-dual-ring.js')&&!html.includes('slt-dual-ring.css'),page+' has stacked dual ring library');
 assert(!html.includes('shared-team-crests.js')&&!html.includes('shared-team-crests.css'),page+' has shared wrapper');
}
const js=read('slt-dual-ring.js');
assert(js.includes('nonwhite-rings-20261029'),'Stale cached ring palette');
console.log('PASS '+count+' distinct nonwhite team palettes; '+pages.length+' generic two-ring pages plus 11 single-owner roundel-aware MBB pages');

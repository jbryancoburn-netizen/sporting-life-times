/* Game Center cannot bypass the canonical two-ring NCAA basketball logo system. */
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('live-game.html','utf8');
const js=fs.readFileSync('slt-victorian-live.js','utf8');
const css=fs.readFileSync('slt-victorian-live.css','utf8');
const registry=JSON.parse(fs.readFileSync('data/mbb-logo-registry.json','utf8')).teams;

for(const [id,name] of [['219','Penn'],['2426','Navy']]){
 assert.equal(registry[id]?.school,name,'Specific match identity must remain verified');
 assert.equal(registry[id]?.logo_url_verified,true,'School logo must have verified artwork');
}
assert(html.includes('mbb-logo-system.css?'),'Game Center missing canonical logo stylesheet');
assert(html.includes('mbb-logo-system.js?'),'Game Center missing canonical logo renderer');
assert(html.indexOf('mbb-logo-system.js?')<html.indexOf('slt-victorian-live.js?'),
  'Shared logo renderer must initialize before Game Center JS');
assert(html.indexOf('mbb-logo-system.css?')<html.indexOf('slt-victorian-live.css?'),
  'Shared logo design must load before Game Center styling');
const version=name=>{
 const i=html.indexOf(name+'?v=');
 assert(i>=0,'Game Center missing versioned asset '+name);
 return html.slice(i+name.length+3).split('"')[0];
};
assert.equal(version('slt-victorian-live.js'),version('slt-victorian-live.css'),
  'Game Center scripts/styles should share the same deployment revision');
assert(css.includes('.vld-team>.mbb-mark--schedule'),
  'Live scoreboard must size the shared mark without recreating its borders');
const first=js.indexOf('function crest(t){'),last=js.indexOf('function reportedFouls(',first);
assert(first>=0&&last>first,'Game Center crest renderer missing');
const source=js.slice(first,last);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
for(const league of ['ncaam','ncaaw']){
 let requested=null;
 const window={MBBLogos:{render:options=>{
  requested=options;
  return '<span class="mbb-mark mbb-mark--schedule" data-ring-count="2"></span>';
 }}};
 const crest=new Function('league','window','esc',source+'return crest;')(league,window,esc);
 for(const [id,name] of [['219','Pennsylvania Quakers'],['2426','Navy Midshipmen']]){
  const mark=crest({id,name,code:id,logo:'https://a.espncdn.com/i/teamlogos/ncaa/500/999.png'});
  assert.equal(requested.espnId,id,'Must resolve logo by exact ESPN team ID');
  assert.equal(requested.name,name,'Must provide team name to check identity');
  assert.equal(requested.size,'schedule','Must use the standard ledger-size badge');
  assert(mark.includes('data-ring-count="2"'),'Must render only the canonical two rings');
  assert(!mark.includes('999.png'),'Raw ESPN logo must not override verified identity');
  assert(!mark.includes('vld-crest'),'Must not add a third circular wrapper');
 }
 const fallback=new Function('league','window','esc',source+'return crest;')(
  league,{},esc)({id:'219',name:'Pennsylvania Quakers',code:'PENN',logo:'raw-logo'});
 assert(fallback.includes('vld-mark-unavailable')&&!fallback.includes('raw-logo'),
   'Failed catalog should show neutral fallback, never an unverified logo');
}
assert(js.includes("window.MBBLogos?.ready?.then("),
  'Live game must refresh canonical logos when the identity catalog loads');
console.log('PASS: verified Penn/Navy names, NCAA men/women canonical marks, two rings, no wrong raw ESPN logos');

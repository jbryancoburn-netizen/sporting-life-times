'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const ROOT=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const json=p=>JSON.parse(read(p));
const cross=json('data/ncaam-2026-27-espn-team-crosswalk.json');
const womenDirectory=json('data/ncaaw-2026-27-teams.json');
const expected={
 '84':'indiana','356':'illinois','2294':'iowa','130':'michigan',
 '127':'michigan-state-gruff','135':'minnesota','77':'northwestern','194':'ohio-state',
 '2509':'purdue','275':'wisconsin','213':'penn-state','158':'nebraska',
 '120':'maryland-terrapin','164':'rutgers','26':'ucla','30':'usc',
 '2483':'oregon','264':'washington'
};
const url=(slug)=>'assets/cbb-big-ten-1980s/centered/'+slug+'.png?v=20261114-bigten-live1';

async function system(){
 const sources={
  'data/mbb-logo-registry.json':json('data/mbb-logo-registry.json'),
  'data/ncaam-2026-27-espn-team-crosswalk.json':cross,
  'data/dual-ring-team-palette.json':json('data/dual-ring-team-palette.json'),
  'data/mbb-out-of-division-opponent-logos.json':json('data/mbb-out-of-division-opponent-logos.json')
 };
 const fakeFetch=async p=>{
  const key=String(p).split('?')[0];
  const result=sources[key];
  return {ok:result!==undefined,status:result===undefined?404:200,json:async()=>result};
 };
 const doc={readyState:'loading',documentElement:null,addEventListener(){}};
 const win={location:{pathname:'/ncaam-team.html',search:''}};
 const context={window:win,document:doc,fetch:fakeFetch,URL,URLSearchParams,
   console,HTMLImageElement:class {},MutationObserver:class {observe(){}}};
 vm.runInNewContext(read('mbb-logo-system.js'),context,{filename:'mbb-logo-system.js'});
 assert.equal(await win.MBBLogos.ready,true,'365-program NCAA logo data still loads');
 return win.MBBLogos;
}

test('all 18 CURRENT Big Ten names have authentic local assets and unambiguous IDs',async()=>{
 const logos=await system();
 const actual=Array.from(logos.heritageTeamIds());
 assert.equal(new Set(actual).size,18);
 assert.deepEqual(actual.sort(),Object.keys(expected).sort());
 for(const [id,slug] of Object.entries(expected)){
   const row=cross.teams.find(t=>String(t.espn_id)===id);
   assert(row,'Exact school must be present in 365-team roster '+id);
   assert.equal(logos.retroURLForESPN(id),url(slug));
   const disk=path.join(ROOT,'assets/cbb-big-ten-1980s/centered',slug+'.png');
   assert(fs.existsSync(disk),'Local asset missing '+disk);
   const bytes=fs.readFileSync(disk);
   assert(bytes.length>3000,'Asset too small '+slug);
   assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a','Actual PNG required');
   assert.equal(bytes.readUInt32BE(16),512,'512px original-era source: '+slug);
   assert.equal(bytes.readUInt32BE(20),512,'512px original-era source: '+slug);
   const woman=womenDirectory.teams.find(t=>String(t.team_id)===id);
   assert(woman,'Every Big Ten logo must map to the exact women’s school ID: '+id);
   assert(logos.byESPN(id,'score',woman.team).includes('src="'+url(slug)+'"'),
     'Identical retro artwork for women, including Penn State Lady Lions');
   const byEspn=logos.byESPN(id,'score',row.espn_name);
   const byNcaa=logos.byNCAA(row.id,'hero',row.name);
   for(const html of [byEspn,byNcaa]){
     assert(html.includes('mbb-mark--heritage'),'heritage class '+row.name);
     assert(html.includes('src="'+url(slug)+'"'),'Correct shared local logo '+row.name);
     assert(html.includes('data-espn-id="'+id+'"'),'Exact identity retained '+row.name);
     assert(html.includes('data-ring-count="2"'),'Double ring retained '+row.name);
     assert(!html.includes('a.espncdn.com'),'No external logo source '+row.name);
     assert(!html.includes('data-logo-alternate="https://'),'Do not fall back to modern provider logo');
   }
   assert.equal(logos.logoURL(row.id),url(slug),'Direct URL consumers get vintage mark');
 }
});
test('non-Big Ten schools retain their normal legacy data and site rings',async()=>{
 const logos=await system();
 for(const id of ['150','2287','2466','2908','265','204','66']){
   assert.equal(logos.retroURLForESPN(id),'','Outside the conference '+id);
   const mark=logos.byESPN(id,'score','Non Big Ten');
   assert(!mark.includes('mbb-mark--heritage'),'Do not affect non-Big Ten badges '+id);
 }
});
test('men and women team desks, ledgers, live center, ranks and conferences cache the new renderer',()=>{
 const pages=[
  'college-basketball.html','ncaam.html','ncaam-slate.html',
  'ncaam-team.html','ncaaw-team.html','ncaam-rankings.html',
  'ncaaw-rankings.html','ncaam-conference.html','ncaaw-conference.html',
  'ncaam-elo.html','ncaam-tournament.html','live-game.html',
  'cbb-gamefile.html','cbb-game-center.html'
 ];
 for(const page of pages){
  const html=read(page);
  assert(html.includes('mbb-logo-system.js?v=bigten18-production-20261114a'),'Bust legacy renderer cache: '+page);
  assert(html.includes('mbb-logo-system.css?v=bigten18-production-20261114a'),'Bust legacy ring stylesheet cache: '+page);
 }
 const wbbRanks=read('ncaaw-rankings.html');
 assert(wbbRanks.includes('wbb-rankings.js?v=bigten18-production-20261114a'));
 const women=read('wbb-rankings.js');
 assert(women.includes('MBBLogos?.retroURLForESPN?.(id)'),'Women poll resolves local historical assets by ID');
 assert(women.includes("wbbr-women-mark'+(heritage?' mbb-mark--heritage'"),'Women poll adopts same badge sizing');
});
test('same double-ring styling across all vintage schools, no per-team positioning',()=>{
 const css=read('mbb-logo-system.css');
 assert(css.includes('.mbb-mark--heritage>img.mbb-mark__img'));
 assert(css.includes('border-radius:50%!important'));
 assert(css.includes('width:94%!important'));
 assert(!css.includes('mbb-mark--heritage[data-espn-id='),'No one-off school image patches');
 const page=read('cbb-big-ten-1980s-preview.html');
 assert.equal((page.match(/<article class="school">/g)||[]).length,18);
 assert.equal((page.match(/michigan-state-gruff\.png/g)||[]).length,2);
 assert.equal((page.match(/maryland-terrapin\.png/g)||[]).length,1);
 assert(!page.includes('cbb-big-ten-optical-center'),'No old browser-image patch');
 assert(!page.includes('--slt-ink-'),'No pixel offsets');
 const sources=json('data/cbb-big-ten-heritage-mascot-provenance.json');
 for(const key of ['michigan-state-gruff','maryland-terrapin']){
  assert(sources[key].source.startsWith('https://content.sportslogos.net/'),'Historically attributed artwork');
  assert(sources[key].geometry.ring_margin_to_238px >= 15);
 }
});

// This acceptance suite intentionally includes previously unversioned Gamefile
// and Game Center stylesheets, so retro ring updates cannot be hidden by caches.

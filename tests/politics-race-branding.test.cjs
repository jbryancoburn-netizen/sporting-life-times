/* All-435 political newspaper: geometry, party and source integrity unit tests.
 * The full browser interaction and mobile tests live in politics-iowa-edition.test.cjs.
 */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const atlas=JSON.parse(read('politics-house-atlas.json'));
const sampleDocument={};
const context={document:sampleDocument,window:{},console};
vm.runInNewContext(read('politics-race-branding.js'),context);
const identity=context.window.PoliticsRaceBranding;
test('all 435 House seats receive a distinct real Census-district polygon and a state identity',()=>{
 assert.equal(atlas.districts.length,435);
 assert.equal(atlas.states.length,50);
 assert.equal(Object.keys(identity.named).length,50);
 assert.equal(Object.keys(identity.themes).length,50);
 const visited=new Set();
 let counted=0;
 for(const state of atlas.states){
  const geo=JSON.parse(read('politics-geometry/'+state.code+'.geojson'));
  assert.equal(geo.meta.state,state.code);
  assert.equal(geo.features.length,state.district_count);
  const districts=atlas.districts.filter(r=>r.state===state.code);
  assert.equal(districts.length,state.district_count);
  assert.equal(identity.named[state.code],state.name);
  assert.equal(identity.themes[state.code].length,2);
  const currentCodes=geo.features.map(f=>String(f.properties.CD120).padStart(2,'0'));
  for(const race of districts){
   assert(!visited.has(race.id),'duplicate district '+race.id);
   visited.add(race.id);
   assert(currentCodes.includes(race.district),race.id+' missing its 2026 Census polygon');
   counted++;
  }
 }
 assert.equal(counted,435);
});
test('close-race badges distinguish sourced observations from uncertified probabilities',()=>{
 const byId=new Map(atlas.districts.map(r=>[r.id,r]));
 for(const id of ['IA-01','IA-02','PA-10','FL-01','AK-00']){
  const race=byId.get(id);
  assert(race,id+' missing');
  const evidence=identity.watch(race);
  assert.equal(typeof evidence.isWatch,'boolean',id);
  assert.equal(typeof evidence.category,'string',id);
  if(evidence.poll)assert.equal(evidence.poll.year,2026);
  if(race['2026_boundaries_revised'])assert.equal(evidence.old,null,id+' old district lines never colored a current election');
 }
 assert.equal(atlas.forecast_eligible,false);
 assert.equal(atlas.certified_2026_probabilities,0);
 assert(!read('politics-race-branding.js').includes('Math.random('),'no random party predictions');
});
test('unified visual assets and source receipt links are present, with no Iowa-only override',()=>{
 const html=read('politics-house-district.html');
 const js=read('politics-house.js');
 const branding=read('politics-race-branding.js');
 const news=read('politics-race-experience.js');
 assert(html.includes('politics-race-branding.js'));
 assert(html.includes('politics-race-experience.js'));
 assert(!html.includes('politics-iowa-editorial.js'));
 assert(!html.includes('id="iowa-edition"'));
 assert(!js.includes('PoliticsIowaDesk'));
 assert(js.includes('PoliticsRaceExperience.renderDistrict'));
 assert(news.includes('PoliticsRaceBranding.renderDistrict'));
 assert(html.includes('id="race-receipts"'));
 assert(branding.includes('partyName=p=>'));
 assert(branding.includes('race-map-active'));
 assert(branding.includes('state-flag-image'));
 assert(branding.includes('flag(r.state'));
});

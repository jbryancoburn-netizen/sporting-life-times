/* Political newsroom cartography: every district is matched to a real Census polygon.
 * The interactive statewide and district browser checks live in politics-iowa-edition.test.cjs.
 */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const atlas=JSON.parse(read('politics-house-atlas.json'));
function districtId(feature,code){
 const props=feature.properties||{},raw=props.CD120??props.CD119;
 const n=Number(raw);
 return Number.isInteger(n)&&n>=0&&n<100?code+'-'+String(n).padStart(2,'0'):null;
}
test('each of 435 House race IDs matches exactly one real Census district geometry',()=>{
 assert.equal(atlas.districts.length,435);
 assert.equal(atlas.states.length,50);
 const found=new Set();
 for(const s of atlas.states){
  const geo=JSON.parse(read('politics-geometry/'+s.code+'.geojson'));
  assert.equal(geo.meta?.state,s.code,s.code);
  assert.equal(geo.type,'FeatureCollection',s.code);
  assert.equal(geo.features.length,s.district_count,s.code);
  const stateIds=new Set(atlas.districts.filter(r=>r.state===s.code).map(r=>r.id));
  for(const feature of geo.features){
   const id=districtId(feature,s.code);
   assert(id&&stateIds.has(id),id+' is not in published House ledger');
   assert(!found.has(id),'duplicate Census district '+id);
   assert(feature.geometry&&['Polygon','MultiPolygon'].includes(feature.geometry.type),id+' missing polygon');
   assert(Array.isArray(feature.geometry.coordinates)&&feature.geometry.coordinates.length,id+' missing coordinates');
   found.add(id);
  }
 }
 assert.equal(found.size,435);
 for(const r of atlas.districts)assert(found.has(r.id),r.id+' missing Census geography');
});
test('the shared 435-district renderer has real state identity and party badge fallbacks',()=>{
 const source=read('politics-race-branding.js');
 const mock={document:{},window:{},console};
 vm.runInNewContext(source,mock);
 const api=mock.window.PoliticsRaceBranding;
 assert.equal(Object.keys(api.named).length,50);
 assert.equal(Object.keys(api.themes).length,50);
 for(const method of ['branding','flag','stateInsignia','watch','renderDistrict','outlineDistrict','decorateStateCard','decorateNationalCard'])
  assert.equal(typeof api[method],'function',method);
 assert(source.includes('politics-geometry/'));
 assert(source.includes('race-map-active'));
 assert(source.includes('partyName(c.party)'));
 assert(source.includes('Special:FilePath/'));
 assert.equal(atlas.certified_2026_probabilities,0);
 assert.equal(atlas.forecast_eligible,false);
});

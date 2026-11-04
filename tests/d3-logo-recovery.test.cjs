const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const crosswalk=JSON.parse(fs.readFileSync('data/d3-verified-logo-slugs-2026-27.json','utf8'));
const d3=fs.readFileSync('d3-basketball.js','utf8'),d2=fs.readFileSync('d2-basketball.js','utf8');
const sourceStart=d3.indexOf('function mergeVerifiedLogos(');
const sourceEnd=d3.indexOf('const emblem=t=>',sourceStart);
if(sourceStart<0||sourceEnd<0)throw Error('Missing shared organization-ID logo overlay');
const sandbox={};
vm.runInNewContext(d3.slice(sourceStart,sourceEnd)+';this.merge=mergeVerifiedLogos;',sandbox);
test('published NCAA school-index mapping is exact and collision-free',()=>{
 assert.equal(crosswalk.source,'https://www.ncaa.com/json/schools');
 assert.equal(crosswalk.matching,'exact_normalized_school_name_only');
 assert.equal(crosswalk.verified_logo_slugs,307);
 assert.equal(Object.keys(crosswalk.schools).length,307);
 const values=new Set();
 for(const [org,match] of Object.entries(crosswalk.schools)){
  assert.match(org,/^\d+$/);
  assert.equal(match.match,'exact_normalized_name');
  assert.equal(match.source,crosswalk.source);
  assert.match(match.slug,/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert(!values.has(match.slug),'duplicate slug across different NCAA organizations');
  values.add(match.slug);
 }
});
test('same official school logo appears on DIII men and women; unresolved marks stay unresolved',()=>{
 const approved=new Map(Object.entries(crosswalk.schools).map(([org,s])=>[org,s.slug]));
 const schoolIds=new Map();
 for(const gender of ['men','women']){
  const d=JSON.parse(fs.readFileSync('data/d3-'+gender+'-2026-27.json','utf8'));
  const count=sandbox.merge(d.teams,approved);
  assert(count>=250,'most mapped team marks should become available in '+gender);
  for(const t of d.teams){
   if(!approved.has(String(t.ncaa_org_id)))assert.equal(t.slug||'','',
    'unmapped school must not receive a guessed logo: '+t.name);
   else assert.equal(t.slug,approved.get(String(t.ncaa_org_id)));
   const key=String(t.ncaa_org_id);
   if(schoolIds.has(key))assert.equal(t.slug,schoolIds.get(key),
    'institution must share the same mark between men and women');
   schoolIds.set(key,t.slug||'');
  }
 }
 assert.equal(approved.get('4'),'adrian');
 assert.equal(approved.get('2798'),'albertus-magnus');
});
test('DIII publishing workflow persists verified logos on every rebuilt season file',()=>{
 const publisher=fs.readFileSync('scripts/build_d3_basketball.mjs','utf8');
 assert(publisher.includes('function applyOfficialLogoCrosswalk(teams)'));
 assert(publisher.includes('const logoCoverage=applyOfficialLogoCrosswalk(next.teams)'));
 assert(publisher.includes('next.coverage.verified_logo_slugs=logoCoverage.matched'));
 assert(publisher.includes("team.logo_source='NCAA school index · exact organization ID'"));
 assert(publisher.includes("team.slug=match.slug"));
});
test('both lower divisions use official NCAA school SVGs before independent mirror',()=>{
 for(const script of [d2,d3]){
  assert(script.includes('https://www.ncaa.com/sites/default/files/images/logos/schools/bgl/'));
  assert(script.includes('data-logo-fallback="https://ncaa-api.henrygd.me/logo/'));
  assert(script.includes('delete this.dataset.logoFallback'));
  assert(script.includes('logo-shell'));
 }
 assert(d3.includes('mergeVerifiedLogos(d.teams,logoCrosswalk)'));
 assert(d3.includes('approved?.get(String(org))'));
 for(const path of ['d3-mens-basketball.html','d3-womens-basketball.html']){
  const html=fs.readFileSync(path,'utf8');
  assert(html.includes('d3-basketball.js?v=20261104-official-school-logo-recovery1'));
 }
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),crypto=require('node:crypto');
const read=p=>fs.readFileSync(p,'utf8'),json=p=>JSON.parse(read(p));
const archive=json('data/cbb-retro-archive.json');
const registry=json('data/mbb-logo-registry.json').teams;
const audit=json('data/cbb-precomposed-crest-audit.json');
const normalize=s=>s.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g,'');
test('historical archive has unique, school-matched dated sources and intact local originals',()=>{
 assert.equal(archive.count,archive.schools.length);
 assert.equal(new Set(archive.schools.map(t=>t.id)).size,archive.count);
 for(const t of archive.schools){
  assert.equal(registry[t.id].display_name,t.display_name);
  assert(t.start<=2006&&(t.end===null?t.start<=1999:t.end>=t.start));
  if(t.evidence_type==='timeline_row'){
   assert(t.archival_name);
   assert.equal(normalize(t.era_text),normalize(t.start+' - '+(t.end||'Present')));
  }else{
   assert.equal(normalize(t.alt),normalize((t.archival_name||t.display_name)+' '+(t.logo_type||'Primary')+' Logo '+t.start+' - '+(t.end||'Present')));
  }
  assert(['sportslogohistory.com','www.sportslogos.net'].includes(new URL(t.page_url).hostname));
  assert(['sportslogohistory.com','content.sportslogos.net'].includes(new URL(t.image_url).hostname));
  const source=fs.readFileSync(t.local_path);
  assert.equal(source.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(crypto.createHash('sha256').update(source).digest('hex'),t.local_sha256);
  assert.equal(audit.crests[t.id].source,t.local_path);
  assert.equal(audit.crests[t.id].heritage,true);
 }
 assert.equal(audit.vintage_count,86+archive.count);
});
test('every added retro source is credited with its school and era',()=>{
 const credits=read('cbb-logo-credits.html');
 for(const t of archive.schools){
  assert(credits.includes(t.page_url));
  assert(credits.includes(t.start+'–'+(t.end||'Present')));
 }
 assert(read('ncaam-rankings.html').includes('href="cbb-logo-credits.html"'));
});
test('remaining-source followup lists exactly the schools still using verified current art',()=>{
 const followup=json('data/cbb-retro-research-followup.json');
 assert.equal(followup.additional_verified+followup.remaining,followup.schools_reviewed);
 assert.equal(followup.remaining,followup.schools.length);
 const current=Object.keys(audit.crests).filter(id=>!audit.crests[id].heritage).sort();
 assert.deepEqual(followup.schools.map(t=>t.id).sort(),current);
});

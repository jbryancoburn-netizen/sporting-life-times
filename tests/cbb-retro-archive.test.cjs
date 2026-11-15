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
  assert(t.start<=1999&&t.end>=t.start);
  assert.equal(normalize(t.alt),normalize(t.display_name+' Primary Logo '+t.start+' - '+t.end));
  assert(t.page_url.startsWith('https://sportslogohistory.com/'));
  assert(t.image_url.startsWith('https://sportslogohistory.com/wp-content/uploads/'));
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
  assert(credits.includes(t.start+'–'+t.end));
 }
 assert(read('ncaam-rankings.html').includes('href="cbb-logo-credits.html"'));
});

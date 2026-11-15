'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const audit=JSON.parse(fs.readFileSync('data/cbb-precomposed-crest-audit.json','utf8'));
const men=JSON.parse(fs.readFileSync('data/mbb-logo-registry.json','utf8')).teams;
const women=JSON.parse(fs.readFileSync('data/ncaaw-2026-27-retro-primary.json','utf8')).rankings;
const source=fs.readFileSync('mbb-logo-system.js','utf8');
const css=fs.readFileSync('mbb-logo-system.css','utf8');
test('embossed variants preserve all original masters and cover both editions',()=>{
 const {createHash}=require('node:crypto');
 const finish=JSON.parse(fs.readFileSync('data/cbb-embossed-crest-audit.json','utf8'));
 assert.equal(finish.count,365);
 assert.equal(finish.rings,2);
 assert.deepEqual(Object.keys(finish.crests).sort(),Object.keys(men).sort());
 for(const [id,entry] of Object.entries(finish.crests)){
  const master=fs.readFileSync('assets/cbb-precomposed-crests/'+id+'.png');
  const embossed=fs.readFileSync('assets/cbb-embossed-crests/'+id+'.png');
  assert.equal(createHash('sha256').update(master).digest('hex'),entry.master_sha256,'Original school art changed: '+id);
  assert.equal(createHash('sha256').update(embossed).digest('hex'),entry.embossed_sha256,'Embossed asset changed: '+id);
  assert.notDeepEqual(master,embossed,'Finish missing: '+id);
 }
});
test('all 365 NCAA programs have precomposed local 512px PNGs with certified two-color rings',()=>{
 assert.equal(audit.count,365);
 assert.equal(audit.rings,2);
 assert(audit.vintage_count>=80);
 assert.deepEqual(Object.keys(audit.crests).sort(),Object.keys(men).sort());
 for(const [id,entry] of Object.entries(audit.crests)){
  const file=path.join('assets/cbb-precomposed-crests',id+'.png');
  assert(fs.existsSync(file),'missing '+file);
  const data=fs.readFileSync(file);
  assert(data.length>500,'empty or corrupt '+file);
  assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a','not PNG '+file);
  assert.equal(data.readUInt32BE(16),512,'wrong image width '+file);
  assert.equal(data.readUInt32BE(20),512,'wrong image height '+file);
  assert(entry.primary&&entry.secondary&&entry.primary.toLowerCase()!==entry.secondary.toLowerCase());
  assert(men[id].canonical_id,'missing program identity '+id);
 }
});
test('all 363 women are covered by the exact same self-hosted asset catalog',()=>{
 assert.equal(women.length,363);
 for(const team of women)assert(audit.crests[String(team.team_id)],'women missing logo '+team.team);
});
test('one renderer uses baked crest, with no additional CSS rings, no provider fallback',()=>{
 assert(source.includes("const baked=known?'assets/cbb-embossed-crests/'"));
 assert(source.includes("const backup=baked||heritage?'':known?"));
 assert(source.includes("mbb-mark--precomposed"));
 assert(css.includes(".mbb-mark.mbb-mark--precomposed::before"));
 assert(css.includes("content:none!important;display:none!important"));
 assert(fs.readFileSync('wbb-rankings.js','utf8').includes("assets/cbb-embossed-crests/"));
 assert(fs.readFileSync('ncaam-rankings.html','utf8').includes("assets/cbb-embossed-crests/"));
});

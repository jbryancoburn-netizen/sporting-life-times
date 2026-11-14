'use strict';
const fs=require('node:fs'),path=require('node:path'),test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=x=>fs.readFileSync(path.join(root,x)),j=x=>JSON.parse(read(x).toString('utf8'));
test('all current 16 SEC schools have unique original-era local crests',()=>{
 const manifest=j('data/cbb-sec-1980s-source-manifest.json'),rows=manifest.schools;
 assert.equal(rows.length,16);assert.equal(manifest.current_member_count,16);
 assert.equal(rows.filter(r=>r.in_sec_1980s).length,10);
 assert.equal(new Set(rows.map(r=>r.espn_id)).size,16);
 assert.equal(manifest.production_deployment,false);
 for(const r of rows){
  assert.equal(r.local_path,'assets/cbb-sec-1980s/'+r.slug+'.png');
  assert(r.archive_url.startsWith('https://www.sportslogos.net/logos/view/'));
  const bytes=read(r.local_path);assert(bytes.length>3000,'Incomplete PNG '+r.slug);
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(bytes.readUInt32BE(16),512);assert.equal(bytes.readUInt32BE(20),512);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),r.local_sha256);
  assert(r.geometry.gap_to_238px_ring>=18,'Art overlaps double rings: '+r.slug);
  assert.notEqual(r.primary.toLowerCase(),r.secondary.toLowerCase(),'Two distinct color rings');
 }
});
test('SEC preview uses only local 16 artwork and does not change production renderer',()=>{
 const html=read('cbb-sec-1980s-preview.html').toString('utf8');
 assert.equal((html.match(/<article class="school">/g)||[]).length,16);
 assert.equal((html.match(/assets\/cbb-sec-1980s\//g)||[]).length,16);
 assert(!html.includes('content.sportslogos.net'), 'CDN cannot appear in runtime HTML');
 assert(html.includes('not yet the production logo set'));
});

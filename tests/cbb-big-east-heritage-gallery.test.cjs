'use strict';
/* Big East historical artwork is a REVIEW gallery, not a production release. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const file=p=>fs.readFileSync(path.join(root,p));
const manifest=JSON.parse(file('data/cbb-big-east-1980s-source-manifest.json').toString('utf8'));
const gallery=file('cbb-big-east-1980s-preview.html').toString('utf8');

test('eleven exact university IDs have their own historical local 1980s source and unchanged live logo renderer',()=>{
 assert.equal(manifest.conference,'Big East');
 assert.equal(manifest.current_member_count,11);
 assert.equal(manifest.historical_big_east_members_among_current,6);
 assert.equal(manifest.later_arrivals,5);
 assert.equal(manifest.production_deployment,false,'A preview cannot secretly replace real CBB logos');
 assert.deepEqual(manifest.schools.map(x=>String(x.espn_id)).sort(),
 ['2086','41','156','305','46','269','2507','2599','2550','222','2752'].sort());
 assert.equal(manifest.schools.filter(x=>x.in_big_east_1980s).length,6);
 assert.equal((gallery.match(/<article class="school">/g)||[]).length,11);
 assert.equal((gallery.match(/assets\/cbb-big-east-1980s\//g)||[]).length,11);
 assert(gallery.includes('editorial review gallery, not a production logo release'));
 assert(!gallery.includes('content.sportslogos.net'),'No third-party hotlinked images');
 const js=file('mbb-logo-system.js').toString('utf8');
 assert(!js.includes('BIG_EAST_HERITAGE'),'Review must not change production badges');
 for(const row of manifest.schools){
  const artwork=file(row.local_path);
  assert(row.image_url.startsWith('https://content.sportslogos.net/logos/'));
  assert(row.archive_url.startsWith('https://www.sportslogos.net/logos/view/'));
  assert.equal(row.local_path,'assets/cbb-big-east-1980s/'+row.slug+'.png');
  assert(artwork.length>3000);
  assert.equal(artwork.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(artwork.readUInt32BE(16),512);
  assert.equal(artwork.readUInt32BE(20),512);
  assert.equal(crypto.createHash('sha256').update(artwork).digest('hex'),row.local_sha256);
  assert(row.geometry.gap_to_238px_ring>=18,'No crop/ring overlap: '+row.slug);
  assert(row.primary!==row.secondary,'Two school-color rings');
  assert(gallery.includes(row.local_path),'All images must be in audit gallery');
 }
});

test('marquee historical brand ambiguities explicitly disclosed in review gallery',()=>{
 const bySlug=Object.fromEntries(manifest.schools.map(s=>[s.slug,s]));
 assert.match(bySlug.marquette.context_note,/retired/);
 assert.match(bySlug.providence.context_note,/hockey-specific/);
 assert.match(gallery,/hockey-specific/);
 assert.match(gallery,/Warriors-era/);
 assert.equal(bySlug['st-johns'].era,'1980–1991');
 assert.equal(bySlug.xavier.era,'1983–1996');
});

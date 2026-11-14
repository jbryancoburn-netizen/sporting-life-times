'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const manifest=JSON.parse(read('data/cbb-acc-1980s-source-manifest.json'));
const source=read('cbb-acc-1980s-preview.html');

test('ACC audit gallery represents exactly 18 current institutions, with 7 1980s-era league members',()=>{
 assert.equal(manifest.current_member_count,18);
 assert.equal(manifest.historical_acc_members_among_current,7);
 assert.equal(manifest.later_arrivals,11);
 assert.equal(manifest.production_deployment,true);
 assert.equal(manifest.schools.length,18);
 assert.equal(new Set(manifest.schools.map(s=>s.slug)).size,18);
 assert.equal(new Set(manifest.schools.map(s=>s.espn_id)).size,18);
 assert.equal(manifest.schools.filter(s=>s.in_acc_1980s).length,7);
 assert.equal((source.match(/<article class="school">/g)||[]).length,18);
 assert.equal((source.match(/>Historical source<\/a>/g)||[]).length,18);
 assert(source.includes('published historical ACC logo designs'));
});

test('all 18 historic logo assets are self-hosted and optically fit a 2-ring 512-pixel circle',()=>{
 assert(!/<img[^>]+src="https?:/i.test(source));
 assert(!source.includes('--slt-ink-'),'No previous team-specific image offsets');
 assert(!source.includes('cbb-big-ten-optical-center'),'No browser image adjustments');
 for(const s of manifest.schools){
   const p=path.join(root,s.local_path);
   assert(fs.existsSync(p),s.slug);
   const raw=fs.readFileSync(p);
   assert.equal(raw.subarray(0,8).toString('hex'),'89504e470d0a1a0a',s.slug);
   assert.equal(raw.readUInt32BE(16),512,s.slug);
   assert.equal(raw.readUInt32BE(20),512,s.slug);
   assert(s.geometry.gap_to_238px_ring>=18,s.slug+' ring clearance insufficient');
   assert(s.image_url.startsWith('https://content.sportslogos.net/'),s.slug+' must have authenticated archive CDN source');
   assert(s.archive_url.startsWith('https://www.sportslogos.net/logos/view/'),s.slug+' must credit a dated historical page');
   assert(source.includes('assets/cbb-acc-1980s/'+s.slug+'.png'),s.slug);
   assert(source.includes('style="--primary:'+s.primary+';--secondary:'+s.secondary+'"'),s.slug);
   const m=s.era.match(/^(\d{4})[–-](\d{4}|present)$/);
   assert(m,s.slug+' historical period missing');
   assert(Number(m[1])<=1989,s.slug+' design begins after 1980s');
   assert(m[2]==='present'||Number(m[2])>=1980,s.slug+' era ends before 1980s');
 }
});

test('1980s Buzz, Otto, Strutting Wolf and vintage mascots beat monograms when they existed',()=>{
 const bySlug=Object.fromEntries(manifest.schools.map(s=>[s.slug,s]));
 assert.equal(bySlug['georgia-tech'].era,'1985–1999');
 assert.match(bySlug['georgia-tech'].description,/Buzz yellowjacket/);
 assert.match(bySlug['clemson'].description,/tiger head/);
 assert.match(bySlug['nc-state'].description,/Strutting Wolf/);
 assert.match(bySlug['north-carolina'].description,/Rameses/);
 assert.match(bySlug['syracuse'].description,/Otto/);
 assert.match(bySlug['miami'].description,/Sebastian/);
 assert.match(bySlug['california'].description,/bear mascot/);
 assert.match(bySlug['duke'].description,/Blue Devil/);
});

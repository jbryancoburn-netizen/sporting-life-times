#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const root='data/soccer-2026-selection-archive/';
const manifest=JSON.parse(fs.readFileSync(root+'manifest.json','utf8'));
assert.equal(manifest.immutable,true);
assert.equal(manifest.files.length,4);
for(const file of manifest.files){
 assert(file.path.startsWith(root));
 const bytes=fs.readFileSync(file.path);
 const hash=crypto.createHash('sha1').update('blob '+bytes.length+'\0','utf8').update(bytes).digest('hex');
 assert.equal(hash,file.git_blob_sha1,'Locked soccer forecast changed: '+file.path);
}
const retro=JSON.parse(fs.readFileSync(root+'retro-preselection-forecast.json','utf8'));
const rpi=JSON.parse(fs.readFileSync(root+'rpi-preselection-forecast.json','utf8'));
assert.equal(retro.field.length,48);
assert.equal(rpi.field.length,48);
assert.equal(retro.rating_cutoff,'2026-11-15');
assert.equal(rpi.rpi_as_of,'2026-11-14');
assert.equal(rpi.independent_of_retro,true);
assert(retro.field.every(x=>x.team_id)&&rpi.field.every(x=>x.team_id));
console.log('PASS: archived 2026 RETRO and RPI selections are unchanged and independently sourced');

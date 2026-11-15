'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const manifest=JSON.parse(fs.readFileSync('data/cbb-heritage-medallions-audit.json','utf8'));
const renderer=fs.readFileSync('mbb-logo-system.js','utf8');
const css=fs.readFileSync('mbb-logo-system.css','utf8');
const women=fs.readFileSync('wbb-rankings.js','utf8');
test('historical crests are real audited PNGs with two school-color rings baked into source pixels',()=>{
 assert.equal(manifest.format,'baked-two-ring-crest-v1');
 assert.equal(manifest.rendered_count,86);
 assert.equal(manifest.records.length,86);
 assert.equal(new Set(manifest.records.map(x=>x.espn_id)).size,86);
 for(const x of manifest.records){
  const png=fs.readFileSync(x.asset);
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a',x.asset);
  assert.equal(png.readUInt32BE(16),512,x.asset);
  assert.equal(png.readUInt32BE(20),512,x.asset);
  assert(fs.existsSync(x.source),x.source);
  assert.notEqual(x.ring_colors[0].toLowerCase(),x.ring_colors[1].toLowerCase());
  assert(x.art_size.every(n=>Number.isInteger(n)&&n>=1&&n<=400),x.asset);
 }
});
test('one shared renderer uses baked assets without browser-generated additional rings',()=>{
 assert.match(renderer,/assets\/cbb-heritage-medallions\//);
 assert.match(renderer,/mbb-mark--baked/);
 assert.match(women,/assets\/cbb-heritage-medallions\//);
 assert.match(women,/mbb-mark--baked/);
 assert.match(css,/\.mbb-mark\.mbb-mark--baked::before/);
 assert.match(css,/\.mbb-mark\.mbb-mark--baked>img\.mbb-mark__img/);
 assert.match(css,/border:0!important/);
});

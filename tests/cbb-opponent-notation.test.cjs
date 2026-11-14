'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('women calendar: @ away, vs. home and vs. Opponent (N) on neutral court',()=>{
 const source=fs.readFileSync('wbb-team-newspaper.js','utf8');
 const functions=source.match(/const matchupPrefix=g=>[^;]+;\s*const matchupSuffix=g=>[^;]+;/);
 assert.ok(functions,'women calendar venue notation functions present');
 const {matchupPrefix,matchupSuffix}=vm.runInNewContext(functions[0]+'\n({matchupPrefix,matchupSuffix})',{});
 for(const [site,want] of [['home','vs. Missouri'],['away','@ Missouri'],['neutral','vs. Missouri (N)']]){
   const game={site};
   assert.equal(matchupPrefix(game)+'Missouri'+matchupSuffix(game),want);
 }
 assert.equal(matchupPrefix({site:'unknown'})+'Missouri'+matchupSuffix({site:'unknown'}),'Missouri',
   'unverified site must not be presented as a confirmed home or neutral court');
 assert(source.includes("esc(matchupPrefix(g))"));
 assert(source.includes("esc(matchupSuffix(g))"));
});

test('men and women share the new form notation without stale script cache',()=>{
 for(const page of ['ncaam-team.html','ncaaw-team.html']){
   const source=fs.readFileSync(page,'utf8');
   assert(source.includes('cbb-team-form.js?v=site-notation-neutral-proof-20261113'),page);
 }
 assert(fs.readFileSync('ncaam-team.html','utf8').includes('mbb-team-calendar-boot.js?v=site-notation-20261113'));
 assert(fs.readFileSync('ncaaw-team.html','utf8').includes('wbb-team-newspaper.js?v=site-notation-20261113'));
});

'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {test}=require('node:test');

test('Rivalry Archive and team desk use the same optional pre-1985 fixture dataset',()=>{
 const rivalry=fs.readFileSync('ncaam-rivalry.js','utf8');
 const team=fs.readFileSync('mbb-newspaper.js','utf8');
 for(const source of [rivalry,team]){
  assert.match(source,/ncaam-pre1985-verified-fixtures\.csv/);
  assert.match(source,/1984/);
  assert.doesNotThrow(()=>new Function(source));
 }
});

test('Older games never imply unverified home courts or complete all-time records',()=>{
 const team=fs.readFileSync('mbb-newspaper.js','utf8');
 assert.match(team,/venue_unverified:true/);
 assert.match(team,/Venue not verified/);
 assert.match(team,/not an all-time record/);
 const rivalry=fs.readFileSync('ncaam-rivalry.js','utf8');
 assert.match(rivalry,/Historical coverage before 1985 is incomplete/);
});

test('Historical-source workflow publishes only audited, authorized source fixtures',()=>{
 const workflow=fs.readFileSync('.github/workflows/ncaam-pre1985-backfill.yml','utf8');
 const importer=fs.readFileSync('scripts/import_ncaam_pre1985_unc_duke.py','utf8');
 assert.match(workflow,/verified-national-fixtures\.csv data\/ncaam-pre1985-verified-fixtures\.csv/);
 assert.match(workflow,/Duplicate pre-1985 fixture/);
 assert.match(importer,/1950<=season<=1984/);
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('wbb-roster-desk.js','utf8');
const window={};vm.runInNewContext(code,{window,URL,Map,String,Number,Array,Set});
const match=window.WBBRosterDesk.verifiedPortraits;
const players=[
 {name:'Olivia Jones',number:'0',profile_url:'https://example.edu/wbb/olivia'},
 {name:'Aubrey Shaw',number:'1',profile_url:'https://example.edu/wbb/aubrey'}
];
const roster={
 status:'success',season:{year:2027},team:{id:'108'},
 athletes:[
  {fullName:'Olivia Jones',jersey:'0',headshot:{href:'https://a.espncdn.com/photo/olivia.png'}},
  {displayName:'Aubrey Shaw',jersey:'1',headshot:{href:'https://a.espncdn.com/photo/aubrey.png'}}
 ]};
test('photos are only accepted for an exact 2026-27 women roster name + jersey pairing',()=>{
 const photos=match(roster,players,'108');
 assert.equal(photos.size,2);
 assert.equal(photos.get('oliviajones|0'),'https://a.espncdn.com/photo/olivia.png');
 assert.equal(photos.get('aubreyshaw|1'),'https://a.espncdn.com/photo/aubrey.png');
});
test('reject different player jersey, wrong women school, or previous season',()=>{
 const other={...roster,athletes:[{...roster.athletes[0],jersey:'11'},roster.athletes[1]]};
 assert.equal(match(other,players,'108').size,1);
 assert.equal(match(roster,players,'87').size,0);
 assert.equal(match({...roster,season:{year:2026}},players,'108').size,0);
});
test('reject ambiguous duplicate player identities and insecure portrait URLs',()=>{
 const duplicated={...roster,athletes:[roster.athletes[0],roster.athletes[0]]};
 assert.equal(match(duplicated,players,'108').size,0);
 const untrusted={...roster,athletes:[{...roster.athletes[0],headshot:{href:'javascript:alert(1)'}}]};
 assert.equal(match(untrusted,players,'108').size,0);
});
test('roster grouping with nested items is supported without adopting men’s players',()=>{
 const grouped={...roster,athletes:[{items:[roster.athletes[0]]},{items:[roster.athletes[1]]}]};
 assert.equal(match(grouped,players,'108').size,2);
 assert.equal(match({...roster,athletes:[]},players,'108').size,0);
});

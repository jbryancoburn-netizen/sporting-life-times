'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {test}=require('node:test');
const read=(path)=>JSON.parse(fs.readFileSync(path,'utf8'));
const archive=fs.readFileSync('ncaam-rivalry.js','utf8');
test('Rivalry archive connects to live historical main branch',()=>{
 assert.match(archive,/zachmayer\/kaggleNCAA\/main\/inst\/kaggle_data\//);
 assert.doesNotMatch(archive,/zachmayer\/kaggleNCAA\/master\//);
 assert.doesNotMatch(archive,/eraLogos|logoTimelines/);
});
test('All five NIT seasons have 31 nonduplicate, dated games and are connected',()=>{
 assert.match(archive,/for\(const season of \[2022,2023,2024,2025,2026\]\)/);
 for(let year=2022;year<=2026;year++){
  const games=read('data/ncaam-postseason-'+year+'-nit.json').games;
  assert.equal(games.length,31,year+' NIT game count');
  const ids=new Set();
  for(const g of games){
   assert.equal(g.season,year);
   assert.match(g.date,new RegExp('^'+year+'-\\d{2}-\\d{2}$'));
   assert.ok(Number.isInteger(g.ws)&&Number.isInteger(g.ls)&&g.ws>g.ls);
   assert.ok(g.winner&&g.loser&&g.winner!==g.loser&&g.round);
   const id=[g.date,g.winner,g.loser,g.ws,g.ls].join('|');
   assert.ok(!ids.has(id),'Duplicate NIT '+year+' '+id);ids.add(id);
  }
 }
});
test('NCAA 2025 and 2026 each contain 67 scored tournament games with four First Four',()=>{
 for(const year of [2025,2026]){
  const games=read('data/ncaam-postseason-'+year+'-ncaa.json').games;
  assert.equal(games.length,67,year+' NCAA count');
  assert.equal(games.filter(g=>g.round==='First Four').length,4);
  const ids=new Set();
  for(const g of games){
   assert.ok(g.ws>g.ls&&g.winner!==g.loser);
   const key=[g.winner,g.loser,g.ws,g.ls].join('|');
   assert.ok(!ids.has(key),'Duplicate NCAA game '+year+' '+key);ids.add(key);
  }
 }
});
test('The remaining twelve 2022-2024 NCAA First Four match records are complete',()=>{
 const games=read('data/ncaam-postseason-first-four-2022-2024.json').games;
 assert.equal(games.length,12);
 for(const year of [2022,2023,2024]){
  const subset=games.filter(g=>g.season===year);
  assert.equal(subset.length,4);
  assert.ok(subset.every(g=>g.round==='First Four'&&g.date.startsWith(year+'-')&&g.ws>g.ls));
 }
 assert.match(archive,/ncaam-postseason-first-four-2022-2024\.json/);
});
test('Script still compiles and page references the latest script',()=>{
 new Function(archive);
 const html=fs.readFileSync('ncaam-rivalry.html','utf8');
 assert.match(html,/ncaam-rivalry\.js\?v=28/);
});

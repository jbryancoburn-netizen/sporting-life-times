const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('DII papers exist for men and women with shared newspaper renderer',()=>{
for(const [file,gender] of [['d2-mens-basketball.html','men'],['d2-womens-basketball.html','women']]){
 const s=fs.readFileSync(file,'utf8');assert.match(s,new RegExp('data-gender="'+gender+'"'));assert.match(s,/d2-basketball\.js/);assert.match(s,/d2-basketball\.css/);assert.match(s,/THE SPORTING LIFE/);}
});
test('both 2026-27 ledgers have isolated sexes, 298 target and a 1500 reset',()=>{
for(const gender of ['men','women']){const d=JSON.parse(fs.readFileSync('data/d2-'+gender+'-2026-27.json','utf8'));
assert.equal(d.gender,gender);assert.equal(d.starting_elo,1500);assert.equal(d.team_target,298);
assert.ok(Array.isArray(d.teams));assert.ok(Array.isArray(d.games));}
});
test('single common team desk routes to separate gender-specific dataset',()=>{
const s=fs.readFileSync('d2-team.html','utf8');assert.match(s,/d2-basketball\.js/);
const js=fs.readFileSync('d2-basketball.js','utf8');assert.match(js,/elo_eligible/);assert.match(js,/game-grid/);assert.match(js,/conference-board/);
});

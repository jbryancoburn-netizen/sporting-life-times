// Prevent a cached or reverted NBA division register from replacing the responsive ledger.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=name=>fs.readFileSync(name,'utf8');
const src=read('nba-newspaper.js'),css=read('nba-standings-identity.css');
test('standings division register uses the separate club/record/PCT/RETRO ledger',()=>{
 assert.match(src,/function divisionRegisterRows\(list\)/);
 assert.match(src,/divisionRegisterRows\(clubs\)/);
 assert.match(src,/nba-division-ledger-head/);
 assert.match(src,/nba-division-ledger-record/);
 assert.match(src,/nba-division-ledger-pct/);
 assert.match(src,/nba-division-ledger-rating/);
 assert.match(css,/\.nba-division-ledger-row/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\) 50px 51px 56px/);
});
test('conference division desks prioritize larger records, with RETRO underneath',()=>{
 assert.match(src,/function divisionDeskRows\(list\)/);
 assert.match(src,/divisionDeskRows\(all\.filter/);
 assert.match(src,/nba-division-desk-record/);
 assert.match(src,/nba-division-desk-rating/);
 assert.match(css,/\.nba-division-desk-record\s*\{[^}]*font:700 21px\/1 Georgia/s);
 assert.match(css,/\.nba-division-desk-rating\s*\{[^}]*font:400 11px\/1\.25 Georgia/s);
});
test('both pages load the current shared division source and style',()=>{
 for(const page of ['nba-standings.html','nba-conference.html']){
  const html=read(page);
  assert.match(html,/nba-newspaper\.js\?v=division-ledger-mobile-v3-20261105/);
  assert.match(html,/nba-standings-identity\.css\?v=division-ledger-mobile-v3-20261105/);
 }
});

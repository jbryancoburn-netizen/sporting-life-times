const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=name=>fs.readFileSync(name,'utf8');
const page=read('nba-game-center.html');
const live=read('nba-live-feed.js');
const archive=read('nba-game-center.js');
test('NBA Game Center keeps the date calendar and clear previous/next/today controls',()=>{
 for(const id of ['nba-game-date','nba-date-previous','nba-date-next','nba-date-today','nba-date-week','nba-live-feed'])assert.ok(page.includes('id="'+id+'"'),id+' missing');
 assert.match(page,/type="date"/);
 assert.match(page,/nba-live-feed\.js\?v=[a-z0-9-]+/i);
 assert.match(page,/nba-game-center\.js\?v=[a-z0-9-]+/i);
});
test('mobile calendar uses the unified stylesheet and keeps controls in separate rows',()=>{
 const css=read('nba-ledger-unified.css');
 assert.ok(page.includes('href="nba-ledger-unified.css?v='));
 assert.ok(css.includes('grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:auto auto'));
 assert.ok(css.includes('.nba-date-picker-label{grid-column:1/-1;grid-row:1'));
 for(const id of ['nba-date-previous','nba-date-next','nba-date-today'])assert.ok(css.includes('#'+id+'{grid-column:'));
 assert.ok(css.includes('.nba-date-picker-label input{width:100%;min-width:0;font-size:16px'));
});
test('date selection uses selected Eastern date and nearby ESPN schedules',()=>{
 for(const text of ['function initDateNav()','function chooseDay(day,push=true)','function renderDateNav()','const effectiveDay=()','ESPN selected day','ESPN ET boundary (prior)','ESPN ET boundary (next)'])assert.ok(live.includes(text),text+' missing');
 assert.match(live,/gameDay\(when\)!==today/);
 assert.match(live,/today!==effectiveDay\(\)/);
 assert.match(live,/data\/nba-game-center\.json/);
 assert.match(live,/data\/nba-upcoming-schedule\.json/);
});
test('the original live homepage remains today-only and refreshes every thirty seconds',()=>{
 assert.match(live,/const nbaDateInput=document\.getElementById\('nba-game-date'\)/);
 assert.match(live,/chosenDay\?compactDay\(chosenDay\):etDay\(Date\.now\(\)\)/);
 assert.match(live,/effectiveDay\(\)===etDay\(Date\.now\(\)\)/);
 assert.match(live,/},30000\)/);
 assert.doesNotMatch(read('nba.html'),/id="nba-game-date"/);
});
test('opening a historical full box score preserves the selected date',()=>{
 assert.match(archive,/url\.searchParams\.set\('game',g\.id\)/);
 assert.doesNotMatch(archive,/history\.replaceState\(null,'','\?game='/);
});

test('NBA uses the shared Ledger frame, native pregame forecast and compact final',()=>{
 assert.match(live,/<article class="sl-game ledger26-card" data-nba-card>/);
 assert.match(live,/<details class="ledger26-expand sl-game-expansion"/);
 assert.match(live,/compactFinal:true,suppressPress:true,suppressMonogram:true/);
 assert.match(live,/forecast:prediction\?/);
 assert.doesNotMatch(live,/nba-retro-schedule-forecast/);
 assert.match(page,/frame\.hidden=/);
});

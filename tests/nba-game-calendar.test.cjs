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
 assert.match(page,/nba-live-feed\.js\?v=date-calendar-navigation-20261105/);
 assert.match(page,/nba-game-center\.js\?v=date-calendar-navigation-20261105/);
});
test('mobile calendar date occupies its own row and buttons cannot overlap it',()=>{
 assert.match(page,/@media\(max-width:650px\)\{[\s\S]*?\.nba-date-main\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\);grid-template-rows:auto auto/);
 assert.match(page,/\.nba-date-picker-label\{grid-column:1 \/ -1;grid-row:1;min-width:0;width:100%/);
 assert.match(page,/#nba-date-previous\{grid-column:1;grid-row:2\}/);
 assert.match(page,/#nba-date-next\{grid-column:3;grid-row:2\}/);
 assert.match(page,/\.nba-date-main \.nba-date-today\{grid-column:2;grid-row:2/);
 assert.match(page,/\.nba-date-picker-label input\{min-width:0;max-width:100%;width:100%;font-size:16px/);
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

/* RETRO live-game panel must only show verified frozen pregame forecasts.
   Never substitute current score, sportsbook odds, or an inferred live win chance. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
const text=fs.readFileSync('slt-victorian-live.js','utf8');
const start=text.indexOf('function qualifiedPregame(row,game){');
const end=text.indexOf('function archivedPregame(game){',start);
assert(start>=0&&end>start,'RETRO qualification logic absent');
const source=text.slice(start,end);
const run=(league,id,row,game)=>
 new Function('league','id',source+'\nreturn qualifiedPregame(arguments[2],arguments[3]);')(league,id,row,game);
const mbb=JSON.parse(fs.readFileSync('data/retro-pregame-archive-2026-27.json','utf8'));
const men=mbb.predictions.find(x=>x.id==='espn:401925717');
assert(men&&men.captured_at_utc,'sample prospective college forecast is absent');
const college={a:{code:'BCU'},h:{code:'SDSU'},raw:{header:{competitions:[{date:'2026-11-11T22:00:00Z'}]}}};
const result=run('ncaam','401925717',men,college);
assert(result,'verified men's pregame forecast must load');
assert.equal(result.home,men.home_win_probability);
assert.equal(result.margin,men.projected_home_margin);
assert.equal(run('ncaam','401925717',{...men,captured_at_utc:null},college),null,'uncaptured model must be withheld');
assert.equal(run('ncaam','401925717',{...men,captured_at_utc:'2026-11-11T23:00:00Z'},college),null,'post-tipoff capture must be withheld');
assert.equal(run('ncaam','401925717',{...men,id:'espn:123456789'},college),null,'wrong game must be withheld');
assert.equal(run('ncaam','401925717',{...men,home_win_probability:1.2},college),null,'invalid probability must be withheld');
assert.equal(run('ncaam','401925717',{...men,projected_home_margin:null},college),null,'missing projected margin must be withheld');
const nba=JSON.parse(fs.readFileSync('data/nba-rabby-forecast-ledger.json','utf8'));
const row=nba.forecasts.find(x=>x.id==='espn-nba-401909903');
assert(row,'NBA prospective forecast missing');
const nbaGame={a:{code:'BOS'},h:{code:'ORL'},raw:{header:{competitions:[{date:row.date}]}}};
const nbaResult=run('nba','401909903',row,nbaGame);
assert(nbaResult,'NBA locked pregame record must load');
assert.equal(nbaResult.home,row.home_win_prob);
assert.equal(run('nba','401909903',{...row,away:'CHI'},nbaGame),null,'team identities must reconcile');
assert.equal(run('nba','401909903',{...row,captured_at:row.date},nbaGame),null,'NBA capture must predate tipoff');
assert.match(text,/Historical pregame chances · NOT live win probability/);
assert.match(text,/forecast stays frozen after tipoff/);
assert.match(text,/\['retro','RETRO'\]/);
assert(text.includes('loadRetroArchive();'),'archive retrieval must start');
console.log('PASS: NCAA/NBA source-backed frozen pregame forecast; invalid/postgame probabilities withheld; RETRO tab');

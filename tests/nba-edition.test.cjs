
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const pages=['nba.html','nba-standings.html','nba-conference.html','nba-playoffs.html','nba-rankings.html','nba-players.html','nba-matchups.html','nba-team-desk.html'];
test('every NBA desk uses the MBB newspaper shell with persistent links and no page flipping',()=>{
 for(const file of pages){
  const h=read(file);
  assert.match(h,/mbb-newspaper\.css/,file);
  assert.match(h,/nba-newspaper\.css/,file);
  assert.match(h,/nba-newspaper\.js/,file);
  assert.match(h,/class="nba-newspaper"/,file);
  assert.match(h,/aria-label="NBA newspaper navigation"/,file);
  assert.doesNotMatch(h,/nba-page-turner|edition-page-turner|data-turn="prev"/,file);
  for(const link of ['nba.html','nba-standings.html','nba-playoffs.html','nba-rankings.html','nba-players.html','nba-matchups.html','nba-game-center.html'])assert.match(h,new RegExp('href="'+link.replace('.','\\.')+'"'),file);
 }
});
test('all new NBA navigation destinations resolve locally',()=>{
 const h=read('nba.html'),m=[...h.matchAll(/<a href="([^"]+)"/g)].map(x=>x[1]);
 for(const href of m)if(!/^(?:https?:|#)/.test(href))assert.ok(fs.existsSync(path.join(root,href.split(/[?#]/)[0])),'Missing NBA navigation '+href);
});
test('NBA editions retain the verified scores, news, players, Elo and archival data feeds',()=>{
 const s=read('nba-newspaper.js');
 for(const f of ['nba-2026-27-current-provisional.json','nba-2026-27-preseason-provisional.json','nba-2025-26-final.json','nba-game-center.json','nba-upcoming-schedule.json','nba-player-leaders.json','nba-top-stories.json'])assert.ok(s.includes(f),f);
 const elo=JSON.parse(read('data/nba-2026-27-current-provisional.json'));
 assert.equal(new Set(elo.rankings.map(x=>x.team)).size,30);
 assert.equal(elo.games_played,elo.events.length);
 assert.equal(new Set(elo.events.map(x=>x.id)).size,elo.events.length);
 const games=JSON.parse(read('data/nba-game-center.json'));
 assert.ok(games.games.length>=1);
 const leader=JSON.parse(read('data/nba-player-leaders.json'));
 assert.ok(leader.rows?.length>=5&&leader.season_totals?.length>0);
 const stories=JSON.parse(read('data/nba-top-stories.json'));
 assert.ok(stories.articles?.length>=3);
 const schedule=JSON.parse(read('data/nba-upcoming-schedule.json'));
 assert.ok(schedule.games?.length>0);
});
test('all thirty NBA franchises have team desks with searchable profiles',()=>{
 const s=read('nba-newspaper.js'),start=s.indexOf('const meta={'),end=s.indexOf('};',start);
 assert.ok(start>0&&end>start);
 const reg=/\b[A-Z]{3}:\['[^']+','(?:East|West)','[^']+','#[0-9a-f]+'\]/g;
 const count=(s.slice(start,end).match(reg)||[]).length;
 assert.equal(count,30,'expected 30 named franchises and conferences');
 assert.match(s,/params\.get\('team'\)/);
 assert.match(s,/nba-team-select/);
 assert.match(s,/function teamDesk\(/);
});
test('NBA game detail pages retain existing player box scores while joining the new edition',()=>{
 for(const f of ['nba-game-center.html','nba-live-game.html']){
  const s=read(f);assert.match(s,/nba-detail-nav\.js/);assert.match(s,/nba-newspaper\.css/);
 }
 assert.match(read('nba-game-center.html'),/nba-game-center\.js/);
 assert.match(read('nba-live-game.html'),/nba-live-game\.js/);
 assert.doesNotMatch(read('nba.html'),/nba-page-turner\.js/);
 assert.match(read('nba-newspaper.js'),/setInterval\(async/);
});
test('ratings and simulated standings are identified distinctly from official NBA tiebreakers',()=>{
 const s=read('nba-newspaper.js');
 assert.match(s,/not official NBA tiebreakers/);
 assert.match(s,/45-point home advantage/);
 assert.match(s,/Captured-game|captured box-score|Captured box-score/);
});

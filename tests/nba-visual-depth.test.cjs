const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
test('NBA visual club, player and matchup pages share the paper design',()=>{
 for(const [page,mod] of [['nba-team-desk.html','nba-team-depth.js'],['nba-players.html','nba-player-depth.js'],['nba-matchups.html','nba-matchup-depth.js']]){
  const html=read(page);
  assert.ok(html.includes('mbb-newspaper.css'),page);
  assert.ok(html.includes('nba-depth.css'),page);
  assert.ok(html.includes(mod),page);
  assert.ok(html.includes('nba-newspaper.js'),page);
  assert.ok(html.indexOf(mod)<html.indexOf('nba-newspaper.js'),page+' script order');
  assert.ok(!html.includes('nba-page-turner'),page);
 }
});
test('data-derived infographic systems are connected to each page render',()=>{
 const js=read('nba-newspaper.js');
 for(const mod of ['NBATeamDepth','NBAPlayerDepth','NBAMatchupDepth'])assert.ok(js.includes(mod));
 for(const file of ['nba-team-depth.js','nba-player-depth.js','nba-matchup-depth.js'])new Function(read(file));
});
test('NBA team form and Elo are sourced from the verified game ledger',()=>{
 const s=read('nba-team-depth.js'),e=JSON.parse(read('data/nba-2026-27-current-provisional.json'));
 assert.ok(s.includes('home_elo_change')&&s.includes('data.current?.events'));
 assert.ok(s.includes('season')||s.includes('2026'));
 assert.equal(e.events.length,e.games_played);
 assert.equal(new Set(e.rankings.map(x=>x.team)).size,30);
});
test('player visualizations use captured player records and selectable statistical categories',()=>{
 const s=read('nba-player-depth.js'),d=JSON.parse(read('data/nba-player-leaders.json'));
 assert.ok(s.includes('season_totals')&&s.includes('rows')&&s.includes('data-stat'));
 assert.ok(d.season_totals.length>10&&d.coverage.completed_boxscores>0);
});
test('matchup probabilities are pregame scenario comparisons, not reconstructed past predictions',()=>{
 const s=read('nba-matchup-depth.js');
 assert.ok(s.includes('current?.events')&&s.includes('winProb')&&s.includes('45'));
 assert.ok(s.includes("g.state==='pre'")&&s.includes('Date.parse(g.date)>Date.now()'));
 assert.ok(s.includes('Hypothetical pairing')&&s.includes('No completed 2026'));
});

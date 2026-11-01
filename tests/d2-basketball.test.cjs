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

test('sanctioned 2026 Hawaii games are present, neutral and counted exactly once',()=>{
 const source=JSON.parse(fs.readFileSync('data/d2-verified-tournaments-2026-27.json','utf8'));
 for(const gender of ['men','women']){
  const data=JSON.parse(fs.readFileSync('data/d2-'+gender+'-2026-27.json','utf8'));
  const played=data.games.filter(g=>g.id.startsWith('hih-2026-'));
  assert.equal(source[gender].length,12);
  assert.equal(played.length,12);
  assert.equal(played.filter(g=>g.status==='final').length,8);
  assert.ok(played.every(g=>g.neutral&&g.source_url===source.source_url));
  assert.ok(played.every(g=>data.teams.some(t=>t.id===g.away)&&data.teams.some(t=>t.id===g.home)));
  assert.equal(new Set(played.map(g=>g.id)).size,12);
  const hawaiiPrograms=new Set(played.filter(g=>g.status==='final').flatMap(g=>[g.away,g.home]));
  assert.equal(hawaiiPrograms.size,8);
  const finals=data.games.filter(g=>g.status==='final'&&g.elo_eligible);
  assert.equal(data.teams.reduce((sum,t)=>sum+(t.w||0),0),finals.length);
  assert.equal(data.teams.reduce((sum,t)=>sum+(t.l||0),0),finals.length);
  assert.ok(Math.abs(data.teams.reduce((s,t)=>s+t.elo,0)-1500*data.teams.length)<0.2);
 }
});
test('scorecards distinguish neutral sites and logo stylesheet contains no outside outline ring',()=>{
 const js=fs.readFileSync('d2-basketball.js','utf8');
 const css=fs.readFileSync('d2-basketball.css','utf8');
 assert.match(js,/NEUTRAL SITE/);assert.match(css,/logo-shell\.branded/);
 assert.doesNotMatch(css,/outline:\s*3px solid var\(--c2\)/);
});

test('official university tip-off results and fixture provenance retained across both papers',()=>{
 const more=JSON.parse(fs.readFileSync('data/d2-verified-other-openers-2026-27.json','utf8'));
 for(const [gender,expected] of [['men',14],['women',5]]){
  const data=JSON.parse(fs.readFileSync('data/d2-'+gender+'-2026-27.json','utf8'));
  const games=data.games.filter(g=>String(g.id).startsWith('d2opening-2026-'));
  assert.equal(more[gender].length,expected);assert.equal(games.length,expected);
  assert.ok(games.every(g=>g.verified&&g.source_url.startsWith('https://')&&g.elo_eligible));
  assert.ok(games.every(g=>data.teams.some(t=>t.id===g.away)&&data.teams.some(t=>t.id===g.home)));
  assert.equal(new Set(data.games.map(g=>g.id)).size,data.games.length);
 }
});

test('official 2026 DII opening-game source URLs match each specific result',()=>{
 const source=JSON.parse(fs.readFileSync('data/d2-verified-other-openers-2026-27.json','utf8'));
 const expected={
  'd2opening-2026-men-03':'wildcatsports.com/news/2026/10/30/mens-basketball-cwu-claims-battle-of-the-wildcats-with-season-opening-victory.aspx',
  'd2opening-2026-men-09':'wildcatsports.com/news/2026/10/31/mens-basketball-cwu-drops-hard-fought-battle-with-cal-state-san-bernardino.aspx',
  'd2opening-2026-women-05':'wwuvikings.com/sports/womens-basketball/schedule/2026-27?grid=true'
 };
 for(const gender of ['men','women']){
  const current=JSON.parse(fs.readFileSync('data/d2-'+gender+'-2026-27.json','utf8'));
  for(const game of source[gender]){
   const published=current.games.find(g=>g.id===game.id);
   assert.ok(published,'published fixture missing '+game.id);
   assert.equal(published.source_url,game.source_url,'wrong provenance '+game.id);
   if(expected[game.id])assert.ok(game.source_url.includes(expected[game.id]),'source mismatch '+game.id);
  }
 }
});

test('2026 Hawaii holiday organizer fixtures are included only for DII women',()=>{
 const source=JSON.parse(fs.readFileSync('data/d2-verified-holiday-2026-27.json','utf8'));
 const women=JSON.parse(fs.readFileSync('data/d2-women-2026-27.json','utf8'));
 const men=JSON.parse(fs.readFileSync('data/d2-men-2026-27.json','utf8'));
 const games=women.games.filter(g=>g.id.startsWith('d2holiday-2026-'));
 assert.equal(source.games.length,8);
 assert.equal(games.length,8);
 assert.ok(games.every(g=>g.status==='scheduled'&&g.verified&&g.neutral));
 assert.ok(games.every(g=>g.source_url.startsWith('https://collegetournamentshawaii.com/game/')));
 assert.ok(games.every(g=>women.teams.some(t=>t.id===g.away)&&women.teams.some(t=>t.id===g.home)));
 assert.ok(games.every(g=>g.date==='2026-12-18'||g.date==='2026-12-19'));
 assert.equal(men.games.filter(g=>g.id.startsWith('d2holiday-2026-')).length,0);
 assert.equal(new Set(women.games.map(g=>g.id)).size,women.games.length);
});
test('DII game cards show organizer sources, provisional forecast and game-day controls',()=>{
 const js=fs.readFileSync('d2-basketball.js','utf8');
 const css=fs.readFileSync('d2-basketball.css','utf8');
 assert.match(js,/OFFICIAL SOURCE/);
 assert.match(js,/PRELIMINARY ELO/);
 assert.match(js,/game-day-navigation/);
 assert.match(js,/WOMEN’S/);
 assert.match(css,/game-state\.final/);
});

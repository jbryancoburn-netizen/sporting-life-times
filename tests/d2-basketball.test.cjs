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
  // Scheduled fixtures are not verified finals: provenance is sourced, scores are pending.
  assert.ok(games.every(g=>g.source_url.startsWith('https://')&&g.elo_eligible));
  assert.ok(games.every(g=>g.status!=='final'||(g.verified===true&&Number.isFinite(g.away_score)&&Number.isFinite(g.home_score))));
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

test('DII game cards publish source-grounded provisional Elo chances and game movement',()=>{
 const script=fs.readFileSync('d2-basketball.js','utf8');
 assert.match(script,/forecast-strip/);assert.match(script,/EXPERIMENTAL/);
 const categories=['men','women'];
 for(const gender of categories){
  const d=JSON.parse(fs.readFileSync('data/d2-'+gender+'-2026-27.json','utf8'));
  const eligible=d.games.filter(g=>g.elo_eligible&&g.status!=='unverified');
  assert.ok(eligible.length>=12,'complete initial competition ledger required');
  for(const g of eligible){
   assert.ok(typeof g.pred_home_pct==='number'&&g.pred_home_pct>=0&&g.pred_home_pct<=100,g.id+' missing odds');
   assert.ok(Number.isFinite(g.pregame_elo_home)&&Number.isFinite(g.pregame_elo_away));
   if(g.status==='final'){
    assert.ok(Number.isFinite(g.elo_change_home)&&Number.isFinite(g.elo_change_away));
    assert.ok(Math.abs(g.elo_change_home+g.elo_change_away)<0.11,'Elo not zero sum '+g.id);
   }
  }
  assert.ok(d.model.status.toLowerCase().includes('provisional'),'DII coefficients must remain labeled provisional');
  assert.ok(d.games.some(g=>g.neutral&&g.status==='final'&&g.pred_home_pct!==undefined));
 }
});

test('official December holiday tournament fixtures are included in DII women only',()=>{
 const src=JSON.parse(fs.readFileSync('data/d2-verified-holiday-2026-27.json','utf8'));
 const w=JSON.parse(fs.readFileSync('data/d2-women-2026-27.json','utf8'));
 const m=JSON.parse(fs.readFileSync('data/d2-men-2026-27.json','utf8'));
 const holiday=w.games.filter(g=>g.id.startsWith('d2holiday-2026-'));
 assert.equal(src.games.length,8);assert.equal(holiday.length,8);
 assert.equal(m.games.filter(g=>g.id.startsWith('d2holiday-2026-')).length,0);
 assert.ok(holiday.every(g=>g.verified&&g.elo_eligible&&g.neutral));
 assert.ok(holiday.every(g=>g.status==='scheduled'&&g.away_score===null&&g.home_score===null));
 assert.ok(holiday.every(g=>g.date==='2026-12-18'||g.date==='2026-12-19'));
 assert.ok(holiday.every(g=>g.source_url.startsWith('https://collegetournamentshawaii.com/game/')));
 assert.ok(holiday.every(g=>w.teams.some(t=>t.id===g.away)&&w.teams.some(t=>t.id===g.home)));
 assert.equal(new Set(w.games.map(g=>g.id)).size,w.games.length);
});
test('DII newspaper provides date navigation, winner markings and exact official sources',()=>{
 const js=fs.readFileSync('d2-basketball.js','utf8');
 const css=fs.readFileSync('d2-basketball.css','utf8');
 assert.match(js,/game-day-navigation/);assert.match(js,/OFFICIAL SOURCE/);
 assert.match(js,/winA\?'winner'/);assert.match(js,/WOMEN’S/);
 assert.match(css,/game-day-navigation/);assert.match(js,/forecast-strip/);
});

test('DII membership and color provenance are labeled honestly',()=>{
 const official=JSON.parse(fs.readFileSync('data/d2-membership-notes-2026-27.json','utf8'));
 const men=JSON.parse(fs.readFileSync('data/d2-men-2026-27.json','utf8'));
 const women=JSON.parse(fs.readFileSync('data/d2-women-2026-27.json','utf8'));
 assert.equal(men.teams.filter(t=>t.not_eligible_for_dii_elo).length,4);
 assert.equal(women.teams.filter(t=>t.not_eligible_for_dii_elo).length,0);
 const m=new Map(men.teams.map(t=>[t.id,t]));
 for(const [id,n] of Object.entries(official.men)){
  assert.equal(m.get(id).membership_status,n.status);
  assert.equal(m.get(id).not_eligible_for_dii_elo,n.not_eligible_for_dii_elo);
 }
 const js=fs.readFileSync('d2-basketball.js','utf8');
 assert.match(js,/memberBadge/);
 assert.match(js,/tonal accent/);
 for(const d of [men,women])for(const t of d.teams){
   if(t.primary)assert.match(t.primary,/^#[0-9a-f]{6}$/i);
   if(t.secondary)assert.match(t.secondary,/^#[0-9a-f]{6}$/i);
 }
});

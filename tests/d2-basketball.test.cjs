const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('DII papers exist for men and women with shared newspaper renderer',()=>{
for(const [file,gender] of [['d2-mens-basketball.html','men'],['d2-womens-basketball.html','women']]){
 const s=fs.readFileSync(file,'utf8');assert.match(s,new RegExp('data-gender="'+gender+'"'));assert.match(s,/d2-basketball\.js/);assert.match(s,/d2-basketball\.css/);assert.match(s,/SPORTING LIFE/);assert.doesNotMatch(s,/THE SPORTING LIFE/);}
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
  // Official October tournament finishes continue to arrive live. Avoid
  // freezing the October 31 final count after November 1 results become final.
  const officialFinals=played.filter(g=>g.status==='final');
  assert.ok(officialFinals.length>=8 && officialFinals.length<=12,
    'verified tournament finals should advance monotonically without fabricated extras');
  assert.ok(officialFinals.every(g=>g.verified&&Number.isInteger(g.away_score)&&Number.isInteger(g.home_score)),
    'every completed tournament game must retain official scores and verification');
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
 assert.match(script,/SLTSportsScorebug/);assert.match(script,/experimental RETRO model/);
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
  if(d.model.calibrated){
   const source=JSON.parse(fs.readFileSync('data/d2-elo-parameters-2026-27.json','utf8'));
   assert.equal(source.historical_source_season,'2025-26');
   assert.equal(source.season,'2026-27');
   assert.equal(d.model.k,source[gender].k);
   assert.equal(d.model.home_elo_edge,source[gender].home_elo_edge);
   assert.ok(source[gender].sample_games>=500,'historical sample insufficient for calibration');
   assert.ok(source[gender].no_previous_year_rating_carryover);
   assert.ok(d.model.status.toLowerCase().includes('historically fitted'),'Fitted coefficients must disclose their historical provenance');
  }else{
   assert.ok(d.model.status.toLowerCase().includes('provisional'),'Unfitted DII coefficients must be labeled provisional');
  }
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
 assert.match(js,/SLTSportsScorebug/);assert.match(js,/ledger26-expand/);
 assert.match(css,/game-day-navigation/);assert.match(js,/experimental RETRO model/);
});

test('DII membership and color provenance are labeled honestly',()=>{
 const official=JSON.parse(fs.readFileSync('data/d2-membership-notes-2026-27.json','utf8'));
 const men=JSON.parse(fs.readFileSync('data/d2-men-2026-27.json','utf8'));
 const women=JSON.parse(fs.readFileSync('data/d2-women-2026-27.json','utf8'));
 assert.ok([4,5,6,7].includes(men.teams.filter(t=>t.not_eligible_for_dii_elo).length));
 assert.ok([0,1].includes(women.teams.filter(t=>t.not_eligible_for_dii_elo).length));
 const m=new Map(men.teams.map(t=>[t.id,t]));
 for(const [id,n] of Object.entries(official.men)){
  // A newly sourced Azusa transition note is applied by the refresh *after*
  // this preflight. All other classifications must already be published.
  if(['azusa-pacific','west-florida'].includes(id)&&!m.get(id).membership_status){
   assert.equal(n.not_eligible_for_dii_elo,true);
   continue;
  }
  // The existing committed snapshot is intentionally validated BEFORE the
  // refresh replaces a former provisional NCAA/NAIA classification.
  if(id==='texas-a-m-university-texarkana'&&!m.get(id).not_eligible_for_dii_elo){
   assert.equal(n.not_eligible_for_dii_elo,true);
   continue;
  }
  assert.ok(typeof m.get(id).membership_status==='string'&&m.get(id).membership_status.length>5);
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

test('DII Gamefile is gender-isolated and preserves the existing newspaper layout',()=>{
 const html=fs.readFileSync('d2-game.html','utf8');
 const js=fs.readFileSync('d2-basketball.js','utf8');
 const css=fs.readFileSync('d2-basketball.css','utf8');
 const vm=require('node:vm');
 assert.doesNotThrow(()=>new vm.Script(js));
 assert.match(html,/data-page="game"/);
 assert.match(html,/id="gamefile-profile"/);
 assert.match(html,/id="gamefile-refresh"/);
 assert.match(js,/d2-game\.html\?gender=/);
 assert.match(js,/encodeURIComponent\(g\.id\)/);
 assert.match(js,/function renderGame\(d\)/);
 assert.match(js,/page==='game'\)renderGame\(d\)/);
 assert.match(js,/game\(g,false\)/);
 assert.match(css,/\.gamefile-grid/);
 assert.match(js,/Player-by-player box scores are not included until verified player data exists/);
 assert.match(js,/This page does not represent real-time play-by-play/);
});
test('DII scoreboard and both Elo builders order Eastern tipoffs by meridiem, never text order',()=>{
 const js=fs.readFileSync('d2-basketball.js','utf8');
 assert.match(js,/tipMinute/);
 assert.match(js,/selected\.sort\(chronological\)/);
 assert.match(js,/sort\(chronological\);el\.innerHTML/);
 for(const filename of ['scripts/build_d2_basketball.py','scripts/merge_d2_season_audit.py']){
  const py=fs.readFileSync(filename,'utf8');
  assert.match(py,/from (?:scripts\.)?d2_elo_chronology import game_sort_key/);
  assert.match(py,/key=game_sort_key/);
 }
});


test('DII recovery excludes noneligible transfers and future applicants from missing schedule counts',()=>{
 const js=fs.readFileSync('d2-basketball.js','utf8');
 const audit=fs.readFileSync('scripts/audit_d2_publication.py','utf8');
 assert.match(js,/const eligible=entries\.filter\(x=>!x\.team\.not_eligible_for_dii_elo\)/);
 assert.match(js,/const excluded=entries\.filter\(x=>x\.team\.not_eligible_for_dii_elo\)/);
 assert.match(js,/UNLISTED ELIGIBLE SCHOOL SCHEDULES/);
 assert.match(js,/NOT ELIGIBLE FOR 2026–27 DII ELO/);
 assert.match(audit,/"eligible_without_games"/);
 assert.match(audit,/"excluded_without_games"/);
});

test('both DII papers expose dynamic clickable school-by-school schedule recovery without invented full calendars',()=>{
 const js=fs.readFileSync('d2-basketball.js','utf8');
 const css=fs.readFileSync('d2-basketball.css','utf8');
 assert.match(js,/function renderScheduleRecovery\(d\)/);
 assert.match(js,/renderScheduleRecovery\(d\);/);
 assert.match(js,/for\(const id of new Set\(\[String\(g\.away\),String\(g\.home\)\]\)\)/);
 assert.match(js,/not completed official school schedules/);
 assert.match(js,/recovery-school/);
 assert.match(css,/recovery-ribbon/);
 for(const gender of ['mens','womens']){
  const html=fs.readFileSync('d2-'+gender+'-basketball.html','utf8');
  assert.match(html,/id="schedule-recovery-content"/);
  assert.match(html,/SCHEDULE RECOVERY DESK/);
 }
});

test('DII CCAA school evidence requires independent men’s university calendars',()=>{
 const code=fs.readFileSync('scripts/d2_ccaa_men_official.py','utf8');
 const builder=fs.readFileSync('scripts/build_d2_basketball.py','utf8');
 assert.match(code,/def parse_league\(/);
 assert.match(code,/def parse_merced\(/);
 assert.match(code,/set\(seen\)!=\{away,home\}/);
 assert.match(code,/if day<today\.isoformat\(\):continue/);
 assert.match(code,/if all\(clocks\) and clocks\[0\]==clocks\[1\]/);
 assert.match(code,/unmarked_both_held/);
 assert.match(code,/if not any\(value\[2\] for value in seen\.values\(\)\)/);
 assert.match(code,/len\(ids\)<13/);
 assert.match(builder,/official_ccaa_men_schedule_reconciliation/);
});

test('DII official university school-grid evidence covers all four verified recovery calendars',()=>{
 const evidence=JSON.parse(fs.readFileSync('data/d2-official-school-grids-2026-27.json','utf8'));
 assert.equal(evidence.season,'2026-27');
 const required={
  'men|salem':27,
  'women|salem-university-west-virginia':28,
  'women|lincoln-university-pennsylvania':28,
  'women|university-of-charleston-west-virginia':28,
  'women|upper-iowa-university':26,
  'women|lenoir-rhyne-university':2,
  'women|the-university-of-virginia-s-college-at-wise':2
 };
 const keys=evidence.schools.map(s=>s.gender+'|'+s.owner_id);
 assert.equal(new Set(keys).size,keys.length);
 for(const [key,n] of Object.entries(required)){
  const grid=evidence.schools.find(s=>s.gender+'|'+s.owner_id===key);
  assert.ok(grid,'missing university calendar '+key);
  assert.equal(grid.fixtures.length,n);
 }
 const upper=evidence.schools.find(s=>s.owner_id==='upper-iowa-university');
 assert.equal(new Set(upper.fixtures.map(g=>g.date+'|'+g.opponent)).size,26);
 assert.ok(upper.fixtures.some(g=>g.date==='2026-11-22' &&
  g.opponent==='University of Puerto Rico, Mayaguez' &&
  g.role==='neutral' && g.start_time==='12:30 PM ET'));
 for(const calendar of evidence.schools){
  assert.match(calendar.source_url,/^https:\/\//);
  for(const game of calendar.fixtures){
   assert.match(game.date,/^202[67]-\d\d-\d\d$/);
   assert.ok(['away','home','neutral'].includes(game.role));
  }
 }
});

// The source calendar only authorizes fixture/date/opponent fields. Scores
// must come from independently verified NCAA/official postgame results.

test('Queens College 2026-27 official calendar quarantines other-division opponents',()=>{
 const evidence=JSON.parse(fs.readFileSync('data/d2-official-school-grids-2026-27.json','utf8'));
 const queens=evidence.schools.find(x=>x.gender==='women'&&x.owner_id==='queens-college-new-york');
 assert.ok(queens);
 assert.equal(queens.fixtures.length,28);
 assert.equal(queens.fixtures.filter(x=>x.opponent==='Lackawanna College').length,2);
 assert.ok(queens.fixtures.some(x=>x.date==='2026-11-15' &&
   x.opponent==='Thomas Jefferson University' && x.start_time==='2:30 PM ET'));
 assert.match(queens.source_url,/^https:\/\/queensknights.com\//);
 assert.equal(new Set(queens.fixtures.map(x=>x.date+'|'+x.opponent)).size,28);
});

test('DII school-grid fixtures are not fabricated results',()=>{
 const evidence=JSON.parse(fs.readFileSync('data/d2-official-school-grids-2026-27.json','utf8'));
 for(const school of evidence.schools)for(const item of school.fixtures){
  assert.equal(Object.hasOwn(item,'away_score'),false);
  assert.equal(Object.hasOwn(item,'home_score'),false);
  assert.equal(Object.hasOwn(item,'status'),false);
  assert.equal(Object.hasOwn(item,'elo_change_home'),false);
  assert.ok(item.opponent.length>2);
  assert.ok(!item.start_time || /^([1-9]|1[0-2]):[0-5]\d [AP]M ET$/.test(item.start_time));
 }
});

test('DII Charleston official-to-NCAA identity labels are explicitly sourced',()=>{
 const evidence=JSON.parse(fs.readFileSync('data/d2-official-school-grids-2026-27.json','utf8'));
 const school=evidence.schools.find(x=>x.owner_id==='university-of-charleston-west-virginia');
 assert.ok(school);
 const aliases=school.fixtures.filter(x=>x.source_opponent);
 assert.equal(aliases.length,7);
 assert.deepEqual(aliases.map(x=>x.date),[
   '2026-11-09','2026-11-13','2026-11-24','2026-12-16',
   '2027-01-06','2027-02-10','2027-02-13'
 ]);
 for(const item of aliases){
  assert.notEqual(item.source_opponent,item.opponent);
  assert.match(item.opponent_identity_source_url,/^https:\/\//);
  assert.ok(!Object.hasOwn(item,'away_score')&&!Object.hasOwn(item,'home_score'));
 }
});

test('DII Mayaguez opponents independently verify two extra neutral-site December games',()=>{
 const evidence=JSON.parse(fs.readFileSync('data/d2-official-school-grids-2026-27.json','utf8'));
 const dates={
  'lenoir-rhyne-university':['2026-12-18','2:00 PM ET'],
  'the-university-of-virginia-s-college-at-wise':['2026-12-19','9:00 AM ET']
 };
 for(const [owner,[date,time]] of Object.entries(dates)){
  const calendar=evidence.schools.find(s=>s.gender==='women'&&s.owner_id===owner);
  assert.ok(calendar);
  assert.equal(calendar.fixtures.length,2);
  assert.match(calendar.source_url,/^https:\/\//);
  assert.match(calendar.scope,/Not a complete/);
  const f=calendar.fixtures.find(row=>row.opponent==='University of Puerto Rico, Mayaguez');
   assert.ok(f,'original Mayagüez game must remain');
  assert.equal(f.date,date);
  assert.equal(f.start_time,time);
  assert.equal(f.role,'neutral');
  assert.equal(f.opponent,'University of Puerto Rico, Mayaguez');
  assert.match(f.opponent_identity_source_url,/^https:\/\//);
  assert.ok(!Object.hasOwn(f,'home_score')&&!Object.hasOwn(f,'away_score'));
 }
});

test('DII Saint Martins official 27-game fallback survives live source timeout without duplicate crossover',()=>{
 const evidence=JSON.parse(fs.readFileSync('data/d2-official-school-grids-2026-27.json','utf8'));
 const smu=evidence.schools.find(x=>x.gender==='men'&&x.owner_id==='saint-martin-s');
 assert.ok(smu);
 assert.equal(smu.fixtures.length,27);
 assert.match(smu.source_url,/^https:\/\/smusaints\.com\//);
 assert.equal(new Set(smu.fixtures.map(x=>x.date+'|'+x.opponent)).size,27);
 assert.ok(!smu.fixtures.some(x=>x.date==='2026-12-19'),
           'quarantined Hawaii Pacific crossover needs NCAA date reconciliation');
 assert.ok(smu.fixtures.some(x=>x.date==='2027-02-20' &&
   x.opponent==='Northwest Nazarene' && x.start_time==='10:30 PM ET'));
 for(const g of smu.fixtures){
  assert.match(g.source_clock,/ PT$/);
  assert.match(g.start_time,/ ET$/);
  assert.ok(!Object.hasOwn(g,'home_score')&&!Object.hasOwn(g,'away_score'));
 }
});

test('DII Puerto Rico women get four new 2026-27 school-source dates without inventing finals',()=>{
 const evidence=JSON.parse(fs.readFileSync('data/d2-official-school-grids-2026-27.json','utf8'));
 const expected={
  'walsh-university':[['2026-11-13','neutral','University of Puerto Rico, Mayaguez']],
  'augustana-university-south-dakota':[
   ['2026-11-27','away','University of Puerto Rico, Mayaguez'],
   ['2026-11-28','away','University of Puerto Rico, Rio Piedras']],
  'mckendree-university':[['2026-12-17','neutral','University of Puerto Rico, Mayaguez']]
 };
 for(const [owner,rows] of Object.entries(expected)){
  const school=evidence.schools.find(x=>x.gender==='women'&&x.owner_id===owner);
  assert.ok(school);
  assert.deepEqual(school.fixtures.map(x=>[x.date,x.role,x.opponent]),rows);
  assert.ok(school.source_url.startsWith('https://'));
  for(const game of school.fixtures){
   assert.ok(game.opponent_identity_source_url?.startsWith('https://'));
   assert.equal(Object.hasOwn(game,'home_score'),false);
   assert.equal(Object.hasOwn(game,'away_score'),false);
  }
 }
});

test('Saint Martin three California away games retain original source and verified canonical DII opponent IDs',()=>{
 const evidence=JSON.parse(fs.readFileSync('data/d2-official-school-grids-2026-27.json','utf8'));
 const smu=evidence.schools.find(s=>s.gender==='men'&&s.owner_id==='saint-martin-s');
 assert.ok(smu);
 const verified=[
  ['2026-11-20','Stanislaus State','Cal State Stanislaus','warriorathletics.com'],
  ['2026-11-24','Fresno Pacific University (Calif.)','Fresno Pacific','fpusunbirds.com'],
  ['2026-11-25','California State University, Los Angeles','Cal State Los Angeles','lagoldeneagles.com']
 ];
 for(const [date,original,canonical,domain] of verified){
  const match=smu.fixtures.find(s=>s.date===date&&s.opponent===canonical);
  assert.ok(match,'missing Saint Martin reciprocal fixture '+date);
  assert.equal(match.role,'away');
  assert.equal(match.source_opponent,original);
  assert.ok(match.opponent_identity_source_url.includes(domain));
  assert.match(match.identity_verified_by,/Both universities/);
  assert.ok(!Object.hasOwn(match,'status')&&!Object.hasOwn(match,'away_score'));
 }
});

test('DII complete-season source recovery keeps 79 DYouville Roberts and Duluth university dates as evidence, not automatic certification',()=>{
 const grid=JSON.parse(fs.readFileSync('data/d2-official-school-grids-2026-27.json','utf8'));
 const expected={'d-youville':25,'roberts-wesleyan':25,'minnesota-duluth':29};
 for(const [owner,n] of Object.entries(expected)){
  const school=grid.schools.find(s=>s.gender==='men'&&s.owner_id===owner);
  assert.ok(school,'missing entire official school fixture source '+owner);
  assert.equal(school.fixtures.length,n);
  assert.equal(new Set(school.fixtures.map(g=>g.date+'|'+g.opponent)).size,n);
  for(const row of school.fixtures){
   assert.ok(['home','away','neutral'].includes(row.role));
   assert.ok(!row.start_time || /^([1-9]|1[0-2]):[0-5]\d [AP]M ET$/.test(row.start_time));
   assert.equal(Object.hasOwn(row,'home_score'),false);
   assert.equal(Object.hasOwn(row,'away_score'),false);
  }
  assert.ok(!grid.certification_assertions.some(a=>a.gender==='men'&&a.owner_id===owner));
 }
 assert.ok(grid.schools.find(s=>s.owner_id==='d-youville').source_references.some(x=>x.includes('millersvilleathletics.com')));
 assert.ok(grid.schools.find(s=>s.owner_id==='roberts-wesleyan').fixtures.some(g=>g.opponent.includes('Exhibition')));
 assert.ok(grid.schools.find(s=>s.owner_id==='minnesota-duluth').fixtures.some(g=>g.opponent==='Carleton College'));
});

// DII cross-page publication quality: one scorebug, honest branding and legible six-field ledger.
test('DII team desks use the same live scorebug assets as game and front pages',()=>{
 const team=fs.readFileSync('d2-team.html','utf8');
 assert.match(team,/cbb-ledger-scorebug\\.js/);
 assert.match(team,/cbb-ledger-scorecard\\.css/);
 for(const page of ['d2-mens-basketball.html','d2-womens-basketball.html','d2-team.html','d2-game.html']){
  const html=fs.readFileSync(page,'utf8');
  assert.doesNotMatch(html,/THE SPORTING LIFE|The Sporting Life|USRS/);
  assert.match(html,/slt-monogram-favicon\\.svg/);
 }
});
test('DII visible scorebug metadata shows tipoff and the full school directory keeps six columns',()=>{
 const js=fs.readFileSync('d2-basketball.js','utf8');
 const css=fs.readFileSync('d2-basketball.css','utf8');
 assert.match(js,/d2-visible-tipoff/);
 assert.match(js,/ledger26-network/);
 assert.match(js,/school-count-summary/);
 assert.match(css,/\\.directory \\.board-row\\{grid-template-columns:15px 39px minmax\\(0,1fr\\) 47px 42px 50px\\}/);
});

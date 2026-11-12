#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const dir=JSON.parse(fs.readFileSync('data/college-soccer-conferences.json','utf8'));
const feed=JSON.parse(fs.readFileSync('data/college-soccer-conference-tournament-results-2026.json','utf8'));
const render=fs.readFileSync('college-soccer-conference-page.js','utf8');
const rules=JSON.parse(fs.readFileSync('data/college-soccer-postseason-rules.json','utf8'));
assert.equal(feed.season,2026);assert.equal(feed.scope,'men-d1');
assert(render.includes("recentScores.length"),"Actual-score-first guard removed");
assert(render.includes("tournamentSeedByTeam"),"Verified conference tournament seed map missing");
assert(render.includes("'cs-tournament-seed'"),"Seed chips must appear next to every confirmed bracket school");
assert(render.includes("ACTUAL NCAA RESULTS · OFFICIAL BRACKET PENDING"),"Missing real result heading");
assert(render.includes("m.source_url"),"No NCAA game evidence links");
assert(render.includes("Recent games have FINAL scores. RETRO bracket/title predictions are withheld"),"No safeguard against stale playoff forecasts");
for(const [id,c] of Object.entries(dir.conferences)){
 const page=fs.readFileSync(c.page,'utf8');
 assert(page.includes('college-soccer-conference-page.js?v=20261112-seeded-brackets'),id+' missing refreshed seed-label renderer');
 assert(page.includes('college-soccer-conference-page.css?v=20261112-seeded-brackets'),id+' missing refreshed seed-label styling');
}
const keys=Object.keys(dir.conferences).filter(k=>k.startsWith('men-d1:'));
assert.equal(keys.length,23);assert.equal(Object.keys(feed.conferences).length,23);
let total=0,withMatches=0,official=0;
for(const key of keys){
 const c=dir.conferences[key],source=feed.conferences[key];
 assert(source,key+' missing recent real-results section');
 assert.equal(source.page,c.page);
 assert.equal(source.classification,'ncaa_verified_intra_conference_finals_round_unverified');
 assert.equal(source.round_certified,false);
 assert(Array.isArray(source.games));
 assert(Number.isInteger(source.total_verified_window_games));
 assert(source.total_verified_window_games>=source.games.length);
 const page=fs.readFileSync(c.page,'utf8');
 assert(page.includes('college-soccer-conference-page.js?v=20261112-seeded-brackets'),key+' stale browser JS cache');
 assert(page.includes('college-soccer-conference-page.css?v=20261112-seeded-brackets'),key+' stale browser CSS cache');
 const members=new Set(c.teams);
 const seen=new Set();
 for(const m of source.games){
  assert(!seen.has(m.match_id),key+' duplicate game '+m.match_id);
  seen.add(m.match_id);
  assert(members.has(m.home_id)&&members.has(m.away_id)&&m.home_id!==m.away_id,key+' crosses conference/invalid teams');
  assert.equal(m.status,'final');
  assert(Number.isInteger(m.home_score)&&Number.isInteger(m.away_score));
  assert.match(m.source_url,/^https:\/\/www\.ncaa\.com\/game\/\d+$/);
  assert.equal(m.round_certified,false,'NCAA score alone cannot certify tournament round');
  assert.equal(m.tournament_game_certified,false,'Do not call normal games certified tournament games');
  assert.equal(m.winner_id,m.home_score===m.away_score?null:(m.home_score>m.away_score?m.home_id:m.away_id),'Winner inconsistent with final');
 }
 total+=source.games.length;if(source.games.length)withMatches++;
 const table=JSON.parse(fs.readFileSync(c.standings_feed,'utf8'));
 const b=table.tournament_bracket;
 if(b?.status==='official'){
  official++;assert(b.source_url.startsWith('https://'),key+' missing conference bracket citation');
  const seeds=table.tournament_seeds;
  assert(Array.isArray(seeds)&&seeds.length>=4,key+' official tournament seed list missing');
  assert.equal(new Set(seeds).size,seeds.length,key+' duplicated tournament seed');
  assert(seeds.every(team=>members.has(team)),key+' seeded school outside conference');
  for(const match of b.matches)for(const id of [match.home_id,match.away_id]){
    if(id!==null&&id!==undefined)assert(seeds.includes(id),key+' tournament game includes non-seeded school '+id);
  }
  if(key==='men-d1:caa'){
    assert.equal(table.tournament_seed_labels['stony-brook'],'N#1');
    assert.equal(table.tournament_seed_labels['unc-wilmington'],'S#1');
    assert.equal(table.tournament_seed_labels['hofstra'],'N#2');
    assert.equal(table.tournament_seed_labels['col-of-charleston'],'S#3');
  }
  assert(b.matches.length>=3,key+' missing verified fixtures');
  for(const m of b.matches){
   assert((m.home_id===null||members.has(m.home_id))&&(m.away_id===null||members.has(m.away_id)),key+' unknown official tournament participant');
   if(m.home_id===null||m.away_id===null){
    assert.equal(m.status,'scheduled',key+' cannot decide an unnamed championship game');
    assert(m.home_from&&m.away_from,key+' has ungrounded TBD championship slots');
    assert(b.matches.some(x=>x.id===m.home_from)&&b.matches.some(x=>x.id===m.away_from),key+' placeholder refers to absent semifinal');
   }
   if(m.status==='final'){
    assert(Number.isInteger(m.home_score)&&Number.isInteger(m.away_score));
    assert(m.winner_id===m.home_id||m.winner_id===m.away_id);
    if(m.home_score===m.away_score)assert.equal(m.decision,'penalties','Tied knockout requires verified penalty result');
    else assert.equal(m.winner_id,m.home_score>m.away_score?m.home_id:m.away_id);
   }
  }
 }
 assert(rules.conferences[key],key+' missing championship schedule');
}
assert(withMatches>=15,'Expected post-season period results from at least 15 conferences');
assert.equal(official,23,'Official tournament seeds/brackets must cover all 23 men’s Division I conferences');
console.log('PASS: '+withMatches+'/23 conference pages display actual NCAA scores, '+total+' sourced games; ALL '+official+' conferences have source-backed tournament seeds and brackets; no fabricated advancement');

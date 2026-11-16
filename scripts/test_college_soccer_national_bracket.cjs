#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {makeBracket}=require('../college-soccer-national-bracket.js');
const {match}=require('../college-soccer-retro-knockout.js');
const data=JSON.parse(fs.readFileSync('data/college-soccer-ncaa-selection-forecast.json','utf8'));
const result=makeBracket(data.field,match);
assert.equal(result.matchCount,47,'48-team single-elimination competition has 47 match slots');
assert.equal(result.regions.length,4);
assert.equal(result.semifinals.length,2);
assert(result.provisional,'Must never mislabel hypothetical NCAA matchups as official');
const opening=result.regions.flatMap(r=>r.first.flatMap(m=>[m.home,m.away]));
const byes=result.regions.flatMap(r=>r.second.map(m=>m.home));
assert.equal(opening.length,32);
assert.equal(byes.length,16);
const used=opening.concat(byes).map(t=>t.team_id);
assert.equal(new Set(used).size,48,'All 48 entrants must occupy exactly one first or second round slot');
const top16=new Set(data.field.slice(0,16).map(t=>t.team_id));
assert.deepEqual(new Set(byes.map(t=>t.team_id)),top16,'Only top 16 independent strength-order entrants have byes');
const protectedEight=new Set(data.field.slice(16,24).map(t=>t.team_id));
assert.equal(opening.filter(t=>protectedEight.has(t.team_id)).length,8);
for(const region of result.regions){
 const quadrantSeeds=region.seeded.map(team=>team.quadrant_seed).sort((a,b)=>a-b);
 assert.deepEqual(quadrantSeeds,[1,2,3,4,5,6],'Every quadrant must independently use seeds 1–6');
 assert.equal(region.anchor.quadrant_seed,1,'Quadrant anchor must be the local #1 seed');
 assert.equal(region.seeded.filter(team=>team.forecast_rank<=16).length,4,'Four seeded entrants receive byes');
 assert.equal(region.seeded.filter(team=>team.forecast_rank>16).length,2,'Two seeded entrants play in first round');
 assert(region.seeded.every(team=>team.quadrant_number===region.number),'Quadrant seed must identify its own quadrant');
 assert.equal(region.first.length,4);
 assert.equal(region.second.length,4);
 assert.equal(region.third.length,2);
 assert.equal(region.quarter.stage,'QUARTERFINAL');
 assert.equal(region.first.flatMap(m=>[m.home,m.away]).filter(t=>protectedEight.has(t.team_id)).length,2,
  'Seeds 17-24 must be evenly distributed, two per region');
 for(let i=0;i<4;i++){
  const first=region.first[i],second=region.second[i];
  assert.notEqual(first.home.conference,first.away.conference,'R1 same-conference draw');
  assert.notEqual(second.home.conference,first.home.conference,'Bye seed shares conference with first R1 entrant');
  assert.notEqual(second.home.conference,first.away.conference,'Bye seed shares conference with second R1 entrant');
  assert.equal(second.away.team_id,first.winner.team_id,'R2 must consume R1 winner from same bracket slot');
 }
}
const games=result.regions.flatMap(r=>[...r.first,...r.second,...r.third,r.quarter]).concat(result.semifinals,result.championship);
assert.equal(games.length,47);
assert.equal(new Set(games.map(m=>m.id)).size,47,'Every matchup requires a unique ID');
for(const game of games){
 assert(game.home&&game.away,'RETRO simulation should complete every matchup with live valid ratings');
 assert(game.winner===game.home||game.winner===game.away,'Predicted winner must participate in that matchup');
 assert(game.probabilityHome>=0&&game.probabilityHome<=1);
 assert(Number.isFinite(game.expectedGoals.home)&&Number.isFinite(game.expectedGoals.away));
}
assert.equal(result.semifinals[0].home.team_id,result.regions[0].quarter.winner.team_id);
assert.equal(result.semifinals[0].away.team_id,result.regions[1].quarter.winner.team_id);
assert.equal(result.semifinals[1].home.team_id,result.regions[2].quarter.winner.team_id);
assert.equal(result.semifinals[1].away.team_id,result.regions[3].quarter.winner.team_id);
const unknown=makeBracket(data.field,null);
assert(unknown.regions.every(r=>r.first.every(m=>!m.winner&&!m.probabilityHome)),
 'Missing RPI matchup predictor must NOT fabricate RETRO winners');
assert(unknown.regions.every(r=>r.second.every(m=>!m.away)),
 'RPI snapshot must show an unresolved first-round winner');
const duplicate=data.field.map(t=>({...t}));duplicate[47].team_id=duplicate[0].team_id;
assert.throws(()=>makeBracket(duplicate,match),/Duplicate/);
const oneConference=data.field.map((t,i)=>({...t,conference:'men-d1:identical'}));
assert.throws(()=>makeBracket(oneConference,match),/Cannot place/);
assert(result.field.filter(team=>Number.isInteger(team.quadrant_seed)).length===24,
 'Exactly 24 entrants must have quadrant-local seeds');
assert(result.field.every(team=>team.forecast_rank<=24||team.quadrant_seed===undefined),
 'Unseeded entrants must not show quadrant seed badges');
const html=fs.readFileSync('college-soccer-selection.html','utf8');
const source=fs.readFileSync('college-soccer-selection.js','utf8');
const bracketSource=fs.readFileSync('college-soccer-national-bracket.js','utf8');
const style=fs.readFileSync('college-soccer-national-bracket.css','utf8');
assert(html.includes('college-soccer-national-bracket.js?v=')&&html.includes('college-soccer-national-bracket.css?v='),
 'New bracket assets must load on public selection page');
assert(source.includes('national.render(bracketMount,entries,branding'),
 'Selection publisher must render new bracket');
assert(source.includes("metrics?.status==='final_preselection_rpi_led_ncaa_criteria_projection_not_official'"),
 'NCAA forecast must be sourced from the final independent Nov 14 RPI projection');
assert(source.includes("metrics?.independent_of_retro===true"),
 'RPI-led NCAA model must be independent of RETRO Elo forecasts');
assert(source.includes("metrics.field.filter(x=>x.bid_type==='rpi_at_large_projection').length===25"),
 'Model must contain exactly 25 screened NCAA at-large candidate selections');
assert(source.includes("mode==='ncaa'&&!ncaaInputsReady"),
 'NCAA page must block unsupported committee selections when source data is missing');
assert(!source.includes('RETRO SELECTION COMMITTEE'),
 'RETRO is not an NCAA selection criterion');
const oldRpi=JSON.parse(fs.readFileSync('data/college-soccer-ncaa-rpi-forecast-2026.json','utf8'));
assert(oldRpi.ranking_as_of<data.rating_cutoff,'Stored RPI snapshot must be treated as stale');
const rebuild=fs.readFileSync('scripts/rebuild_soccer_daily_selection.py','utf8');
assert(rebuild.includes('NCAA requires >= .500 Division I records'),
 'Daily builder must retain NCAA at-large eligibility warning');
assert(rebuild.includes('24 seeded teams in 2026 under NCAA Oct 22 amendment'),
 'Daily builder must retain NCAA amended 2026 seeding rule');
assert(bracketSource.includes("window.CollegeSoccerCupUI.crest(team.team,team.team_id,'men-d1',branding)"),
 'All bracket teams must use the existing shared authentic 2-ring logo component');
assert(style.includes('.snb-region-scroll')&&style.includes('overflow:visible!important')&&style.includes('snb-mobile-round-tabs'),
 'Desktop must display all rounds, mobile uses explicit round tabs with no horizontal scroll');
assert(style.includes('.snb-region-tab[aria-selected="true"]'),
 'Regional selector must expose selected state');
console.log('PASS: 47 real matchup slots; 16 byes; 8 protected R1 programs balanced 2/region; no early same-conference games; 4 regions feed College Cup; neutral probability and no invented official results; native crests and mobile.');

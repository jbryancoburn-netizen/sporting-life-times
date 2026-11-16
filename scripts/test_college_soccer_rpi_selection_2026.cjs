'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {makeBracket}=require('../college-soccer-national-bracket.js');
const {match}=require('../college-soccer-retro-knockout.js');
const rpi=JSON.parse(fs.readFileSync('data/college-soccer-ncaa-rpi-nov14-2026.json'));
const aq=JSON.parse(fs.readFileSync('data/college-soccer-ncaa-automatic-bids-2026.json'));
const ncaa=JSON.parse(fs.readFileSync('data/college-soccer-ncaa-selection-projection-2026.json'));
const retro=JSON.parse(fs.readFileSync('data/college-soccer-ncaa-selection-forecast.json'));
assert.equal(ncaa.status,'final_preselection_rpi_led_ncaa_criteria_projection_not_official');
assert.equal(ncaa.rpi_as_of,'2026-11-14');
assert.equal(ncaa.independent_of_retro,true);
assert.equal(aq.bids.length,23);
assert.equal(ncaa.field.length,48);
assert.equal(new Set(ncaa.field.map(x=>x.team_id)).size,48);
assert.equal(ncaa.field.filter(x=>x.bid_type==='official_aq').length,23);
assert.equal(ncaa.field.filter(x=>x.bid_type==='rpi_at_large_projection').length,25);
assert.equal(ncaa.field.filter(x=>x.projected_seed!==null).length,24);
assert.equal(ncaa.field.filter(x=>x.projected_bye===true).length,16);
const ranks=new Map(rpi.rows.map(x=>[x.team_id,x]));
assert.equal(new Set(rpi.rows.map(x=>x.rpi_rank)).size,rpi.rows.length);
for(const t of ncaa.field){
 const row=ranks.get(t.team_id);
 assert(row,'No public RPI ranking for '+t.team_id);
 assert.equal(t.rpi_rank,row.rpi_rank);
 assert.equal(t.di_record,[row.di_wins,row.di_losses,row.di_ties].join('-'));
 assert.equal(t.ncaa_seed,null,'Official NCAA seeds cannot be invented');
 if(t.bid_type==='rpi_at_large_projection'){
   assert(row.at_large_di_record_eligible,'Ineligible team selected at-large: '+t.team_id);
   assert(2*row.di_wins+row.di_ties>=row.di_wins+row.di_losses+row.di_ties);
 }
}
for(const winner of aq.bids){
 const champion=winner.championship_result;
 assert(winner.official_aq===true&&winner.team_id===champion.winner_id);
 assert(/^https:\/\//.test(winner.source_url));
 assert(ncaa.field.find(x=>x.team_id===winner.team_id)?.bid_type==='official_aq');
}
const ncaaResult=makeBracket(ncaa.field,null,{mode:'ncaa'});
const retroResult=makeBracket(retro.field,match,{mode:'usrs'});
assert.equal(ncaaResult.matchCount,47);
assert.equal(retroResult.matchCount,47);
const allGames=ncaaResult.regions.flatMap(r=>r.first.concat(r.second,r.third,[r.quarter])).concat(ncaaResult.semifinals,ncaaResult.championship);
assert.equal(allGames.length,47);
const everyOpening=ncaaResult.regions.flatMap(r=>r.first.flatMap(m=>[m.home,m.away]));
const byes=ncaaResult.regions.flatMap(r=>r.second.map(m=>m.home));
assert.equal(new Set([...everyOpening,...byes].map(x=>x.team_id)).size,48);
assert.equal(byes.length,16);
assert(ncaaResult.regions.every(r=>r.first.flatMap(m=>[m.home,m.away]).filter(t=>t.forecast_rank>16&&t.forecast_rank<=24).length===2));
for(const region of ncaaResult.regions)for(let i=0;i<4;i++){
 const first=region.first[i],second=region.second[i];
 assert.notEqual(first.home.conference,first.away.conference,'First round conference match');
 assert.notEqual(first.home.conference,second.home.conference,'Opening opponent would share conference');
 assert.notEqual(first.away.conference,second.home.conference,'Opening opponent would share conference');
}
for(const m of allGames){
 assert(m.home&&m.away&&m.winner);
 assert.equal(m.probabilityHome,null,'RPI model must NOT use RETRO match probabilities');
 assert.equal(m.expectedGoals,null,'RPI model must NOT generate RETRO expected goals');
 assert.equal(m.winner.rpi_rank,Math.min(m.home.rpi_rank,m.away.rpi_rank));
}
assert.equal(ncaaResult.championship.winner.rpi_rank,1,'RPI-led pure advancement must honor rank 1');
const ncaaOnly=ncaa.field.filter(x=>!retro.field.some(z=>z.team_id===x.team_id));
const retroOnly=retro.field.filter(x=>!ncaa.field.some(z=>z.team_id===x.team_id));
assert.equal(ncaaOnly.length,retroOnly.length);
assert(ncaaOnly.length>0,'Independent models unexpectedly identical');
const css=fs.readFileSync('college-soccer-national-bracket.css','utf8');
const js=fs.readFileSync('college-soccer-national-bracket.js','utf8');
const selection=fs.readFileSync('college-soccer-selection.js','utf8');
const html=fs.readFileSync('college-soccer-selection.html','utf8');
assert(css.includes('min-width:0!important')&&css.includes('.snb-region-stage[data-mobile-round="first"]'),
 'Bracket must fit all desktop rounds and use round tabs instead of mobile horizontal scrolling');
assert(css.includes('overflow:visible!important'),'Cannot restore horizontal scroll');
assert(js.includes("ncaa=options.mode==='ncaa'"),'No separate NCAA model branch');
assert(js.includes("winner=a.rpi_rank<b.rpi_rank?a:b"),'NCAA winner must use sourced RPI and nothing from RETRO');
assert(selection.includes("let mode='ncaa'"),'NCAA selection model must open by default');
assert(selection.includes("file('data/college-soccer-ncaa-selection-projection-2026.json')"));
assert(html.includes('college-soccer-national-bracket.css?v=20261116-rpi-fullfit1'));
assert(fs.readFileSync('scripts/build_college_soccer_rpi_committee_projection.py','utf8').includes('college-soccer-ncaa-automatic-bids-2026.json'));
assert(!fs.readFileSync('scripts/build_college_soccer_rpi_committee_projection.py','utf8').includes('college-soccer-elo.json'));
console.log('PASS: 48 eligible RPI-led teams; 23 certified AQs, 25 at-large, 24 projected seeds, 16 byes, 47 connected games, no RETRO data and no horizontal scrolling; 2-model selection comparison.');

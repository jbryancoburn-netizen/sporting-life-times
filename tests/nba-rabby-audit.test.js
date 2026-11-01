/* Run: node tests/nba-rabby-audit.test.js
 * Zero-dependency checks for independently sourced 2026-27 NBA projections.
 * No external API requests, state mutation, or GitHub workflow required.
 */
'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const base=path.resolve(__dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(base,name),'utf8'));
const {build,project,validate,scheduleContext,restDisplay}=
 require(path.join(base,'nba-rabby-possession.js'));
const availability=require(path.join(base,'nba-availability.js'));
const stats=read('data/nba-possession-inputs.json');
const priors=read('data/nba-2025-26-team-advanced.json');
const earned=read('data/nba-2026-27-current-provisional.json');
const ratings=Object.fromEntries(earned.rankings.map(r=>[r.team,+r.elo]));
assert(validate(stats),'Only attributed, deduplicated final-game possessions accepted');
assert.equal(Object.keys(priors.teams).length,30,'Historical profiles cover exactly 30 teams');
assert.equal(Object.keys(ratings).length,30,'USRS earned Elo has all 30 teams');
const model=build(stats,4,priors);
assert(model,'Calibrated and sourced NBA possession model must build');
assert.equal(model.coverage.teams,30,'No hidden generic projection for missing NBA teams');
assert(model.coverage.games>=20,'At least twenty completed team-boxscore games');
assert(model.calibration.testGames>=100,'Frozen historical scoring holdout present');
const ledger=new Set((earned.events||[]).map(g=>g.id));
assert(stats.games.every(g=>ledger.has(g.id)),'All scoring inputs must have matching earned Elo final IDs');
let cases=0;
for(const home of Object.keys(ratings)){
 for(const away of Object.keys(ratings)){
  if(home===away)continue;
  const p=project(home,away,model,ratings);
  assert(p&&p.awayScore!==p.homeScore,home+' vs '+away+' valid non-tied projection');
  assert(p.awayScore>65&&p.homeScore>65&&p.awayScore<180&&p.homeScore<180);
  assert(Number.isFinite(p.total)&&Number.isFinite(p.possessions)&&p.possessions>60&&p.possessions<140);
  assert(p.homeWin>0&&p.homeWin<1,'Elo win probabilities separated from scoring estimates');
  cases++;
 }
}
assert.equal(cases,870);
assert.equal(project('BOS','BOS',model,ratings),null,'No self-matchups');
assert.equal(project('XXX','BOS',model,ratings),null,'No unknown teams');
const raw={timestamp:'2026-11-01T18:00:00Z',injuries:[
 {team:{abbreviation:'BOS'},injuries:[
  {athlete:{id:'123',displayName:'TEST Celtics Player'},status:'Out',date:'2026-11-01T18:00:00Z'}]},
 {team:{},injuries:[{athlete:{displayName:'No team attribution'},status:'Out'}]}
]};
const current=availability.parse(raw,Date.parse('2026-11-01T19:00:00Z'));
assert(current&&current.current,'Fresh team-identified injury source accepted');
assert.equal(current.teams.BOS.length,1);
assert.equal(current.teams.BOS[0].status,'out');
assert(!availability.card(current,'BOS','LAL').includes('No team attribution'),'Never display an unmatched injury');
const stale=availability.parse(raw,Date.parse('2026-11-03T19:00:00Z'));
assert(!stale.current,'Stale injury source must be rejected');
assert(availability.card(stale,'BOS','LAL').includes('stale'));
const prior=[{home:'BOS',away:'NYK',date:'2026-11-01T00:30:00Z'}]; // Oct 31 ET
const context=scheduleContext('BOS','2026-11-01T20:30:00Z',prior); // Nov 1 ET, DST transition
assert(context.backToBack,'Back-to-back correctly interpreted across Eastern DST');
assert(restDisplay(context).includes('Back-to-back'));
assert.equal(scheduleContext('BOS','2026-11-01T20:30:00Z',[]).known,false);
console.log('PASS NBA Rabby:',cases,'home-away pairings,',model.coverage.games,
 'verified games,',model.coverage.teams,'teams, independent Elo, availability attribution, Eastern rest.');

#!/usr/bin/env node
// NBA Elo publication integrity audit. Read-only: never changes ratings.
// Run: node scripts/audit-nba-elo.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const read = path => JSON.parse(readFileSync(new URL('../data/' + path, import.meta.url), 'utf8'));
const frozen = read('nba-2025-26-final.json');
const preseason = read('nba-2026-27-preseason-provisional.json');
const current = read('nba-2026-27-current-provisional.json');
const expected = 'ATL BOS BKN CHA CHI CLE DAL DEN DET GSW HOU IND LAC LAL MEM MIA MIL MIN NOP NYK OKC ORL PHI PHX POR SAC SAS TOR UTA WAS'.split(' ').sort();
const checkRatings = (dataset, label) => {
  assert.equal(dataset.league, 'NBA', label + ': wrong league');
  assert.equal(dataset.rankings?.length, 30, label + ': wrong number of clubs');
  assert.deepEqual(dataset.rankings.map(r=>r.team).sort(), expected, label + ': team set mismatch');
  dataset.rankings.forEach(r => assert.ok(Number.isFinite(r.elo), label + ': non-finite Elo'));
  return Object.fromEntries(dataset.rankings.map(r=>[r.team,r.elo]));
};
assert.equal(frozen.season, '2025-26');
assert.equal(frozen.status, '2025-26-final');
assert.equal(frozen.regular_season_games, 1230);
assert.equal(frozen.playoff_games, 85);
assert.equal(preseason.season, '2026-27');
assert.equal(current.season, '2026-27');
assert.equal(preseason.status, 'provisional_historical_regression_only');
assert.equal(current.status, 'provisional_live_from_historical_baseline');
assert.equal(preseason.preseason_adjustments_complete, false);
assert.equal(current.preseason_status, preseason.status);
const f=checkRatings(frozen,'frozen'), p=checkRatings(preseason,'preseason'), c=checkRatings(current,'current');
// Round-to-three-decimal file precision: carryover should be within .001.
const retention = preseason.parameters?.season_retention;
assert.ok(Number.isFinite(retention) && retention >= 0 && retention <= 1);
for (const team of expected) {
  const prediction=1500+retention*(f[team]-1500);
  assert.ok(Math.abs(p[team]-prediction)<.0011, team+': inconsistent offseason regression');
}
assert.ok(Array.isArray(current.events), 'missing scored-game event ledger');
assert.equal(current.games_played,current.events.length,'event count differs from games_played');
const ids=new Set(), deltas=Object.fromEntries(expected.map(t=>[t,0]));
for(const e of current.events) {
  assert.ok(typeof e.id==='string' && e.id, 'event missing id');
  assert.ok(!ids.has(e.id), 'duplicate game '+e.id);ids.add(e.id);
  assert.ok(expected.includes(e.home) && expected.includes(e.away) && e.home!==e.away,'invalid fixture '+e.id);
  assert.ok(Number.isInteger(e.home_score)&&Number.isInteger(e.away_score)&&e.home_score>=0&&e.away_score>=0&&e.home_score!==e.away_score,'invalid completed score '+e.id);
  assert.ok(Number.isFinite(e.home_elo_change),'missing Elo delta '+e.id);
  deltas[e.home]+=e.home_elo_change;deltas[e.away]-=e.home_elo_change;
}
for(const team of expected){
  assert.ok(Math.abs(c[team]-p[team]-deltas[team])<.003,team+': current rating does not reconcile with logged game deltas');
}
const sum = x=>Object.values(x).reduce((a,b)=>a+b,0);
assert.ok(Math.abs(sum(c)-sum(p))<.01,'current ratings violate zero-sum Elo replay');
// A green audit does NOT validate roster evidence, preseason calibration, or live freshness.
console.log(JSON.stringify({status:'PASS',teams:30,completed_games:current.games_played,retention,preseason_status:preseason.status,current_status:current.status,latest_game_id:current.events.at(-1)?.id,warning:'Integrity only; roster/preseason calibration and freshness are NOT validated.'},null,2));

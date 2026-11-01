#!/usr/bin/env node
// Forward-only NBA pregame forecast archival. Pure synthetic fixtures plus real sourced data.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {updateLedger,validate,metrics} from './update-nba-forecast-ledger.mjs';
const read=p=>JSON.parse(readFileSync(new URL('../data/'+p,import.meta.url),'utf8'));
const fixture={
 schedule:read('nba-upcoming-schedule.json'),
 earned:read('nba-elo-shadow-2026-27.json'),
 stats:read('nba-possession-inputs.json'),
 history:read('nba-2025-26-team-advanced.json'),
 fingerprints:{earned:'test-earned',stats:'test-boxes',history:'test-prior',schedule:'test-schedule',model:'rabby-test-version'}
};
const clone=x=>structuredClone(x);
const now='2026-11-01T19:00:00.000Z';
test('NBA prospectively freezes both phases and never rewrites forecasts',()=>{
 const a=updateLedger(null,fixture,now);
 assert.equal(a.added,4,'4 NBA games yet to tip at fixed synthetic time');
 assert.equal(a.ledger.forecasts.filter(x=>x.phase==='early').length,3);
 assert.equal(a.ledger.forecasts.filter(x=>x.phase==='near_tipoff').length,1);
 assert(a.ledger.forecasts.every(x=>Date.parse(x.captured_at)<Date.parse(x.date)-600000));
 const b=updateLedger(a.ledger,fixture,now);
 assert.equal(b.added,0);
 assert.equal(b.changed,false);
 assert.deepEqual(b.ledger.forecasts,a.ledger.forecasts);
 const c=updateLedger(b.ledger,fixture,'2026-11-01T20:15:00.000Z');
 assert.equal(c.added,1,'Brooklyn at Indiana now inside near-tipoff window');
 // Assert matchup identity rather than depending on a specific provider ID.
 const bkn=c.ledger.forecasts.filter(x=>x.away==='BKN'&&x.home==='IND');
 assert.equal(bkn.length,2);
 assert.deepEqual(bkn.map(x=>x.phase).sort(),['early','near_tipoff']);
 assert.deepEqual(c.ledger.forecasts.filter(x=>x.phase==='early'),a.ledger.forecasts.filter(x=>x.phase==='early'));
 assert(validate(c.ledger));
});
test('Refuse fabricated retrospective predictions, and score only recorded games',()=>{
 const source=clone(fixture),fakeAt='2026-11-02T06:00:00.000Z';
 const empty=updateLedger(null,source,fakeAt);
 assert(empty.ledger.forecasts.every(x=>Date.parse(x.date)>Date.parse(fakeAt)+10*60000),'No historic reconstruction from already tipped games');
 assert(!empty.ledger.forecasts.some(x=>['ORL','IND','GSW','LAL'].includes(x.home)),'None of the previous day’s games may be retroactively forecast');
 assert.equal(Object.keys(empty.ledger.results).length,0);
 const pre=updateLedger(null,fixture,now);
 const before=clone(pre.ledger.forecasts);
 const first=before.find(x=>x.phase==='near_tipoff');
 const finished=clone(fixture);
 finished.earned.events.push({id:first.id,date:first.date,home:first.home,away:first.away,
  home_score:110,away_score:107});
 finished.earned.games_played+=1;
 const final=updateLedger(pre.ledger,finished,'2026-11-01T21:05:00.000Z');
 assert.equal(final.graded,1);
 assert.deepEqual(final.ledger.forecasts,before,'Forecasts are immutable when graded');
 assert.equal(final.ledger.results[first.id].home_score,110);
 assert.equal(final.ledger.metrics.near_tipoff.sample,1);
 const repeat=updateLedger(final.ledger,finished,'2026-11-01T21:06:00.000Z');
 assert.equal(repeat.graded,0,'Already graded game may not be modified');
 assert.deepEqual(repeat.ledger.results,final.ledger.results);
});
test('Rechecks truth of all source identities, no empty Elo or missing possessions',()=>{
 const wrongElo=clone(fixture);wrongElo.earned.status='provisional_live_from_historical_baseline';
 assert.throws(()=>updateLedger(null,wrongElo,now),/earned USRS Elo/);
 const wrongTeam=clone(fixture);
 wrongTeam.earned.events.pop();wrongTeam.earned.games_played--;
 assert.throws(()=>updateLedger(null,wrongTeam,now),/reconcilable/);
 const wrongCal=clone(fixture);delete wrongCal.stats.calibration;
 assert.throws(()=>updateLedger(null,wrongCal,now),/qualified possession/);
 const post=updateLedger(null,fixture,now),bad=clone(post.ledger);
 bad.forecasts[0].captured_at=bad.forecasts[0].date;
 assert.throws(()=>validate(bad),/Post-tipoff/);
});
test('Scores are null until real completed pregame predictions are available',()=>{
 const empty=updateLedger(null,fixture,'2026-11-02T06:00:00.000Z');
 assert.deepEqual(metrics(empty.ledger).early.sample,0);
 assert.equal(metrics(empty.ledger).near_tipoff.margin_mae,null);
});
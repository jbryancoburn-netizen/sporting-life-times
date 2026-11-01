#!/usr/bin/env node
// Forward-only NBA pregame forecast archival. Pure synthetic fixtures plus real sourced data.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {updateLedger,validate,metrics} from './update-nba-forecast-ledger.mjs';
const read=p=>JSON.parse(readFileSync(new URL('../data/'+p,import.meta.url),'utf8'));
const fixture={
 schedule:{updated_at:'2099-11-01T19:00:00.000Z',games:[
  {id:'synthetic-bos-orl',date:'2099-11-01T20:30:00Z',state:'pre',teams:[{home_away:'away',code:'BOS'},{home_away:'home',code:'ORL'}]},
  {id:'synthetic-bkn-ind',date:'2099-11-01T22:00:00Z',state:'pre',teams:[{home_away:'away',code:'BKN'},{home_away:'home',code:'IND'}]},
  {id:'synthetic-lac-gsw',date:'2099-11-02T01:30:00Z',state:'pre',teams:[{home_away:'away',code:'LAC'},{home_away:'home',code:'GSW'}]},
  {id:'synthetic-tor-lal',date:'2099-11-02T02:00:00Z',state:'pre',teams:[{home_away:'away',code:'TOR'},{home_away:'home',code:'LAL'}]}
 ]},
 earned:read('nba-elo-shadow-2026-27.json'),
 stats:read('nba-possession-inputs.json'),
 history:read('nba-2025-26-team-advanced.json'),
 fingerprints:{earned:'test-earned',stats:'test-boxes',history:'test-prior',schedule:'test-schedule',model:'rabby-test-version'}
};
const clone=x=>structuredClone(x);
const now='2099-11-01T19:00:00.000Z';
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
 const nextSource=clone(fixture);nextSource.schedule.updated_at='2099-11-01T20:10:00.000Z';
 const c=updateLedger(b.ledger,nextSource,'2099-11-01T20:15:00.000Z');
 assert.equal(c.added,1,'Brooklyn at Indiana now inside near-tipoff window');
 // Assert matchup identity rather than depending on a specific provider ID.
 const bkn=c.ledger.forecasts.filter(x=>x.away==='BKN'&&x.home==='IND');
 assert.equal(bkn.length,2);
 assert.deepEqual(bkn.map(x=>x.phase).sort(),['early','near_tipoff']);
 assert.deepEqual(c.ledger.forecasts.filter(x=>x.phase==='early'),a.ledger.forecasts.filter(x=>x.phase==='early'));
 assert(validate(c.ledger));
});
test('Refuse fabricated retrospective predictions, and score only recorded games',()=>{
 const source=clone(fixture),fakeAt='2099-11-02T06:00:00.000Z';
 const empty=updateLedger(null,source,fakeAt);
 assert(empty.ledger.forecasts.every(x=>Date.parse(x.date)>Date.parse(fakeAt)+10*60000),'No historic reconstruction from already tipped games');
 assert.equal(empty.ledger.forecasts.length,0,'Past synthetic fixtures must never be retroactively forecast');
 assert.equal(Object.keys(empty.ledger.results).length,0);
 const pre=updateLedger(null,fixture,now);
 const before=clone(pre.ledger.forecasts);
 const first=before.find(x=>x.phase==='near_tipoff');
 const finished=clone(fixture);
 finished.earned.events.push({id:first.id,date:first.date,home:first.home,away:first.away,
  home_score:110,away_score:107});
 finished.earned.games_played+=1;
 const final=updateLedger(pre.ledger,finished,'2099-11-01T22:05:00.000Z');
 assert.equal(final.graded,1);
 for(const original of before){
  const archived=final.ledger.forecasts.find(x=>x.id===original.id&&x.phase===original.phase);
  assert.deepEqual(archived,original,'Existing forecasts are immutable when graded');
 }
 assert.equal(final.ledger.results[first.id].home_score,110);
 assert.equal(final.ledger.metrics.near_tipoff.sample,1);
 const repeat=updateLedger(final.ledger,finished,'2099-11-01T22:06:00.000Z');
 assert.equal(repeat.graded,0,'Already graded game may not be modified');
 assert.deepEqual(repeat.ledger.results,final.ledger.results);
});
test('Rechecks truth of all source identities, no empty Elo or missing possessions',()=>{
 const wrongElo=clone(fixture);wrongElo.earned.status='provisional_live_from_historical_baseline';
 assert.throws(()=>updateLedger(null,wrongElo,now),/earned USRS Elo/);
 const wrongTeam=clone(fixture);
 const omitted=wrongTeam.stats.games[0].id;
 wrongTeam.earned.events=wrongTeam.earned.events.filter(g=>g.id!==omitted);
 wrongTeam.earned.games_played=wrongTeam.earned.events.length;
 assert.throws(()=>updateLedger(null,wrongTeam,now),/reconcilable/);
 const wrongCal=clone(fixture);delete wrongCal.stats.calibration;
 assert.throws(()=>updateLedger(null,wrongCal,now),/Missing team possession coverage/);
 const post=updateLedger(null,fixture,now),bad=clone(post.ledger);
 bad.forecasts[0].captured_at=bad.forecasts[0].date;
 assert.throws(()=>validate(bad),/Post-tipoff/);
});
test('Scores are null until real completed pregame predictions are available',()=>{
 const empty=updateLedger(null,fixture,'2099-11-02T06:00:00.000Z');
 assert.deepEqual(metrics(empty.ledger).early.sample,0);
 assert.equal(metrics(empty.ledger).near_tipoff.margin_mae,null);
});

test('NBA and ESPN game IDs can reconcile only with exact official final teams, scores, and tipoff',()=>{
 const alternate=clone(fixture);
 const original=alternate.stats.games[0];
 original.id='0022090999'; // simulated official identifier for an ESPN-matched final
 assert(updateLedger(null,alternate,now).added>0,'Uniquely matched cross-provider ID is accepted');
 const falsified=clone(alternate);
 falsified.stats.games[0].home.points+=1;
 assert.throws(()=>updateLedger(null,falsified,now),/Possession data not reconcilable/);
 const wrongDay=clone(alternate);
 wrongDay.stats.games[0].date='2026-10-01T00:00:00Z';
 assert.throws(()=>updateLedger(null,wrongDay,now),/Possession data not reconcilable/);
});

test('Stale schedule prevents new forecasts but still permits independently verified final grading',()=>{
 const before=updateLedger(null,fixture,now);
 const stale=clone(fixture);stale.schedule.updated_at='2099-11-01T10:00:00Z';
 const fromScratch=updateLedger(null,stale,now);
 assert.equal(fromScratch.added,0,'No predictions based on an out-of-date fixture ledger');
 assert.equal(fromScratch.skippedStale,4);
 assert.equal(fromScratch.ledger.forecasts.length,0);
 const completed=clone(stale),forecast=before.ledger.forecasts.find(f=>f.phase==='near_tipoff');
 completed.earned.events.push({id:forecast.id,date:forecast.date,home:forecast.home,away:forecast.away,home_score:123,away_score:111});
 completed.earned.games_played++;
 const graded=updateLedger(before.ledger,completed,'2099-11-01T22:30:00.000Z');
 assert.equal(graded.graded,1);
 assert.equal(graded.added,0);
});
test('Confirmed reschedules quarantine forecasts without revising them or blocking other games',()=>{
 const before=updateLedger(null,fixture,now);
 const changed=clone(fixture);changed.schedule.updated_at='2099-11-01T20:10:00.000Z';
 changed.schedule.games[0].date='2099-11-02T20:30:00Z';
 const after=updateLedger(before.ledger,changed,'2099-11-01T20:15:00.000Z');
 assert.equal(after.flagged,1);
 assert.equal(after.ledger.exceptions['synthetic-bos-orl'].reason,'schedule_changed');
 assert.deepEqual(after.ledger.forecasts.find(f=>f.id==='synthetic-bos-orl'),before.ledger.forecasts.find(f=>f.id==='synthetic-bos-orl'));
 assert(after.ledger.forecasts.some(f=>f.away==='BKN'&&f.phase==='near_tipoff'),'Other games still processed');
 const finished=clone(changed);
 finished.earned.events.push({id:'synthetic-bos-orl',date:'2099-11-02T20:30:00Z',away:'BOS',home:'ORL',home_score:113,away_score:107});
 finished.earned.games_played++;
 const graded=updateLedger(after.ledger,finished,'2099-11-02T23:00:00.000Z');
 assert.equal(graded.graded,0,'Rescheduled game cannot be graded against superseded pregame expectations');
 assert.equal(graded.ledger.metrics.near_tipoff.sample,0);
});
test('Future Elo results never enter a forecast recorded as historical pregame',()=>{
 const leaked=clone(fixture);
 leaked.earned.events.push({id:'future-game',date:'2099-11-01T20:30:00Z',away:'CHI',home:'MIA',home_score:111,away_score:95});
 leaked.earned.games_played++;
 const created=updateLedger(null,leaked,now);
 assert.equal(created.added,0,'Contaminated Elo blocks new snapshot captures');
 assert.equal(created.skippedStale,4);
});

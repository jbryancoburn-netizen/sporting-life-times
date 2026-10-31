#!/usr/bin/env node
// Synthetic tests: no live scores or network dependency.
import assert from 'node:assert/strict';
import {reconcileSchedule} from './reconcile-nba-schedule.mjs';
const game = {
 id:'espn-nba-test1',date:'2026-10-30T23:30:00Z',state:'in',status:'Q4',
 teams:[{home_away:'away',code:'BOS',score:90},{home_away:'home',code:'NYK',score:94}]
};
const ledger={season:'2026-27',games_played:1,events:[{
 id:game.id,home:'NYK',away:'BOS',home_score:110,away_score:100
}]};
const initial={updated_at:'2026-10-30T20:00:00Z',games:[game]};
const first=reconcileSchedule(initial,ledger);
assert.equal(first.updated,1);
assert.equal(first.matched,1);
assert.equal(first.schedule.games[0].state,'post');
assert.equal(first.schedule.games[0].teams[0].score,100);
assert.equal(first.schedule.games[0].teams[1].score,110);
assert.equal(first.schedule.updated_at,initial.updated_at);
assert.equal(reconcileSchedule(first.schedule,ledger).updated,0);
assert.throws(()=>reconcileSchedule({games:[{...game,state:'post',teams:[
 {...game.teams[0],score:99},{...game.teams[1],score:110}
]}]},ledger),/Conflicting away final/);
assert.throws(()=>reconcileSchedule({games:[{...game,teams:[
 {...game.teams[0],code:'MIA'},game.teams[1]
]}]},ledger),/away team mismatch/);
assert.throws(()=>reconcileSchedule({games:[game,game]},ledger),/Duplicate schedule ID/);
assert.throws(()=>reconcileSchedule(initial,{...ledger,games_played:2}),/final count mismatch/);
console.log('PASS: verified finals, correct scores, conflicts, duplicates, and fetch freshness');

#!/usr/bin/env node
/* Invariant tests for the same production Rabby scorer shipped on NBA pages. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const m=require('../nba-rabby-possession.js');
const read=p=>JSON.parse(readFileSync(new URL('../data/'+p,import.meta.url),'utf8'));
const box=read('nba-possession-inputs.json');
const history=read('nba-2025-26-team-advanced.json');
const earned=read('nba-elo-shadow-2026-27.json');
const ratings=Object.fromEntries(earned.rankings.map(x=>[x.team,x.elo]));
assert.equal(earned.status,'primary_live_earned_elo');
assert.equal(earned.parameters.season_start_elo,1500);
assert.equal(earned.parameters.home_elo,40);
assert.equal(m.validate({source_type:'unverified',games:[]}),false);
assert.equal(m.build(box,4,{}),null,'Missing sourced history should not become a generic forecast');
assert.equal(m.build({...box,calibration:null},4,history),null,'Missing calibrated score coefficients must not project');
const bad=structuredClone(box);bad.games.push(structuredClone(box.games[0]));
assert.equal(m.validate(bad),false,'Duplicated game cannot alter team ratings');
assert.ok(m.validate(box));
const model=m.build(box,4,history);
assert.ok(model&&model.coverage.teams===30,'Must cover all 30 NBA teams');
assert.equal(model.coverage.games,box.games.length);
assert.ok(model.calibration.testGames>=100,'Untouched historical calibration holdout required');
const teams=Object.keys(ratings);
assert.equal(teams.length,30);
let count=0;
for(const home of teams)for(const away of teams){
 if(home===away)continue;
 const p=m.project(home,away,model,ratings);
 assert.ok(p,home+' / '+away+' must have NBA-specific score');
 assert.ok(Number.isInteger(p.homeScore)&&Number.isInteger(p.awayScore));
 assert.notEqual(p.homeScore,p.awayScore,'No predicted NBA ties');
 assert.ok(p.total>175&&p.total<300);
 assert.ok(p.possessions>70&&p.possessions<130);
 const expected=1/(1+10**(-(ratings[home]+40-ratings[away])/400));
 assert.ok(Math.abs(p.homeWin-expected)<1e-12,'Earned USRS Elo win probability +40 home edge');
 count++;
}
assert.equal(count,870);
const a=m.project('ORL','BOS',model,ratings);
const b=m.project('SAS','UTA',model,ratings);
assert.notEqual(a.total,b.total,'Game-specific pace and opponent defense change totals');
const prev=[{home:'BOS',away:'ORL',date:'2026-11-01T00:30Z'}];
const b2b=m.scheduleContext('BOS','2026-11-01T20:30Z',prev);
assert.equal(b2b.backToBack,true,'DST and Eastern rest boundaries');
assert.match(m.restDisplay(b2b),/Back-to-back/);
assert.equal(m.scheduleContext('BOS','2026-11-01T20:30Z',[]).known,false);
console.log('Rabby PASS: '+model.coverage.games+' verified team boxes, 30 ratings, '+count+
 ' opponent-specific forecasts, frozen historical calibration, real +40 earned-Elo probabilities, Eastern rest.');

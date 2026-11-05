'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const engine=require('../wbb-retro-forecast.js');
const snapshot={model:'retro-clean-slate',gender:'women',season:'2026-27',
 starting_elo:1500,parameters:{home_edge:75},rankings:[
  {team_id:'1',elo:1600},{team_id:'2',elo:1450},
  ...Array.from({length:361},(_,i)=>({team_id:String(i+3),elo:1500}))
 ]};
const calibration={model:'ncaaw-retro-exact-160-pass-forecast-v1',
 gender:'women',status:'HISTORICAL_HOLDOUT_VALIDATED',
 rating_engine:{passes:160,initial_elo:1500},
 release_checks:{passed:true},
 parameters:{probability_scale:1.15,elo_margin_slope:.05098332,mean_team_points:64.93550849}};
test('validated women-only ratings yield consistent win chance margin and scores',()=>{
 const f=engine.forMatch({home_id:'1',away_id:'2'},snapshot,calibration,'verified-home');
 assert.ok(f&&f.calibrated);
 assert.ok(f.home_probability>.5);
 assert.ok(Math.abs(f.home_probability+f.away_probability-1)<1e-12);
 assert.ok(Math.abs(f.projected_home_margin-(1600-1450+75)*calibration.parameters.elo_margin_slope)<1e-8);
 assert.ok(Math.abs(f.projected_home_score-f.projected_away_score-f.projected_home_margin)<1e-9);
 assert.ok(Math.abs((f.projected_home_score+f.projected_away_score)/2-calibration.parameters.mean_team_points)<1e-8);
});
test('neutral site removes home edge and unverified court carries disclosure',()=>{
 const home=engine.forMatch({home_id:'1',away_id:'2'},snapshot,calibration,'verified-home');
 const neutral=engine.forMatch({home_id:'1',away_id:'2'},snapshot,calibration,'neutral');
 const unknown=engine.forMatch({home_id:'1',away_id:'2'},snapshot,calibration,'unverified');
 assert.ok(home.projected_home_margin>neutral.projected_home_margin);
 assert.equal(neutral.projected_home_margin,unknown.projected_home_margin);
 assert.equal(unknown.venue_status,'unverified');
 assert.equal(engine.forMatch({home_id:'1',away_id:'2'},snapshot,calibration,'disputed'),null);
});
test('reject mismatched gender, unknown opponent and failed holdout',()=>{
 assert.equal(engine.forMatch({home_id:'1',away_id:'unknown'},snapshot,calibration,'verified-home'),null);
 assert.equal(engine.forMatch({home_id:'1',away_id:'2'},{...snapshot,gender:'men'},calibration,'verified-home'),null);
 const fail={...calibration,status:'HOLDOUT_EVALUATED_NOT_PROMOTED'};
 const forecast=engine.forMatch({home_id:'1',away_id:'2'},snapshot,fail,'neutral');
 assert.equal(forecast.calibrated,false);
 assert.equal(forecast.projected_home_margin,null);
 assert.ok(forecast.provisional);
});
test('do not impose arbitrary maximum margin on large rated mismatches',()=>{
 const big=engine.forecast({elo:1900},{elo:1100},'verified-home',calibration,snapshot);
 assert.ok(big.projected_home_margin>40);
});

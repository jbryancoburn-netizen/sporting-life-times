'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {freeze,localDay}=require('../scripts/archive-wbb-forecasts.cjs');
const old=()=>({season:'2026-27',gender:'women',predictions:[]});
const rankings={season:'2026-27',gender:'women',rankings:Array.from({length:363},(_,i)=>({team_id:String(i+1),elo:1500}))};
const calibration={model:'ncaaw-retro-exact-160-pass-forecast-v1',gender:'women',
 status:'HISTORICAL_HOLDOUT_VALIDATED',release_checks:{passed:true},
 rating_engine:{passes:160,initial_elo:1500},
 parameters:{probability_scale:1.15,elo_margin_slope:0.05098332,mean_team_points:64.93550849}};
const future={id:'401999999',date:'2026-11-16T20:00:00Z',home_id:'1',away_id:'2',site_verified:true,status:'scheduled'};
const fake=()=>({calibrated:true,projected_home_margin:4.75,home_probability:0.7});
test('freeze only tomorrow and later Eastern dates, preserving pretipoff orientation',()=>{
 const games={season:'2026-27',upcoming:[{...future,id:'401999998',date:'2026-11-14T20:00:00Z'},future]};
 const {archive,added}=freeze(old(),games,rankings,calibration,'2026-11-14T16:00:00Z',fake);
 assert.equal(added,1);
 assert.equal(archive.predictions[0].id,'espn:401999999');
 assert.equal(archive.predictions[0].date,'2026-11-16');
 assert.equal(archive.predictions[0].projected_home_margin,5);
 assert.equal(archive.predictions[0].home_win_probability,0.7);
 assert.equal(archive.predictions[0].home_id,'1');
 assert.equal(archive.predictions[0].away_id,'2');
});
test('an archived prediction is immutable even when later ratings change',()=>{
 const g={season:'2026-27',upcoming:[future]};
 const first=freeze(old(),g,rankings,calibration,'2026-11-14T16:00:00Z',fake).archive;
 const after=freeze(first,g,rankings,calibration,'2026-11-15T16:00:00Z',
  ()=>({calibrated:true,projected_home_margin:-11,home_probability:.1}));
 assert.equal(after.added,0);
 assert.deepEqual(after.archive.predictions,first.predictions);
 assert.throws(()=>freeze(first,{season:'2026-27',upcoming:[{...future,away_id:'3'}]},
  rankings,calibration,'2026-11-14T16:00:00Z',fake),/Conflicting identities/);
});
test('a calibrated source or exact game identity is required',()=>{
 assert.throws(()=>freeze(old(),{season:'2026-27',upcoming:[future]},rankings,
  {...calibration,release_checks:{passed:false}},'2026-11-14T16:00:00Z',fake),/unavailable/);
 assert.equal(localDay('2026-11-15T01:00:00Z'),'2026-11-14');
});

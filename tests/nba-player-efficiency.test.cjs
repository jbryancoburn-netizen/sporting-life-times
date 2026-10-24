const {test}=require('node:test');
const assert=require('node:assert/strict');
const {nbaAdvanced}=require('../nba-player-page.js');
test('efficiency metrics use aggregate attempts and distinguish assists per turnover',()=>{
 const a=nbaAdvanced({fgm:10,fg3m:4,fga:20,pts:30,fta:5,tov:2,ast:6});
 assert.equal(a.efg,60);assert.equal(a.astTo,3);
 assert.ok(Math.abs(a.ts-100*30/44.4)<1e-10);
 assert.ok(Math.abs(a.tov-100*2/24.2)<1e-10);
});
test('players without attempts or turnovers have unavailable rates, not zero',()=>{
 const a=nbaAdvanced({fgm:0,fg3m:0,fga:0,pts:0,fta:0,tov:0,ast:0});
 assert.ok(Object.values(a).every(v=>v===null));
});

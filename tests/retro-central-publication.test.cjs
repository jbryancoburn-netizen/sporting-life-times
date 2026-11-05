'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const base=require('node:path').resolve(__dirname,'..');
const read=p=>fs.readFileSync(require('node:path').join(base,p),'utf8');
const json=JSON.parse(read('data/ncaam-2026-27-retro-forecasts.json'));
const ratings=JSON.parse(read('data/ncaam-2026-27-retro-primary.json'));
const fixtures=JSON.parse(read('data/ncaam-2026-27-upcoming-forecasts.json'));
const context={window:{},module:{exports:{}}};context.globalThis=context.window;
vm.runInNewContext(read('data/ncaam-2026-27-retro-forecasts.js'),context);
vm.runInNewContext(read('retro-forecast-engine.js'),context);
const published=context.window.RETROForecastPublication,engine=context.window.RETROForecast;
assert.deepEqual(JSON.parse(JSON.stringify(published)),json);
assert.equal(json.team_count,365);
assert.equal(json.rating_revision,String(ratings.as_of||'preseason')+'|'+ratings.games_played);
assert.equal(json.forecast_count,json.games.length);
assert.ok(json.games.length>0);
const team=new Map(ratings.rankings.map(t=>[t.team_id,t]));
const fixtureIds=new Set(fixtures.games.map(x=>x.id));
const seen=new Set();
for(const g of json.games){
 assert.ok(!seen.has(g.id));seen.add(g.id);
 assert.ok(fixtureIds.has(g.id));
 assert.equal(team.get(g.home_id).elo,g.home_elo);
 assert.equal(team.get(g.away_id).elo,g.away_elo);
 const a=engine.predict({team_id:g.home_id,elo:g.home_elo},{team_id:g.away_id,elo:g.away_elo},{gameId:g.id,site:'away'});
 assert.equal(a.publication,'central'); // Published game overrides inconsistent local venue.
 assert.equal(a.homeProbability,g.homeProbability);
 assert.equal(a.homeScore,g.homeScore);
 assert.equal(a.awayScore,g.awayScore);
 assert.ok(Math.abs(a.homeProbability+a.awayProbability-1)<1e-6);
}
console.log('PASS: '+seen.size+' men's matchups use identical central published forecasts');

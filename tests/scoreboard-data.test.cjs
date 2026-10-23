/* Validate scoreboard data contracts without inventing missing fixtures or logos. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const datasets=['scoreboards.json','multi_scoreboards.json'];
for(const path of datasets)test(path+' has valid game and team records',()=>{
 const data=JSON.parse(fs.readFileSync(path,'utf8'));
 assert.ok(Number.isFinite(Date.parse(data.updated_at)),'missing update timestamp');
 assert.ok(Array.isArray(data.leagues)&&data.leagues.length,'missing leagues');
 const names=new Set();
 for(const league of data.leagues){
  assert.ok(typeof league.league==='string'&&league.league.trim(),'missing league name');
  assert.ok(!names.has(league.league),'duplicate league '+league.league);
  names.add(league.league);
  assert.ok(Array.isArray(league.games),'missing game list for '+league.league);
  const ids=new Set();
  for(const game of league.games){
   assert.ok(game.id!==undefined&&String(game.id).trim(),'missing game ID');
   assert.ok(!ids.has(String(game.id)),'duplicate game ID '+game.id+' in '+league.league);
   ids.add(String(game.id));
   assert.ok(Number.isFinite(Date.parse(game.date)),'invalid game date '+game.id);
   assert.ok(['pre','in','post'].includes(game.state),'invalid game state '+game.id);
   assert.ok(Array.isArray(game.teams)&&game.teams.length===2,'expected two teams '+game.id);
   for(const team of game.teams){
    assert.ok(typeof team.name==='string'&&team.name.trim(),'missing team name '+game.id);
    if(team.logo)assert.match(team.logo,/^https:\/\//,'invalid team logo URL '+game.id);
   }
   if(game.url)assert.match(game.url,/^https:\/\//,'invalid game source URL '+game.id);
  }
 }
 assert.ok(!names.has('UFL'),'UFL must not appear in the newspaper');
});

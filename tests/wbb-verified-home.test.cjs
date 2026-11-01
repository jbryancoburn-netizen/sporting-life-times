'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const window={};
vm.runInNewContext(fs.readFileSync('wbb-site-integrity.js','utf8'),{window,Map,Set,Array,String,Number,Date,Intl});
const api=window.WBBSiteIntegrity;
const manifest=JSON.parse(fs.readFileSync('data/ncaaw-2026-27-verified-home-courts.json','utf8'));
const row=manifest.games.find(x=>x.game_id==='401912104');
const incorrect={id:'401912104',date:'2027-01-09T18:00:00Z',
 home_id:'2572',away_id:'324',site:'home',opponent_id:'324',completed:false};
test('women site evidence binds three official host assignments by exact date and IDs',()=>{
 const map=api.verifiedHomeCourts(manifest);
 assert.equal(map.size,3);
 const certified=api.officialHome(incorrect,map);
 assert.equal(certified.verified_home_id,'324');
 const home=api.correctedHome(incorrect,map,'324'),away=api.correctedHome({...incorrect,opponent_id:'2572'},map,'2572');
 assert.equal(home.home_id,'324');assert.equal(home.away_id,'2572');assert.equal(home.site,'home');
 assert.equal(away.home_id,'324');assert.equal(away.away_id,'2572');assert.equal(away.site,'away');
 assert.equal(home.venue,'HTC Center');assert.equal(incorrect.home_id,'2572','source game is not mutated');
});
test('wrong gender, wrong opponent and date never receive university court evidence',()=>{
 const map=api.verifiedHomeCourts(manifest);
 assert.equal(api.verifiedHomeCourts({...manifest,gender:'men'}).size,0);
 assert.equal(api.officialHome({...incorrect,home_id:'87'},map),null);
 assert.equal(api.officialHome({...incorrect,date:'2027-01-10T18:00:00Z'},map),null);
 assert.equal(api.officialHome({...incorrect,completed:true,status:'final'},map),null);
 assert.equal(api.verifiedHomeCourts({...manifest,games:[{...row,sources:row.sources.slice(0,2)}]}).size,0);
});
test('women home-court source reaches newspaper and team pages with cache version',()=>{
 const team=fs.readFileSync('ncaaw-team.html','utf8'),front=fs.readFileSync('college-basketball-gender.js','utf8');
 assert.match(team,/correctedHome\(g,homeProof,id\)/);
 assert.match(front,/correctedHome\(g,homeProof\)/);
 assert.match(front,/Home court confirmed/);
 assert.match(team,/Host and venue verified by both universities/);
 assert.match(team,/verified-home-courts\.json/);
});

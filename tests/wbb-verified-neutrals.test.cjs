'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const window={};
vm.runInNewContext(fs.readFileSync('wbb-site-integrity.js','utf8'),
 {window,Map,Set,Array,String,Date,Number,Intl});
const api=window.WBBSiteIntegrity;
const game={id:'401999771',home_id:'2',away_id:'275',opponent_id:'275',
  date:'2026-11-26T00:30:00Z',site:'home',neutral:false,status:'scheduled'};
const confirmed={game_id:'401999771',team_id:'2',opponent_id:'275',date:'2026-11-25',
 published_site:'home',verified_site:'neutral',verified_venue:'Coliseo Guillermo Angulo, Puerto Rico',
 source_url:'https://auburntigers.com/sports/womens-basketball/schedule',
 corroborating_source_url:'https://www.sanjuanshootout.com/'};
const evidence={season:'2026-27',gender:'women',source_scope:'two_source_neutral_site_verification',games:[confirmed]};
const claim={...confirmed,university_listed_site:'neutral',site_evidence:'neutral_markup',source_type:'school',
             source_url:confirmed.source_url};
const disputed={season:'2026-27',gender:'women',status:'unresolved_university_site_claims',games:[claim]};
test('two independent university/organizer sources validate a neutral site by exact game and Eastern date',()=>{
 const proof=api.neutrals(evidence);
 assert.equal(proof.size,1);
 assert.equal(api.certifiedNeutral(game,proof).verified_site,'neutral');
 assert.equal(game.site,'home','published schedule identity remains unchanged');
 assert.equal(api.claims(game,api.index(disputed),proof).length,0);
 assert.equal(api.claims(game,api.index(disputed),new Map()).length,1);
});
test('wrong year, wrong team and missing independent URL fail closed',()=>{
 const proof=api.neutrals(evidence);
 assert.equal(api.certifiedNeutral({...game,date:'2026-11-27T00:30:00Z'},proof),null);
 assert.equal(api.certifiedNeutral({...game,away_id:'183'},proof),null);
 assert.equal(api.neutrals({...evidence,gender:'men'}).size,0);
 assert.equal(api.neutrals({...evidence,season:'2025-26'}).size,0);
 assert.equal(api.neutrals({...evidence,games:[{...confirmed,corroborating_source_url:'http://invalid'}]}).size,0);
});
test('live women source refresh keeps source-confirmed neutral home-court edge at zero',()=>{
 const front=fs.readFileSync('college-basketball-gender.js','utf8'),
       team=fs.readFileSync('ncaaw-team.html','utf8'),
       live=fs.readFileSync('wbb-team-live.js','utf8');
 assert.match(front,/certifiedNeutral\|\|g\.neutral\)\?0/);
 assert.match(front,/Neutral-site venue verified/);
 assert.match(team,/neutral\?\{\.\.\.g,site:'neutral'\}:g/);
 assert.match(live,/const adj=neutral\?0:/);
 assert.match(team,/verified-neutral-sites\.json/);
});

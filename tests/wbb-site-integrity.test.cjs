'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const window={};
vm.runInNewContext(fs.readFileSync('wbb-site-integrity.js','utf8'),{window,Map,Set,Array,String});
const api=window.WBBSiteIntegrity;
const row={
 game_id:'401999777',team_id:'2',school:'Auburn Tigers',opponent_id:'87',
 date:'2026-11-19',published_site:'neutral',university_listed_site:'home',
 site_evidence:'vs_prefix',source_url:'https://auburntigers.com/sports/womens-basketball/schedule',
 source_type:'official_university_sidearm_card'
};
const issue={season:'2026-27',gender:'women',status:'unresolved_university_site_claims',games:[row]};
const g={id:'401999777',home_id:'2',away_id:'87',site:'neutral',neutral:true,
 date:'2026-11-19T18:00Z',status:'scheduled',completed:false};
test('same neutral-site women event identity is quarantined without inventing a host',()=>{
 const index=api.index(issue);
 assert.equal(index.size,1);
 assert.equal(api.claims(g,index).length,1);
 assert.match(api.note(api.claims(g,index)),/does not prove an on-campus game/);
 assert.equal(g.site,'neutral','site identity is unchanged by inspection');
});
test('game site conflicts cannot be applied to a different gender, season or changed team identity',()=>{
 assert.equal(api.index({...issue,gender:'men'}).size,0);
 assert.equal(api.index({...issue,season:'2025-26'}).size,0);
 assert.equal(api.claims({...g,home_id:'4',away_id:'87'},api.index(issue)).length,0);
 assert.equal(api.claims({...g,neutral:false,site:'home'},api.index(issue)).length,0);
});
test('no postgame quarantine; real completed scores and Elo remain published',()=>{
 assert.equal(api.claims({...g,completed:true,status:'final'},api.index(issue)).length,0);
 assert.equal(api.claims({...g,status:'final'},api.index(issue)).length,0);
});
test('missing, contradictory or non-HTTPS official site claims fail closed',()=>{
 assert.equal(api.index(null).size,0);
 assert.equal(api.index({...issue,games:[{...row,source_url:'javascript:alert(1)'}]}).size,0);
 assert.equal(api.index({...issue,games:[{...row,university_listed_site:'neutral'}]}).size,0);
 assert.equal(api.index({...issue,games:[row,row]}).get(row.game_id).length,1);
});
test('both live and team pages honor site disputes and the current Elo refresh will not restore the forecast',()=>{
 const team=fs.readFileSync('ncaaw-team.html','utf8');
 const front=fs.readFileSync('college-basketball-gender.js','utf8');
 const live=fs.readFileSync('wbb-team-live.js','utf8');
 assert.match(team,/WBBSiteIntegrity\?\.claims\(g,siteDisputes\)/);
 assert.match(team,/Venue review/);
 assert.match(front,/WBBSiteIntegrity\?\.claims\(g,siteDisputes\)/);
 assert.match(front,/home-court forecast withheld/);
 assert.match(live,/WBBSiteIntegrity\?\.claims\(game,siteDisputes\)/);
});

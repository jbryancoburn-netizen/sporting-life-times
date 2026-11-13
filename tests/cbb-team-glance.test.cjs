'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const root=join(__dirname,'..');
const read=p=>readFileSync(join(root,p),'utf8');
const json=p=>JSON.parse(read(p));
const src=read('cbb-team-glance.js');
const exposed=src.replace('(function(){','return (function(){')
  .replace(/\}\)\(\);\s*$/,'return {menResults,womenResults,summary,render};})();');
const getFunctions=(id,women=false,win={})=>{
 const document={body:{dataset:{page:women?'women-team':'team'}},
  readyState:'loading',addEventListener(){}};
 const location={pathname:women?'/ncaaw-team.html':'/ncaam-team.html',
  search:'?team='+encodeURIComponent(id)};
 return new Function('document','window','location','URLSearchParams',exposed)(
  document,win,location,URLSearchParams);
};
const makeWomenWindow=()=>{
 const win={};
 new Function('window',read('wbb-game-results.js'))(win);
 return win;
};
test('both team pages use the Form Book without the redundant season glance',()=>{
 for(const path of ['ncaam-team.html','ncaaw-team.html']){
  assert.doesNotMatch(read(path),/cbb-team-glance\.(css|js)/);
  assert.match(read(path),/cbb-team-form\.css/);
  assert.match(read(path),/cbb-team-form\.js/);
 }
 assert.doesNotMatch(read('wbb-team-newspaper.js'),/CBBTeamGlance/);
});
test('men: 365 glance records reconcile to published overall record audit',()=>{
 const retro=json('data/ncaam-2026-27-retro-primary.json');
 const outside=json('data/mbb-non-di-verified-finals-2026-27.json');
 const records=json('data/mbb-overall-records-2026-27.json');
 assert.equal(retro.rankings.length,365);
 for(const team of retro.rankings){
  const f=getFunctions(team.team_id);
  const summary=f.summary(f.menResults(retro,outside));
  const expected=records.records[team.team_id];
  assert.ok(expected,team.team_id+' missing overall record');
  assert.equal(summary.wins,expected.overall_wins,team.team);
  assert.equal(summary.losses,expected.overall_losses,team.team);
 }
});
test('women: 363 glance records reconcile to published women-only RETRO finals',()=>{
 const schedule=json('data/ncaaw-schedules-2026-27.json');
 const ledger=json('data/ncaaw-2026-27-verified-games.json');
 const retro=json('data/ncaaw-2026-27-retro-primary.json');
 const win=makeWomenWindow();
 assert.equal(retro.rankings.length,363);
 for(const team of retro.rankings){
  const f=getFunctions(team.team_id,true,win);
  const summary=f.summary(f.womenResults(schedule.teams[team.team_id].games,ledger,retro));
  assert.equal(summary.wins,team.wins,team.team);
  assert.equal(summary.losses,team.losses,team.team);
 }
});
test('last five dots and streak distinguish form and ignore postponed games',()=>{
 const f=getFunctions('ncaa:1');
 const summary=f.summary({games:[
  {id:'1',day:'2026-11-01',for:70,against:80,win:false},
  {id:'2',day:'2026-11-02',for:82,against:79,win:true},
  {id:'3',day:'2026-11-03',for:95,against:75,win:true},
  {id:'4',day:'2026-11-04',for:80,against:65,win:true}
 ],ranking:{conference_wins:1,conference_losses:0}});
 assert.equal(summary.streak,'W3');
 assert.equal(summary.wins,3);
 assert.equal(summary.losses,1);
 assert.equal(summary.conference,'1–0');
 assert.equal(summary.ppg,81.75);
 assert.equal(summary.papg,74.75);
 const markup=f.render({games:summary.rows,ranking:{conference_wins:1,conference_losses:0}});
 assert.equal((markup.match(/class="cbb-glance-dot /g)||[]).length,5);
 assert.match(markup,/Current streak/);
 assert.match(markup,/Points against \/ game/);
});

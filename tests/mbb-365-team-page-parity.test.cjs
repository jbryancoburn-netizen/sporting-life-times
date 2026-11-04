/* Sporting Life & Times | Division I men's school-page parity contract.
   Zero-cost regression test: node --test tests/mbb-365-team-page-parity.test.cjs
   The selected school's data may differ, but the source renderer and layout must not. */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const json=p=>JSON.parse(read(p));
const cross=json('data/ncaam-2026-27-espn-team-crosswalk.json').teams;
const ranks=json('data/ncaam-2026-27-retro-primary.json').rankings;
const teamPage=read('ncaam-team.html');
const renderer=read('mbb-team-calendar-boot.js');
const desk=read('mbb-newspaper.js');
const css=read('mbb-big-ten-calendar.css');
const allNames=new Set(cross.map(t=>t.id));
const allEspn=new Set(cross.map(t=>String(t.espn_id)));
const allRated=new Set(ranks.map(t=>t.team_id));
test('365 unique schools share matching independent RETRO identifiers',()=>{
 assert.equal(cross.length,365);
 assert.equal(allNames.size,365);
 assert.equal(allEspn.size,365);
 assert.equal(ranks.length,365);
 assert.equal(allRated.size,365);
 for(const t of cross)assert.ok(allRated.has(t.id),'Rating missing for '+t.name);
});
test('every school has a usable season calendar, roster and school news record',()=>{
 for(const t of cross){
  for(const part of ['mbb-schedules-2026-27','mbb-rosters-2026-27','mbb-team-news']){
   const file='data/'+part+'/'+t.espn_id+'.json';
   assert.ok(fs.existsSync(path.join(__dirname,'..',file)),t.name+' missing '+part);
  }
  const fixture=json('data/mbb-schedules-2026-27/'+t.espn_id+'.json');
  assert.ok(Array.isArray(fixture.events)&&fixture.events.some(e=>e.date&&e.competitions?.[0]?.competitors?.length>=2),t.name+' missing valid game entries');
 }
});
test('the exact same team page and newsroom renderer serve all schools',()=>{
 assert.match(teamPage,/body data-page="team"/);
 assert.match(teamPage,/id="mbb-calendar-host"/);
 assert.match(teamPage,/mbb-team-calendar-boot\.js/);
 assert.match(teamPage,/mbb-newspaper\.js/);
 assert.match(teamPage,/mbb-current-roster\.js/);
 assert.match(teamPage,/mbb-team-season-register\.js/);
 assert.match(desk,/function teamPage\(/);
 assert.match(desk,/teamMap\.get\(params\.get\('team'\)\)/);
 assert.match(desk,/victorian-player-production/);
 assert.match(desk,/slt-sortable-production/);
 assert.match(desk,/The March File/);
});
test('all 365 receive Indiana calendar features, not a Big Ten pilot',()=>{
 assert.doesNotMatch(renderer,/bigTenPilot/);
 assert.match(renderer,/class="panel victorian-team-calendar"/);
 assert.match(renderer,/const expandable=hasScore&&/);
 assert.match(renderer,/victorian-at-game-records/);
 assert.match(renderer,/victorian-conference-game/);
 assert.match(renderer,/victorian-heading-rank/);
 assert.match(renderer,/victorian-heading-school/);
 assert.match(renderer,/victorian-heading-conference/);
 assert.match(renderer,/victorian-stat-toggle/);
 assert.match(renderer,/row\.addEventListener\('click'/);
 assert.match(renderer,/if\(e\.target\.closest\('button, a'\)\)return/);
 assert.match(renderer,/\+result\+gameFile/);
});
test('desktop and mobile use the same framed school calendar and double-ring emblem',()=>{
 assert.match(teamPage,/mbb-big-ten-calendar\.css/);
 assert.match(teamPage,/mbb-logo-system\.js/);
 assert.match(css,/#full-season-schedule\.victorian-team-calendar/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/victorian-opponent-heading\.has-poll-rank/);
 assert.match(css,/\.victorian-heading-conference/);
 assert.match(css,/\.victorian-stat-detail/);
 assert.match(read('mbb-logo-system.js'),/byNCAA:/);
});

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));
const source=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('all 365 Division I men use the same Indiana team-page template',()=>{
 const cross=read('data/ncaam-2026-27-espn-team-crosswalk.json').teams;
 const retro=read('data/ncaam-2026-27-retro-primary.json').rankings;
 assert.equal(cross.length,365);
 assert.equal(new Set(cross.map(t=>t.id)).size,365);
 assert.equal(new Set(cross.map(t=>String(t.espn_id))).size,365);
 assert.equal(new Set(retro.map(t=>t.team_id)).size,365);
 const ratings=new Map(retro.map(t=>[t.team_id,t]));
 assert.equal(new Set(retro.map(t=>t.conference)).size>=30,true);
 for(const team of cross){
  assert.ok(ratings.has(team.id),'No RETRO identity for '+team.name);
  assert.ok(ratings.get(team.id).conference,'No conference for '+team.name);
  const href='ncaam-team.html?team='+encodeURIComponent(team.id);
  assert.match(href,/ncaam-team\.html\?team=/);
 }
 const page=source('ncaam-team.html');
 assert.match(page,/data-page="team"/);
 assert.match(page,/mbb-team-calendar-boot\.js/);
 assert.match(page,/mbb-newspaper\.js/);
 assert.match(page,/mbb-current-roster\.js/);
 assert.match(page,/mbb-team-season-register\.js/);
 assert.match(page,/mbb-logo-system\.js/);
 assert.match(page,/mbb-big-ten-calendar\.css/);
});

test('every school has a usable schedule, roster and attributed news file',()=>{
 const cross=read('data/ncaam-2026-27-espn-team-crosswalk.json').teams;
 for(const team of cross){
  const name=team.name,id=String(team.espn_id);
  for(const segment of ['mbb-schedules-2026-27','mbb-rosters-2026-27','mbb-team-news']){
   const file='data/'+segment+'/'+id+'.json';
   assert.ok(fs.existsSync(path.join(__dirname,'..',file)),name+' missing '+segment);
   const data=read(file);
   assert.equal(data.season,'2026-27',name+' '+segment+' wrong season');
   assert.equal(data.team_id,team.id,name+' '+segment+' is mapped to wrong school');
   if(segment==='mbb-schedules-2026-27'){
    assert.ok(Array.isArray(data.events)&&data.events.length>0,name+' has no schedule');
    assert.ok(data.events.every(e=>e.date&&e.competitions?.[0]?.competitors?.length>=2),name+' has malformed event');
   }else if(segment==='mbb-rosters-2026-27'){
    assert.ok(Array.isArray(data.players)&&data.players.length>0,name+' has no roster');
   }else{
    assert.ok(Array.isArray(data.articles),name+' news articles field missing');
   }
  }
 }
});

test('the Victorian schedule and expandable statistics cannot be Big Ten-only',()=>{
 const calendar=source('mbb-team-calendar-boot.js');
 const styles=source('mbb-big-ten-calendar.css');
 const page=source('ncaam-team.html');
 assert.doesNotMatch(calendar,/bigTenPilot/);
 assert.match(calendar,/const expandable=hasScore&&/);
 assert.match(calendar,/victorian-team-calendar/);
 assert.match(calendar,/victorian-at-game-records/);
 assert.match(calendar,/data-game-site/);
 assert.match(calendar,/if\(e\.target\.closest\('button, a'\)\)return/);
 assert.match(calendar,/const ownConference=conferenceById/);
 assert.match(styles,/@media\(max-width:700px\)/);
 assert.match(styles,/\.slt-mobile-production-tools/);
 assert.match(styles,/\.slt-sortable-production tbody tr\{display:grid/);
 assert.match(page,/cbb-shared-navigation\.js/);
 assert.match(page,/mbb-current-roster\.css/);
});

test('mobile roster and player production use in-screen layouts',()=>{
 const roster=source('mbb-current-roster.css');
 const stats=source('mbb-newspaper.js');
 assert.match(roster,/\.mbb-roster-table tbody tr\{display:grid/);
 assert.match(roster,/\.mbb-roster-table\{display:block;min-width:0;width:100%\}/);
 assert.match(stats,/class="slt-mobile-production-sort"/);
 assert.match(stats,/data-label="/);
 assert.match(stats,/document\.addEventListener\('change'/);
});

test('all 365 men have an exact, two-color double-ring logo identity',()=>{
 const cross=read('data/ncaam-2026-27-espn-team-crosswalk.json').teams;
 const logos=read('data/mbb-logo-registry.json').teams;
 const colors=read('data/dual-ring-team-palette.json').mbb;
 assert.equal(Object.keys(logos).length,365);
 assert.equal(Object.keys(colors).length,365);
 for(const school of cross){
  const id=String(school.espn_id);
  assert.equal(logos[id]?.canonical_id,school.id,school.name+' crest identity');
  assert.equal(logos[id]?.logo_url_verified,true,school.name+' artwork');
  assert.match(colors[id]?.primary||'',/^#[0-9a-f]{6}$/i);
  assert.match(colors[id]?.secondary||'',/^#[0-9a-f]{6}$/i);
  assert.notEqual(colors[id].primary.toLowerCase(),colors[id].secondary.toLowerCase());
 }
});

test('source-backed 1985-2024 history covers 361 programs without inventing records',()=>{
 const cross=read('data/ncaam-2026-27-espn-team-crosswalk.json').teams;
 const report=read('data/mbb-head-to-head-1985/gap-recovery-status.json');
 const archiveDir=path.join(__dirname,'..','data/mbb-head-to-head-1985');
 const archived=cross.filter(t=>fs.existsSync(path.join(archiveDir,t.id.replace(':','-')+'.json')));
 assert.equal(archived.length,report.total_archive_files);
 assert.equal(archived.length,361,'Historical recovery coverage unexpectedly changed');
 assert.deepEqual(
  cross.filter(t=>!archived.includes(t)).map(t=>t.name).sort(),
  ['Mercyhurst','New Haven','West Florida','West Ga.'].sort()
 );
 const recovered=report.reviewed_aliases.filter(t=>t.status==='partial-source-backed');
 assert.equal(recovered.length,13);
 for(const row of recovered){
  const file=read('data/mbb-head-to-head-1985/'+row.team_id.replace(':','-')+'.json');
  assert.equal(file.validated,false);
  assert.equal(file.coverage_status,'PARTIAL_SOURCE_BACKFILL');
  assert.equal(file.games.length,row.games);
  assert.ok(file.games.every(g=>g.home_id===row.team_id||g.away_id===row.team_id),row.team+' mismatched game');
  assert.ok(file.games.every(g=>g.date&&g.source_url&&g.home_score!==g.away_score),row.team+' unverified results');
 }
});

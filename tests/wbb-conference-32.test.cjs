const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),data=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8')),src=p=>fs.readFileSync(path.join(root,p),'utf8');
test('all 363 women map to 32 conferences and women-only ratings',()=>{
 const teams=data('data/ncaaw-2026-27-teams.json').teams,groups=data('data/ncaaw-2026-27-conferences.json');
 const ratings=data('data/ncaaw-2026-27-retro-primary.json');
 assert.equal(teams.length,363);assert.equal(groups.conference_count,32);
 assert.equal(groups.verified_team_count,363);assert.deepEqual(groups.unmatched,[]);
 assert.equal(ratings.gender,'women');assert.equal(ratings.rankings.length,363);
 const seen=new Set(),confs=new Set(),rated=new Set(ratings.rankings.map(t=>String(t.team_id)));
 for(const t of teams){const id=String(t.team_id);assert.ok(!seen.has(id),'Duplicate team '+id);seen.add(id);confs.add(t.conference);
  assert.equal(groups.teams[id].conference,t.conference,'Wrong conference for '+id);
  assert.ok(rated.has(id),'No women-only RETRO rating for '+id);}
 assert.equal(seen.size,363);assert.equal(confs.size,32);
});
test('all conference desks expose season schedules, standings and 363 team-page links',()=>{
 const html=src('ncaaw-conference.html'),script=src('wbb-conference.js'),css=src('wbb-conference.css');
 assert.match(html,/data-page="women-conference"/);assert.match(html,/data-gender="women"/);
 for(const key of ['ncaaw-2026-27-teams.json','ncaaw-2026-27-conferences.json','ncaaw-2026-27-retro-primary.json','ncaaw-schedules-2026-27.json','ncaaw-team.html?team=','wbc-date','363','32'])
  assert.ok(script.includes(key),key);
 assert.match(css,/@media\(max-width:850px\)/);
 assert.match(src('cbb-shared-navigation.js'),/'Conferences':'ncaaw-conference.html'/);
 assert.match(src('college-basketball-gender.js'),/wbb-open-conference/);
 assert.match(src('wbb-team-newspaper.js'),/ncaaw-conference.html\?conference=/);
});
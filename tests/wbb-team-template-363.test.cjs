const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const source=p=>fs.readFileSync(path.join(root,p),'utf8');

test('all 363 women have unique identity, women-only RETRO rating and matching two-ring crest',()=>{
 const directory=read('data/ncaaw-2026-27-teams.json');
 const model=read('data/ncaaw-2026-27-retro-primary.json');
 const logos=read('data/mbb-logo-registry.json').teams;
 const palettes=read('data/dual-ring-team-palette.json').mbb;
 assert.equal(directory.teams.length,363);
 assert.equal(new Set(directory.teams.map(t=>String(t.team_id))).size,363);
 assert.equal(model.gender,'women');
 assert.equal(model.season,'2026-27');
 assert.equal(model.rankings.length,363);
 const byId=new Map(model.rankings.map(t=>[String(t.team_id),t]));
 assert.equal(byId.size,363);
 for(const t of directory.teams){
  const id=String(t.team_id);
  assert.ok(byId.has(id),'Missing women-only RETRO record: '+t.team);
  assert.equal(byId.get(id).team_id,id);
  assert.ok(t.conference,'No women’s conference: '+t.team);
  assert.ok(logos[id]?.logo_url_verified,'No verified double-ring artwork: '+t.team);
  const color=palettes[id];
  assert.ok(color?.primary&&color?.secondary,'No pair of crest colors: '+t.team);
  assert.notEqual(color.primary.toLowerCase(),color.secondary.toLowerCase());
 }
});

test('all women's team URLs load the Indiana-standard renderer and mobile newspaper style',()=>{
 const page=source('ncaaw-team.html');
 const code=source('wbb-team-newspaper.js');
 const css=source('wbb-team-newspaper.css');
 const boxes=source('wbb-game-details.js');
 assert.match(page,/data-page="women-team"/);
 assert.match(page,/data-gender="women"/);
 assert.match(page,/wbb-team-newspaper\.js/);
 assert.match(page,/wbb-team-newspaper\.css/);
 assert.match(page,/wbb-game-details\.js/);
 assert.match(code,/2026–2027 Schedule/);
 assert.match(code,/wbb-game-entry/);
 assert.match(code,/wbb-conference-game/);
 assert.match(code,/wbb-opponent-rank/);
 assert.match(code,/wbb-calendar-search/);
 assert.match(code,/wbb-team-elo/);
 assert.match(code,/wbb-team-record/);
 assert.match(code,/WBBRosterDesk\?\.render/);
 assert.match(code,/WBBTeamStats\?\.render/);
 assert.match(code,/WBBTeamLive\?\.start/);
 assert.match(boxes,/womens-college-basketball\/summary/);
 assert.match(boxes,/competitors\.some/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/wbb-schedule-table>tbody>tr:not\(\.wbb-game-detail\)\{display:grid/);
 assert.match(css,/wbb-stat-block table tbody tr\{display:grid/);
});

test('women's navigation searches the women's actual numeric team IDs',()=>{
 const nav=source('cbb-shared-navigation.js');
 assert.match(nav,/data\/ncaaw-2026-27-teams\.json/);
 assert.match(nav,/ncaaw-team\.html\?team=/);
 assert.match(nav,/ncaaw-rankings\.html/);
 const rank=source('wbb-rankings.js');
 assert.match(rank,/ncaaw-2026-27-retro-primary\.json/);
 assert.match(rank,/ratings\.gender!=='women'/);
 assert.match(rank,/rankings\?\.length!==363/);
 assert.match(rank,/No verified/);
});

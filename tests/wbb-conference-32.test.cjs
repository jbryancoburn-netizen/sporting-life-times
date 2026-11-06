const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const data=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const src=p=>fs.readFileSync(path.join(root,p),'utf8');

test('all 363 women map exclusively to the 32 women-specific conferences and ratings',()=>{
 const teams=data('data/ncaaw-2026-27-teams.json').teams;
 const groups=data('data/ncaaw-2026-27-conferences.json');
 const ratings=data('data/ncaaw-2026-27-retro-primary.json');
 const master=data('data/ncaaw-schedules-2026-27.json');
 assert.equal(teams.length,363);
 assert.equal(groups.conference_count,32);
 assert.equal(groups.verified_team_count,363);
 assert.deepEqual(groups.unmatched,[]);
 assert.equal(ratings.gender,'women');
 assert.equal(ratings.rankings.length,363);
 assert.equal(master.gender,'women');
 assert.equal(Object.keys(master.teams).length,363);
 const seen=new Set(),confs=new Set();
 const rated=new Set(ratings.rankings.map(t=>String(t.team_id)));
 for(const t of teams){
  const id=String(t.team_id);
  assert.ok(!seen.has(id),'Duplicate woman program '+id);
  seen.add(id);confs.add(t.conference);
  assert.equal(groups.teams[id].conference,t.conference,'Wrong conference for '+id);
  assert.ok(rated.has(id),'Missing women-only RETRO '+id);
  assert.ok(master.teams[id], 'Missing season schedule '+id);
 }
 assert.equal(seen.size,363);
 assert.equal(confs.size,32);
});
test('women conference page uses the actual mens Big Ten HTML and styling contracts',()=>{
 const html=src('ncaaw-conference.html'),js=src('wbb-conference.js'),css=src('wbb-conference.css');
 const mens=src('mbb-newspaper.js');
 assert.match(html,/data-page="conference"/);
 assert.match(html,/data-gender="women"/);
 for(const sheet of ['mbb-newspaper.css','slt-heritage-newspaper.css','newspaper-departments.css',
  'slt-victorian-global.css','conference-victorian-seeds.css','conference-scorebug.css',
  'cbb-ledger-scorecard.css']){
  assert.ok(html.includes(sheet),'Missing mens Big Ten style '+sheet);
 }
 for(const token of ['conference-identity','conference-identity-upper','conference-identity-main',
  'conference-identity-meta','metrics','metric','victorian-seed-order','victorian-unified-ledger',
  'conference-ledger-scroll','conference-ledger','ledger-place','ledger-university',
  'ledger-conf-col','ledger-conf-pct-col','ledger-overall-col','ledger-retro-col',
  'ledger-projection-col','conference-editorial-row','conference-news-edition',
  'slt-game-day-picker','conference-game-day','ledger26-card slt-conference-game',
  'slt-fixture-meta','SLTSportsScorebug.render','SLTInlineGamefile.mount',
  'ncaaw-team.html?team=','ncaaw-score-calibration.json']){
  assert.ok(js.includes(token),'Missing Big Ten structural contract '+token);
 }
 assert.ok(mens.includes('victorian-unified-ledger'));
 assert.ok(css.includes('inherit the men'));
 assert.ok(!css.includes('.wbc-table'),'Competing custom grid has returned');
 assert.match(src('cbb-shared-navigation.js'),/'Conferences':'ncaaw-conference.html'/);
 assert.match(src('college-basketball-gender.js'),/wbb-open-conference/);
 assert.match(src('wbb-team-newspaper.js'),/ncaaw-conference.html\?conference=/);
});

test('all 32 conference pages render the ten-column men-style ledger with all member schools',async()=>{
 const vm=require('node:vm');
 const roster=data('data/ncaaw-2026-27-teams.json').teams;
 const groups=data('data/ncaaw-2026-27-conferences.json');
 const rating=data('data/ncaaw-2026-27-retro-primary.json');
 const schedule=data('data/ncaaw-schedules-2026-27.json');
 const script=src('wbb-conference.js');
 const dataset={
  'data/ncaaw-2026-27-teams.json':{season:'2026-27',teams:roster},
  'data/ncaaw-2026-27-conferences.json':groups,
  'data/ncaaw-2026-27-retro-primary.json':rating,
  'data/ncaaw-schedules-2026-27.json':schedule
 };
 const fetch=async url=>({ok:!!dataset[url],status:dataset[url]?200:404,json:async()=>dataset[url]});
 const confs=[...new Set(roster.map(t=>t.conference))];
 for(const conference of confs){
  const app={innerHTML:''},stamp={textContent:''};
  let input,gameHost;
  const document={
   getElementById(id){
    if(id==='app')return app;
    if(id==='data-stamp')return stamp;
    if(id==='conference-game-day'){
     if(!input)input={value:(app.innerHTML.match(/id="conference-game-day" value="([^"]+)"/)||[])[1],addEventListener(){}};
     return input;
    }
    if(id==='conference-day-games'){
     if(!gameHost)gameHost={innerHTML:''};
     return gameHost;
    }
    return null;
   },
   addEventListener(){}
  };
  const calls=[];
  const window={
   MBBLogos:{ready:Promise.resolve(),byESPN:(id)=>'<img alt="" data-school="'+id+'">',
    colorForESPN:()=>({primary:'#664422'})},
   SLTSportsScorebug:{render:g=>{calls.push(g);return '<div class="ledger26-scorebug"></div>';},
    formatRetro:t=>'RETRO '+Math.round(t.elo)},
   WBBRetroForecast:{forecast:()=>null}
  };
  const ctx={document,window,fetch,console,URLSearchParams,Date,Intl};
  ctx.location={search:'?conference='+encodeURIComponent(conference)};
  await vm.runInNewContext(script,ctx,{filename:'wbb-conference.js',timeout:20000});
  const members=roster.filter(t=>t.conference===conference);
  assert.ok(app.innerHTML.includes('<h1>'+conference+'</h1>'),conference);
  assert.equal((app.innerHTML.match(/<th>/g)||[]).length,10,'Ten ledger headings '+conference);
  assert.equal((app.innerHTML.match(/<tbody><tr>/g)||[]).length,1,conference);
  assert.equal((app.innerHTML.match(/class="ledger-university"/g)||[]).length,members.length,conference);
  assert.equal((app.innerHTML.match(/class="metric"/g)||[]).length,4,conference);
  assert.ok(app.innerHTML.includes('class="grid two conference-editorial-row"'),conference);
  assert.ok(app.innerHTML.includes('class="panel conference-news-edition"'),conference);
  assert.ok(gameHost&&typeof gameHost.innerHTML==='string',conference);
  assert.ok(!app.innerHTML.includes('Women’s conference desk unavailable'),conference);
 }
});

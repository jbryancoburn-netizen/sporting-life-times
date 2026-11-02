/* CI: functional college basketball slate, sourced and gender-isolated. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const slate=require('../ncaam-slate.js');
const json=path=>JSON.parse(fs.readFileSync(path,'utf8'));
const html=fs.readFileSync('ncaam-slate.html','utf8');
const css=fs.readFileSync('ncaam-slate.css','utf8');
const script=fs.readFileSync('ncaam-slate.js','utf8');
for(const id of ['slate-root','sl-prev','sl-next','sl-picker','sl-games','sl-search','sl-filters','sl-more','sl-reload','sl-women','sl-men','sl-count'])
  assert(html.includes('id="'+id+'"'),'missing real control '+id);
assert(html.includes('ncaam-slate.js')&&html.includes('ncaam-slate.css'));
assert(css.includes('@media(max-width:700px)'),'mobile-first responsive layout missing');
assert(css.includes('.sl-featured'),'featured editorial game layout missing');
assert(script.includes('setInterval('),'live refresh missing');
const cross=json('data/ncaam-2026-27-espn-team-crosswalk.json');
assert.equal(cross.teams.length,365);
const ratings=json('data/ncaam-2026-27-retro-primary.json');
assert.equal(ratings.starting_elo,1500);
assert.equal(ratings.model,'retro-clean-slate');
assert.equal(ratings.rankings.length,365);
const feed=json('data/mbb-live.json'),forecast=json('data/ncaam-2026-27-upcoming-forecasts.json');
const men=slate.normalizeMen(feed,forecast,cross);
assert(men.length>0,'current men scoreboard missing');
assert(men.every(g=>g.away&&g.home&&g.away.id!==g.home.id),'duplicate or missing teams');
const publishedDay=slate.isoDate(feed.games[0].date);
const dated=men.filter(g=>g.day===publishedDay);
assert(dated.length>0,'day selector must reveal source-published games');
const game=men.find(g=>g.id==='401921422');
if(game){
 assert(game.away.id==='2771'&&game.home.id==='2026',
   'Merrimack away / App State home must not be reversed');
 assert(game.away.name==='Merrimack'&&game.home.name==='App State');
 assert(slate.gameDetailsHref(game,false).includes('401921422'));
}
assert(men.filter(g=>g.phase==='upcoming').every(g=>g.away.score===null&&g.home.score===null),
  'pregame games must not show fabricated scores');
const scheduled=men.filter(g=>g.probability!==null);
assert(scheduled.every(g=>g.phase==='upcoming'),'pre-game forecast cannot become a live score');
const exhibitData=json('data/mbb-exhibition-finals-2026-27.json');
assert.equal(exhibitData.retro_included,false);
const exhibitions=slate.normalizeExhibitions(exhibitData,cross);
assert(exhibitions.length>=100,'sourced exhibition ledger not connected');
assert(exhibitions.every(g=>g.kind==='exhibition'&&g.phase==='final'));
assert(exhibitions.every(g=>!slate.gameDetailsHref(g,false).startsWith('cbb-gamefile.html')),
  'exhibitions must link to source, not a regular-season Gamefile');
assert.equal(slate.selectGames(exhibitions,'2026-10-17','live','',new Set()).length,0);
assert(slate.selectGames(exhibitions,'2026-10-17','exhibition','',new Set()).length>0);
const first=dated[0];
assert(slate.selectGames(men,publishedDay,'all',first.away.name,new Set()).some(g=>g.away.id===first.away.id));
assert(slate.selectGames(men,publishedDay,'favorites','',new Set([first.away.id])).every(g=>g.away.id===first.away.id||g.home.id===first.away.id));
assert(slate.selectGames(men,publishedDay,'all','',new Set()).length>0);
assert.equal(slate.shift('2026-11-02',-1),'2026-11-01');
assert.equal(slate.shift('2026-11-02',1),'2026-11-03');
const wbr=json('data/ncaaw-2026-27-retro-primary.json');
assert.equal(wbr.gender,'women');assert.equal(wbr.starting_elo,1500);
const women=slate.normalizeWomen(json('data/ncaaw-2026-27-games.json'),wbr,cross);
assert(women.length>0,'women edition missing');
assert(women.some(g=>g.day===women[0].day),'women published date must render');
assert(women.every(g=>g.kind!=='exhibition'),'women/men exhibition ledger contamination');
const wfinal=women.find(g=>g.id==='401920983');
if(wfinal){
 assert(wfinal.away.id==='87'&&wfinal.home.id==='222'&&wfinal.away.score===99,
   'women game result identity not preserved');
 assert(slate.gameDetailsHref(wfinal,true).includes('gender=women'));
}
const fixture={id:'4444444',date:'2026-11-02T18:00Z',state:'pre',teams:[
 {id:'2771',name:'Merrimack Warriors',score:'0'},
 {id:'2026',name:'App State Mountaineers',score:'0'}]};
const badForecast={games:[{id:'espn:4444444',date:'2026-11-02',
  away_id:'ncaa:609574',home_id:'ncaa:609673',home_win_probability:.77}]};
const mismatched=slate.normalizeMen({games:[fixture]},badForecast,cross);
assert.equal(mismatched[0].probability,null,'disputed matchup cannot receive a false model forecast');
console.log('PASS NCAA slate: interactive controls, 365-school identity, sourced scores, 1500 RETRO, men/women separation, search/date, sourced exhibition exclusions.');

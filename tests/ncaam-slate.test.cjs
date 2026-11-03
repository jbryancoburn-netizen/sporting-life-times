'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const script=fs.readFileSync('ncaam-slate.js','utf8'),css=fs.readFileSync('ncaam-slate.css','utf8'),html=fs.readFileSync('ncaam-slate.html','utf8');
const slate=require('../ncaam-slate.js'),json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
assert.doesNotThrow(()=>new vm.Script(script));
for(const id of ['slate-root','sl-prev','sl-next','sl-picker','sl-games','sl-search','sl-filters','sl-more','sl-reload','sl-women','sl-men','sl-count'])assert(html.includes('id="'+id+'"'),id);
assert(html.includes('ncaam-slate.js?v='), 'versioned slate JS must be linked');
assert(html.includes('ncaam-slate.css?v='), 'versioned slate CSS must be linked');
assert(!html.includes('cbb-broadcast-v2.css')&&!html.includes('ncaam-mobile-scoreboard.css'));
assert(script.includes('function card(g,featured)')&&script.includes('sl-bug-pair'));
assert(!script.includes('sl-arena-stage')&&!script.includes('sl-pennant')&&!script.includes('TO — · CH —'));
assert(!css.includes('sl-arena-stage')&&!css.includes('sl-pennant'));
const cross=json('data/ncaam-2026-27-espn-team-crosswalk.json'),ratings=json('data/ncaam-2026-27-retro-primary.json'),feed=json('data/mbb-live.json');
assert.equal(cross.teams.length,365);assert.equal(ratings.starting_elo,1500);
const men=slate.normalizeMen(feed,json('data/ncaam-2026-27-upcoming-forecasts.json'),cross);
assert(men.length>0&&men.every(g=>g.away&&g.home&&g.away.id!==g.home.id));
assert(men.filter(g=>g.phase==='upcoming').every(g=>g.away.score===null&&g.home.score===null));
const ex=json('data/mbb-exhibition-finals-2026-27.json'),exh=slate.normalizeExhibitions(ex,cross);
assert.equal(ex.retro_included,false);assert(exh.length>=100);
assert(exh.every(g=>!slate.gameDetailsHref(g,false).startsWith('cbb-gamefile.html')));
const w=json('data/ncaaw-2026-27-retro-primary.json');assert.equal(w.rankings.length,363);
console.log('PASS new source-backed court UI, no theatrical arena/pennant placeholders');

// Independent official game-site certification stays in the release gate.
require('./mbb-verified-game-sites.test.cjs');

assert(!html.includes('cbb-product-v1.css')&&!html.includes('ncaam-slate-mobile-legibility.css'));
assert(html.includes('class="sl-masthead masthead"'), 'brand globe must initialize on the slate masthead');
assert(!html.includes('class="sl-hero"'), 'scoreboard must appear without a decorative 135px hero');
assert(css.includes('.sl-day-picker input[type=date]')&&css.includes('opacity:0!important'),'native iOS month text must not leak into date');
assert(script.includes("weekday:'short',month:'short'"), 'abbreviated mobile date required');

const scheduled={id:'401999999',day:'2026-11-03',phase:'upcoming',kind:'regular',
 date:'',timed:false,away:{id:'1',name:'Example Away',score:null},
 home:{id:'2',name:'Example Home',score:null}};
const evt=(aid='1',hid='2',date='2026-11-03T23:00:00Z',state='pre',a='',h='')=>({
 id:'401999999',date,status:{type:{state,shortDetail:state==='in'?'12:13 - 1st':'Scheduled'}},
 competitions:[{competitors:[{homeAway:'away',team:{id:aid},score:a},
 {homeAway:'home',team:{id:hid},score:h}]}]
});
const verified=slate.applyESPNToSlate([scheduled],{events:[evt()]},'2026-11-03');
assert.equal(verified.changes,1);assert.equal(verified.games[0].timed,true);
assert.equal(verified.games[0].date,'2026-11-03T23:00:00Z');
assert.equal(verified.games[0].phase,'upcoming');
assert.equal(slate.applyESPNToSlate([scheduled],{events:[evt('99','2')]},'2026-11-03').changes,0);
assert.equal(slate.applyESPNToSlate([scheduled],{events:[evt('1','2','2026-11-04T23:00:00Z')]},'2026-11-03').changes,0);
const live=slate.applyESPNToSlate([scheduled],{events:[evt('1','2','2026-11-03T23:00:00Z','in','22','24')]},'2026-11-03').games[0];
assert.equal(live.phase,'live');assert.equal(live.home.score,24);
assert.equal(live.away.score,22);
const final={...scheduled,phase:'final',away:{...scheduled.away,score:69},home:{...scheduled.home,score:65}};
assert.equal(slate.applyESPNToSlate([final],{events:[evt('1','2','2026-11-03T23:00:00Z','in','77','77')]},'2026-11-03').games[0].away.score,69);

const official={games:{'2026-11-03|2747|2633':{
 arena:'Food City Center',city:'Knoxville',state:'TN',neutral:false,
 source:'https://utsports.com/sports/mens-basketball/schedule/2026-27'}}};
const opponent={kind:'regular',id:'401906848',day:'2026-11-03',away:{id:'2747'},
 home:{id:'2633'},venue:'',venueCity:'',neutral:false};
const site=slate.courtLocation(opponent,official);
assert.equal(site.arena,'Food City Center');assert.equal(site.city,'Knoxville, TN');
assert.equal(slate.courtLocation({...opponent,away:{id:'999'}},official),null);
assert.equal(slate.courtLocation({...opponent,venue:'Other Arena'},official).city,'');
assert.equal(slate.courtLocation({...opponent,kind:'exhibition'},official),null);
assert(script.includes('data/mbb-slate-game-sites-2026-27.json'));
assert(script.includes('sl-site-arena')&&script.includes('sl-site-city'));
assert(css.includes('.sl-site-arena')&&css.includes('.sl-site-city'));

const venueEvent=(name,city,state)=>({id:'401906848',date:'2026-11-03T23:00:00Z',
 status:{type:{state:'pre'}},competitions:[{venue:{fullName:name,address:{city,state}},
 competitors:[{homeAway:'away',team:{id:'2747'}},{homeAway:'home',team:{id:'2633'}}]}]});
const matched=slate.applyESPNToSlate([{...opponent,phase:'upcoming'}],
 {events:[venueEvent('Food City Center','Knoxville','TN')]},'2026-11-03',official);
assert.equal(matched.games[0].venueCity,'Knoxville, TN');
assert.equal(matched.games[0].venue,'');
const contradicted=slate.applyESPNToSlate([{...opponent,phase:'upcoming'}],
 {events:[venueEvent('Wrong Venue','Wrong City','ZZ')]},'2026-11-03',official);
assert.equal(contradicted.games[0].venueCity,'');
assert(script.includes("'data/mbb-slate-game-sites-2026-27.json']);"),'cache game-site index');

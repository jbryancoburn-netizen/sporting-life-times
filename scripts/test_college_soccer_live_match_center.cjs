/* Runtime smoke test: a live-only NCAA game must not open a broken match centre. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('college-soccer-match.js','utf8');
class El {
 constructor(tag='div'){this.tag=tag;this.children=[];this.className='';this.style={setProperty:()=>{}};this.attributes={};this.textContent='';}
 append(...items){this.children.push(...items);for(const i of items)if(i && typeof i==='object')i.parent=this;}
 replaceChildren(...items){this.children=[];this.append(...items)}
 setAttribute(name,value){this.attributes[name]=value}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this)}
 addEventListener(){}
 get childNodes(){return this.children}
}
const find=(el,cls)=>el.className?.split(' ').includes(cls)?[el]:el.children.flatMap(x=>find(x,cls));
const treeText=n=>[n.textContent||'',...n.children.map(treeText)].join(' ');
async function caseRun(status){
 const root=new El();
 const id='women-6999999';
 const feed={checked_at_utc:new Date().toISOString(),games:[{match_id:id,cohort:'women-d1',status,
  home_name:'Home University',away_name:'Away University',home_id:'home-u',away_id:'away-u',
  away_score:1,home_score:0,period:status==='live'?'1ST HALF':'FINAL',
  source_url:'https://www.ncaa.com/game/6999999'}]};
 const teams=[{team_id:'away-u',team:'Away University',record:'4-1-1',elo:1575,gp:0},
              {team_id:'home-u',team:'Home University',record:'2-2-0',elo:1460,gp:0}];
 const data={
  'college-soccer-elo-final-ledger.json':{results:[]},
  'college-soccer-prospective-v2.json':{forecasts:[]},
  'college-soccer-elo.json':{cohorts:{'women-d1':teams}},
  'college-soccer-team-branding.json':{teams:{}},
  'college-soccer-team-game-index.json':{teams:{}},
  'college-soccer-live-scores.json':feed,
  'dual-ring-team-palette.json':{soccer:{}},
  'college-soccer-crest-overrides.json':{schools:{}}
 };
 const intervals=[];
 const env={document:{getElementById:x=>x==='cs-match-view'?root:null,createElement:t=>new El(t),visibilityState:'visible'},
  location:{search:'?game='+id},URLSearchParams,Date,Number,String,Math,RegExp,encodeURIComponent,
  setInterval:(cb,ms)=>intervals.push({cb,ms}),
  console:{error:(...msg)=>{throw Error('Match page crashed: '+msg.join(' '))}},
  fetch:async path=>({ok:true,json:async()=>data[path.split('/').at(-1).split('?')[0]]})};
 vm.runInNewContext(source,env,{timeout:2000});
 await new Promise(resolve=>setTimeout(resolve,30));
 assert(!find(root,'cs-match-hero').length===false,'Live-only game must render match hero');
 const head=find(root,'cs-match-hero')[0],hero=head.children;
 assert.equal(hero.length,3);
 assert.equal(find(head,'cs-match-school').length,2);
 assert(treeText(hero[0]).includes('Away University'),'Away school must be first');
 assert(treeText(hero[2]).includes('Home University'),'Home school must be second');
 assert(treeText(find(root,'cs-match-score')[0]).includes('1 – 0'),'Score must list away tally first');
 assert(treeText(root).includes(status==='live'?'● LIVE':'AWAITING ELO RECONCILIATION'));
 assert(!treeText(root).includes('NCAA match unavailable'));
 assert(!treeText(root).includes('VERIFIED ELO FINAL'));
 assert(intervals.some(x=>x.ms===60000),'Source-backed game score must update each minute');
 // Same fixture changes from live to final without a reload or an invented Elo certification.
 if(status==='live'){
  data['college-soccer-live-scores.json']={checked_at_utc:new Date().toISOString(),games:[{...feed.games[0],status:'final',home_score:2,away_score:1,period:'FINAL'}]};
  await intervals.find(x=>x.ms===60000).cb();
  assert(treeText(find(root,'cs-match-score')[0]).includes('1 – 2'));
  assert(treeText(root).includes('AWAITING ELO RECONCILIATION'));
 }
}
(async()=>{await caseRun('live');await caseRun('final');console.log('PASS: Live-only match URLs, away-first order, updated source scores and distinct Elo final states.')})().catch(err=>{console.error(err);process.exitCode=1});

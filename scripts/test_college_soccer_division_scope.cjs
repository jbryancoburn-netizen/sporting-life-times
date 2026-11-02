/* Regression: one top-level edition switch must strictly isolate live/final scores. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('college-soccer-pulse.js','utf8');
const codes=['men-d1','women-d1','men-d2','women-d2','men-d3','women-d3'];
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.events={};this.className='';this.textContent='';this.attributes={};this.naturalWidth=0;this.style={setProperty:()=>{}};this.classList={
  add:x=>this.className=[...new Set([...this.className.split(' ').filter(Boolean),x])].join(' '),
  remove:x=>this.className=this.className.split(' ').filter(v=>v!==x).join(' '),
  contains:x=>this.className.split(' ').includes(x)
 };}
 append(...children){this.children.push(...children);for(const n of children)if(n&&typeof n==='object')n.parent=this;}
 replaceChildren(...children){this.children=[];this.append(...children)}
 setAttribute(k,v){this.attributes[k]=v}
 addEventListener(k,fn){this.events[k]=fn}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this)}
 set src(v){this.source=v}
 get src(){return this.source}
}
const find=(e,cls)=>e.className.split(' ').includes(cls)?[e]:e.children.flatMap(x=>find(x,cls));
const text=e=>[e.textContent,...e.children.map(text)].join(' ');
const cohorts=Object.fromEntries(codes.map(c=>[c,[
 {team:'HOME EXACT '+c.toUpperCase(),team_id:'home-'+c,elo:1501,record:'1-0',rank:1},
 {team:'AWAY EXACT '+c.toUpperCase(),team_id:'away-'+c,elo:1499,record:'0-1',rank:2}
]]));
const games=codes.map((cohort,i)=>({cohort,match_id:(cohort.startsWith('men')?'men-':'women-')+(6999000+i),
 away_name:'AWAY EXACT '+cohort.toUpperCase(),home_name:'HOME EXACT '+cohort.toUpperCase(),
 away_id:'',home_id:'',away_score:i,home_score:2,status:'live'}));
const finals=games.map((g,i)=>({match_id:g.match_id,cohort:g.cohort,away:g.away_name,home:g.home_name,date:'2026-11-01',score:'2-'+i}));
const data={
 'college-soccer-elo.json':{cohorts,latest_finals:finals,as_of:'2026-11-01'},
 'college-soccer-live-scores.json':{checked_at_utc:new Date().toISOString(),games},
 'college-soccer-team-branding.json':{teams:{}},
 'college-soccer-prospective-v2.json':{forecasts:[]},
 'dual-ring-team-palette.json':{soccer:{}},
 'college-soccer-crest-overrides.json':{schools:{}}
};
let chosen='men-d1';const listeners=new Map(),root=new Element('section');
const global={
 CollegeSoccerEdition:{get:()=>chosen,set:code=>{chosen=code;listeners.get('college-soccer:edition')?.({detail:{cohort:code}})}},
 addEventListener:(name,cb)=>listeners.set(name,cb),
 location:{href:'https://example.com/college-soccer.html',search:''},
 history:{replaceState:()=>{}}
};
const ctx={
 document:{getElementById:id=>id==='cs-current-scoreboard'?root:null,createElement:tag=>new Element(tag),visibilityState:'visible'},
 window:global,URL,URLSearchParams,Date,Number,String,Math,RegExp,Intl,encodeURIComponent,
 setInterval:()=>{},console,
 fetch:async path=>({ok:true,json:async()=>data[path.replace('data/','').split('?')[0]]})
};
function assertScope(code,kind){
 const cards=find(root,'cs-pitch-match');
 assert.equal(cards.length,1,'Exactly one '+kind+' game for '+code);
 assert.equal(find(root,'cs-pitch-division-tab').length,0,'Do not duplicate the global selector inside the scoreboard');
 assert(cards[0].href.includes(games[codes.indexOf(code)].match_id),'Wrong match ID for '+code);
 const shown=text(cards[0]);
 assert(shown.includes('EXACT '+code.toUpperCase()),'Selected cohort absent: '+code);
 for(const other of codes.filter(c=>c!==code))
  assert(!shown.includes('EXACT '+other.toUpperCase()),'Cross-division score leakage: '+other+' into '+code);
 for(const side of find(cards[0],'cs-pitch-side')){
  const img=side.children[0]?.children[0]?.children?.find(e=>e.tag==='img');
  assert(img,'Team ID should resolve from Elo and produce a crest candidate for '+code);
 }
}
async function run(){
 vm.runInNewContext(src,ctx,{timeout:1500});
 await new Promise(resolve=>setTimeout(resolve,60));
 assertScope('men-d1','live');
 for(const code of codes){global.CollegeSoccerEdition.set(code);assertScope(code,'live')}
 find(root,'cs-pitch-tab')[1].events.click();
 assertScope('women-d3','verified final');
 assert(text(root).includes('LATEST FINALS'));
 console.log('PASS: all six unified NCAA editions isolate verified finals and live matches with resolved crest IDs.');
}
run().catch(e=>{console.error(e);process.exitCode=1});

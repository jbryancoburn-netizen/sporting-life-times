/* Prevent D-II/D-III matches from leaking into D-I soccer scoreboard panels. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('college-soccer-pulse.js','utf8');
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.events={};this.className='';this.textContent='';this.style={setProperty:()=>{}};this.classList={add:()=>{},remove:()=>{}};this.attributes={};}
 append(...nodes){this.children.push(...nodes);for(const n of nodes){if(n&&typeof n==='object')n.parent=this;}}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 setAttribute(k,v){this.attributes[k]=v;}
 addEventListener(k,fn){this.events[k]=fn}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this)}
}
const find=(root,name)=>root.className.split(/\s+/).includes(name)?[root]:root.children.flatMap(n=>find(n,name));
const content=root=>[root.textContent,...root.children.map(content)].join(' ');
const codes=['men-d1','women-d1','men-d2','women-d2','men-d3','women-d3'];
const names=Object.fromEntries(codes.map((k,i)=>[k,'EXACT '+k.toUpperCase()]));
const games=codes.map((cohort,index)=>({cohort,match_id:(cohort.startsWith('men')?'men-':'women-')+(6999000+index),
  home_name:'HOME '+names[cohort],away_name:'AWAY '+names[cohort],
  home_id:'h-'+cohort,away_id:'a-'+cohort,home_score:index,away_score:0,
  status:'live',source_url:'https://www.ncaa.com/game/'+(6999000+index)}));
const finals=codes.map((cohort,index)=>({...games[index],date:'2026-11-01',home:'HOME FINAL '+names[cohort],away:'AWAY FINAL '+names[cohort],
 score:index+'-0',status:'final'}));
const data={
 'college-soccer-elo.json':{cohorts:{'men-d1':[{team:'Leader',team_id:'leader',elo:1600,record:'9-1'}]},latest_finals:finals,as_of:'2026-11-01'},
 'college-soccer-live-scores.json':{checked_at_utc:new Date().toISOString(),games},
 'college-soccer-team-branding.json':{teams:{}},
 'college-soccer-prospective-v2.json':{forecasts:[]},
 'dual-ring-team-palette.json':{soccer:{}},
 'college-soccer-crest-overrides.json':{schools:{}}
};
const root=new Element('section'),uri={href:'https://example.org/college-soccer.html',search:''};
const win={location:uri,history:{replaceState(_,__,value){uri.href='https://example.org'+value;uri.search=new URL(uri.href).search}}};
const ctx={document:{getElementById:id=>id==='cs-current-scoreboard'?root:null,createElement:t=>new Element(t),visibilityState:'visible'},
  window:win,URLSearchParams,URL,Date,Number,String,Math,RegExp,Intl,encodeURIComponent,
  setInterval:()=>0,console,
  fetch:async path=>({ok:true,json:async()=>data[path.replace(/^data\//,'').split('?')[0]]})};
function assertNoLeak(expected,kind){
 const cards=find(root,'cs-pitch-match');
 assert.equal(cards.length,1,'Expected exactly one '+kind+' card in '+expected);
 assert(cards[0].href.includes(encodeURIComponent(games[codes.indexOf(expected)].match_id)),'Wrong source match for '+expected);
 const text=content(cards[0]);
 assert(text.includes(names[expected]),'Expected '+expected+' team is absent');
 for(const other of codes.filter(c=>c!==expected))assert(!text.includes(names[other]),other+' leaked into '+expected);
 const count=find(root,'cs-pitch-count')[0];
 assert(count,'Live badge missing');
 assert.equal(find(root,'cs-pitch-division-tab').length,6,'Six distinct scoped editions must be selectable');
 const selected=find(root,'cs-pitch-division-tab').filter(b=>b.attributes['aria-pressed']==='true');
 assert.equal(selected.length,1);
 assert(selected[0].textContent.includes('D'+expected.at(-1)),'Division selector out of sync');
}
async function run(){
 vm.runInNewContext(src,ctx,{timeout:1000});
 await new Promise(resolve=>setTimeout(resolve,40));
 assertNoLeak('men-d1','live');
 for(const cohort of codes){
   const tabs=find(root,'cs-pitch-division-tab');
   const index=codes.indexOf(cohort);
   tabs[index].events.click();
   assertNoLeak(cohort,'live');
 }
 // 'LATEST FINALS' must respect the same exact cohort boundary.
 const finalTab=find(root,'cs-pitch-tab')[1];
 finalTab.events.click();
 assertNoLeak('women-d3','verified final');
 assert(content(root).includes('LATEST FINALS'));
 assert.equal(uri.search,'?cohort=women-d3');
 console.log('PASS: six isolated NCAA soccer divisions, live source, final results and deep-link scope.');
}
run().catch(e=>{console.error(e);process.exitCode=1});

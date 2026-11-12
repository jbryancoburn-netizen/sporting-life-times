/* Dynamic Game Center regression: real provider changes, failover, stale labels,
   unchanged on provider outage and no invented player tracking. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const script=fs.readFileSync('slt-victorian-live.js','utf8');
const html=fs.readFileSync('live-game.html','utf8');
assert(script.includes('async function liveScoreboard()'),'Direct scoreboard fallback missing');
assert(script.includes('function normalizePublishedMBB(data)'),'Published source fallback missing');
assert(script.includes('sourceTier'),'Source provenance must be displayed');
assert(script.includes('vld-court-update--fresh'),'Actual event changes must animate an on-court notice');
assert(!script.includes('simulated player coordinates'),'Source-less player tracking must not be introduced');
const flush=async()=>{for(let i=0;i<200;i++)await Promise.resolve();};
function create(league,id){
 const records=new Map(), calls=[];
 const element=k=>{
  if(!records.has(k))records.set(k,{innerHTML:'',textContent:'',href:'',events:{},
   addEventListener(e,f){this.events[e]=f;},querySelectorAll(){return[];}});
  return records.get(k);
 };
 const document={hidden:false,getElementById:element,querySelectorAll(){return[];},addEventListener(){}};
 const state={score:52,failSummary:false,failBoard:false,failPublished:false,delayMinutes:0,mode:'in'};
 const competitors=()=>[
  {homeAway:'away',team:{id:league==='nba'?'1610612739':'219',abbreviation:league==='nba'?'CLE':'PENN',
   displayName:league==='nba'?'Cleveland Cavaliers':'Pennsylvania Quakers'},score:String(state.score)},
  {homeAway:'home',team:{id:league==='nba'?'1610612752':'2426',abbreviation:league==='nba'?'NYK':'NAVY',
   displayName:league==='nba'?'New York Knicks':'Navy Midshipmen'},score:'61'}
 ];
 const status=()=>({type:{state:state.mode,shortDetail:'4:15 - 2nd'}});
 const current=()=>({header:{id,competitions:[{id,date:new Date().toISOString(),status:status(),
  competitors:competitors()}]},
  plays:[{id:'1',period:{number:2},clock:{displayValue:'4:16'},text:'A reported jump shot',
   awayScore:52,homeScore:61}],boxscore:{teams:[],players:[]}});
 const event=()=>({id,date:new Date().toISOString(),status:status(),competitions:[{id,competitors:competitors()}]});
 const published=()=>({scores_updated_at:new Date(Date.now()-state.delayMinutes*60000).toISOString(),
  games:[{id,date:new Date().toISOString(),state:state.mode,status:'4:15 - 2nd',
   teams:[{id:'219',name:'Pennsylvania Quakers',score:String(state.score)},
    {id:'2426',name:'Navy Midshipmen',score:'61'}]}]});
 const fetch=async url=>{
  calls.push(url);
  if(url.includes('/summary?')){
   if(state.failSummary)throw Error('summary disconnected');
   return {ok:true,json:async()=>current()};
  }
  if(url.includes('/scoreboard?')){
   if(state.failBoard)throw Error('scoreboard disconnected');
   return {ok:true,json:async()=>({events:[event()]})};
  }
  if(url.includes('data/mbb-live.json')){
   if(state.failPublished)throw Error('published scoreboard disconnected');
   return {ok:true,json:async()=>published()};
  }
  return {ok:true,json:async()=>({season:'2026-27',predictions:[]})};
 };
 const window={location:{pathname:'/sporting-life-times/live-game.html',search:'?league='+league+'&game='+id},
  MBBLogos:{ready:Promise.resolve(true),render:()=>'<span class="mbb-mark" data-ring-count="2"></span>'},
  SLTScorebug:{color:()=> '#860038'}};
 const context={document,window,location:window.location,fetch,URLSearchParams,Intl,Date,
  setInterval:()=>1,setTimeout:()=>1,clearTimeout:()=>{},AbortController,console:{warn:()=>{}}};
 vm.runInNewContext(script,context,{filename:'slt-victorian-live.js'});
 const refresh=async()=>{element('vld-reload').events.click();await flush();};
 return {state,element,calls,refresh};
}
for(const league of ['ncaam','ncaaw','nba']){
 const id=league==='ncaam'?'401921181':league==='ncaaw'?'401906033':'401909903';
 const app=create(league,id);
 await flush();
 assert.match(app.element('vld-status').textContent,/LIVE · ESPN game summary/,
  league+': direct summary must render');
 assert(app.element('vld-main').innerHTML.includes('>52</b>'),league+': opening score');
 app.state.score=54;
 await app.refresh();
 assert(app.element('vld-main').innerHTML.includes('>54</b>'),league+': live score should refresh');
 assert(app.element('vld-main').innerHTML.includes('vld-court-update--fresh'),
  league+': court should react when an authenticated score changes');
 app.state.failSummary=true;
 app.state.score=56;
 await app.refresh();
 assert.match(app.element('vld-status').textContent,/ESPN live scoreboard/,
  league+': secondary live provider should replace failed summary');
 assert(app.element('vld-main').innerHTML.includes('>56</b>'),league+': scoreboard score should update');
 if(league==='ncaam'){
  app.state.failBoard=true;app.state.score=57;app.state.delayMinutes=0;
  await app.refresh();
  assert.match(app.element('vld-status').textContent,/PUBLISHED SNAPSHOT/,
   'The last-resort source must be identified, not presented as a direct live API');
  assert(app.element('vld-main').innerHTML.includes('>57</b>'),'Published source must update scores');
  app.state.score=58;app.state.delayMinutes=15;
  await app.refresh();
  assert.match(app.element('vld-status').textContent,/LAST KNOWN · not current/,
   'Old published feed must not be misrepresented as current live data');
  assert(app.element('vld-main').innerHTML.includes('LAST KNOWN · NOT LIVE'),
   'A stale scoreboard must not use the LIVE dispatch headline');
  app.state.failPublished=true;
  await app.refresh();
  assert.match(app.element('vld-status').textContent,/Feed unavailable/,
   'Complete outage must report unavailability');
  assert(app.element('vld-main').innerHTML.includes('>58</b>'),
   'Complete outage must retain the last sourced game, never invent a new one');
 }
}
assert(html.includes('slt-victorian-live.js?'),'Game page script is missing');
console.log('PASS: men, women and NBA live score changes, verified event notices, ESPN scoreboard fallback, cached-source freshness and outages');

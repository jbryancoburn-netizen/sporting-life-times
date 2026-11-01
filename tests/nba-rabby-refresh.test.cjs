const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {runInNewContext}=require('node:vm');
const scorer=require('../nba-rabby-possession.js');
const base='file://'+__filename;
const src=readFileSync(new URL('../nba-rabby-forecast.js',base),'utf8');
const load=p=>JSON.parse(readFileSync(new URL('../data/'+p,base),'utf8'));
const now=Date.parse('2099-11-01T19:00:00Z');
class FixedDate extends Date{
 constructor(...args){super(...(args.length?args:[now]));}
 static now(){return now;}
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
async function desk(){
 const nodes={'nba-rabby-status':{},'nba-rabby-games':{}};
 const state={fail:false,interval:null,refresh:null,events:[]};
 const window={RabbyPossessionModel:scorer,SLTScorebug:{
  render:g=>'<div class="test-scorebug">'+g.away.code+' '+g.awayScore+' @ '+g.home.code+' '+g.homeScore+'</div>'
 }};
 const files={
  'data/nba-elo-shadow-2026-27.json':load('nba-elo-shadow-2026-27.json'),
  'data/nba-possession-inputs.json':load('nba-possession-inputs.json'),
  'data/nba-upcoming-schedule.json':{games:[
   {id:'synthetic-bos-orl',date:'2099-11-01T20:30:00Z',state:'pre',teams:[{home_away:'away',code:'BOS',name:'Boston Celtics'},{home_away:'home',code:'ORL',name:'Orlando Magic'}]},
   {id:'synthetic-lac-gsw',date:'2099-11-02T01:30:00Z',state:'pre',teams:[{home_away:'away',code:'LAC',name:'LA Clippers'},{home_away:'home',code:'GSW',name:'Golden State Warriors'}]},
   {id:'synthetic-final',date:'2099-11-01T15:00:00Z',state:'post',teams:[{home_away:'away',code:'IND'},{home_away:'home',code:'BOS'}]},
   {id:'synthetic-live',date:'2099-11-01T18:30:00Z',state:'in',teams:[{home_away:'away',code:'WAS'},{home_away:'home',code:'NYK'}]}
  ]},
  'data/nba-2025-26-team-advanced.json':load('nba-2025-26-team-advanced.json')
 };
 const document={hidden:false,getElementById:id=>nodes[id],dispatchEvent:event=>state.events.push(event.type),addEventListener:()=>{}};
 const fetch=async path=>{if(state.fail)throw Error('network down');return {ok:!!files[path],json:async()=>files[path]};};
 runInNewContext(src,{window,document,Date:FixedDate,Intl,Event:class{constructor(type){this.type=type}},
  fetch,console:{warn:()=>{}},setInterval:(fn,ms)=>{state.interval=ms;state.refresh=fn;}});
 await settle();await settle();
 return {nodes,state,window,refresh:async()=>{await state.refresh();await settle();}};
}
test('actual sourced 2026-27 inputs produce paced opponent-specific cards and exclude completed games',async()=>{
 const d=await desk();const html=d.nodes['nba-rabby-games'].innerHTML;
 assert.match(html,/rabby-v2-game/);
 assert.match(html,/ESTIMATED PACE/);
 assert.match(html,/OFFENSE MATCHED AGAINST OPPONENT DEFENSE/);
 assert.doesNotMatch(html,/synthetic-final|synthetic-live/);
 assert.doesNotMatch(html,/Experimental early-season Elo model/);
 assert.match(d.nodes['nba-rabby-status'].textContent,/completed team box scores/);
 assert.equal(d.window.NBARabbyForecastState.model.coverage.teams,30);
 assert(d.state.events.includes('nba:forecast-ready'));
 assert.equal(d.state.interval,60000);
});
test('network loss removes stale forecast cards instead of pretending live projections',async()=>{
 const d=await desk();
 assert.match(d.nodes['nba-rabby-games'].innerHTML,/rabby-v2-game/);
 d.state.fail=true;await d.refresh();
 assert.match(d.nodes['nba-rabby-status'].textContent,/network down/);
 assert.doesNotMatch(d.nodes['nba-rabby-games'].innerHTML,/rabby-v2-game/);
 assert.match(d.nodes['nba-rabby-games'].innerHTML,/Waiting for qualified box scores/);
});
test('win chances use the 1500-reset earned Elo and +40 home advantage, not historic seeded ratings',async()=>{
 const d=await desk();
 const rates=d.window.NBARabbyForecastState.ratings;
 const earned=load('nba-elo-shadow-2026-27.json');
 const previous=load('nba-2026-27-current-provisional.json');
 const earnedMap=Object.fromEntries(earned.rankings.map(r=>[r.team,r.elo]));
 const provisional=Object.fromEntries(previous.rankings.map(r=>[r.team,r.elo]));
 for(const [k,v] of Object.entries(earnedMap))assert.equal(rates[k],v);
 assert.notEqual(rates.OKC,provisional.OKC);
 const p=d.window.NBARabbyForecastState.project('ORL','BOS');
 assert(Math.abs(p.homeWin-1/(1+10**(-(rates.ORL+40-rates.BOS)/400)))<1e-12);
});
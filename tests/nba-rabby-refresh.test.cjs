const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {runInNewContext}=require('node:vm');
const source=readFileSync(new URL('../nba-rabby-forecast.js',`file://${__filename}`),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const now=Date.parse('2026-10-24T18:00:00Z');
class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
async function desk(models={}){
 const nodes={'nba-rabby-status':{},'nba-rabby-games':{}};
 let fail=false,refresh,interval;
 const games=[['future','pre','20:00'],['live','in','17:00'],['final','post','16:00'],['late','pre','17:55'],['unknown',null,'21:00']].map(([id,state,time])=>({id,state,date:`2026-10-24T${time}:00Z`,teams:[{home_away:'home',code:'BOS',name:id},{home_away:'away',code:'CHI',name:'Chicago'}]}));
 const ratings=Array.from({length:30},(_,i)=>({team:i===0?'BOS':i===1?'CHI':`T${i}`,elo:1500}));
 runInNewContext(source,{
  window:{...models,SLTScorebug:{render:g=>`<div>${g.home.name}</div>`}},
  document:{hidden:false,getElementById:id=>nodes[id]},Date:Clock,Intl,
  fetch:async path=>{if(fail)throw Error('network down');return {ok:true,json:async()=>path.includes('current-provisional')?{rankings:ratings,events:Array(5).fill({}),games_played:5}:path.includes('upcoming-schedule')?{games}: {}};},
  setInterval:(f,ms)=>{refresh=f;interval=ms;}
 });
 await tick();
 return {nodes,interval,fail:()=>{fail=true;},refresh};
}
test('pregame desk includes future scheduled games and excludes live, final, overdue and unknown states',async()=>{
 const {nodes,interval}=await desk();
 const html=nodes['nba-rabby-games'].innerHTML;
 assert.match(html,/future/);assert.doesNotMatch(html,/>live<|>final<|>late<|>unknown</);
 assert.match(nodes['nba-rabby-status'].textContent,/1 upcoming games/);
 assert.equal(interval,60000);
});
test('failed scheduled refresh removes previous forecast cards',async()=>{
 const d=await desk();assert.match(d.nodes['nba-rabby-games'].innerHTML,/future/);
 d.fail();await d.refresh();
 assert.doesNotMatch(d.nodes['nba-rabby-games'].innerHTML,/future/);
 assert.match(d.nodes['nba-rabby-games'].innerHTML,/Current forecasts unavailable/);
 assert.match(d.nodes['nba-rabby-status'].textContent,/network down/);
});

const projection={homePoints:110,awayPoints:100,margin:10,total:210};
test('insufficient team possession coverage uses qualified early-season fallback',async()=>{
 const d=await desk({RabbyPossessionModel:{build:()=>({coverage:{games:28}}),project:()=>null},RabbyEarlyScore:{build:()=>({games:28}),project:()=>projection}});
 const html=d.nodes['nba-rabby-games'].innerHTML;
 assert.match(html,/Experimental early-season Elo model/);
 assert.match(html,/210.0/);
 assert.doesNotMatch(html,/awaiting qualifying data/);
});
test('qualified possession projection takes precedence over early-season fallback',async()=>{
 const d=await desk({RabbyPossessionModel:{build:()=>({coverage:{games:28}}),project:()=>projection},RabbyEarlyScore:{build:()=>({games:28}),project:()=>{throw Error('Fallback should not run');}}});
 assert.match(d.nodes['nba-rabby-games'].innerHTML,/Experimental possession model/);
 assert.doesNotMatch(d.nodes['nba-rabby-games'].innerHTML,/Current forecasts unavailable/);
});

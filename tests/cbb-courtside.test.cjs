/* Independent Courtside contract: zero-cost inputs; never fabricate live or USRS. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const js=fs.readFileSync(path.join(root,'cbb-live-center.js'),'utf8');
const shell=fs.readFileSync(path.join(root,'cbb-game-center.html'),'utf8');
const css=fs.readFileSync(path.join(root,'cbb-live-center.css'),'utf8');
const brand=fs.readFileSync(path.join(root,'slt-courtside-network.js'),'utf8');
const read=n=>JSON.parse(fs.readFileSync(path.join(root,n),'utf8'));
assert(js.includes('The Courtside Desk')&&css.includes('SLT COURTSIDE EDITION'));
assert(shell.includes('slt-courtside-network.js'));
assert(brand.includes('THE COURTSIDE NETWORK'));
function load(gender){
  const patch=js.replace(/\s+boot\(\);\s*\}\)\(\);\s*$/,'\n globalThis.SLTTest={state,normalizeEvent,normalizeSnapshot,modelFor,gameEditorial,storyNote,usrsLine,featuredGame,scorebug,radarBar,gameLink};\n})();');
  assert(patch.includes('globalThis.SLTTest'),'test harness injection');
  const sandbox={
    console,Date,Intl,URL,URLSearchParams,Number,Map,Set,Math,String,Array,RegExp,Promise,
    location:{search:gender==='women'?'?gender=women':'',pathname:'/cbb-game-center.html',href:'https://example.test/cbb-game-center.html'},
    window:{},
    document:{getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[]}
  };
  vm.runInNewContext(patch,sandbox,{filename:'cbb-live-center.js'});
  return sandbox.SLTTest;
}
const men=load('men'),women=load('women');
const rawLive={
  id:'401920982',date:'2026-11-01T14:30:00Z',
  status:{type:{state:'in',shortDetail:'Halftime'},displayClock:'0:00',period:1},
  competitions:[{competitors:[
    {homeAway:'home',team:{id:'222',displayName:'Villanova Wildcats',abbreviation:'VILL'},score:'35'},
    {homeAway:'away',team:{id:'87',displayName:'Notre Dame Fighting Irish',abbreviation:'ND'},score:'31'}
  ],venue:{fullName:'Palazzo dello Sport'},neutralSite:true,broadcasts:[{names:['Fox']}]}]
};
const live=men.normalizeEvent(rawLive);
assert.equal(live.phase,'live');
assert.equal(live.away.team.id,'87');
assert.equal(live.home.team.id,'222');
assert.match(men.gameEditorial(live),/Villanova Wildcats leads by 4/);
assert(!men.gameEditorial(live).includes('9–2 run'));
assert.match(men.featuredGame(live),/THE LEAD GAME/);
assert.match(men.scorebug(live),/LIVE/);
const snapshot=men.normalizeSnapshot({id:'401920982',date:'2026-11-01T14:30Z',state:'in',status:'Halftime',teams:[
 {id:'87',home_away:'away',name:'Notre Dame Fighting Irish',score:'31'},
 {id:'222',home_away:'home',name:'Villanova Wildcats',score:'35'}
]});
assert.equal(snapshot.phase,'upcoming','stale snapshots must not be LIVE');
const xref=read('data/ncaam-2026-27-espn-team-crosswalk.json');
const ratings=read('data/ncaam-2026-27-retro-primary.json');
assert.equal(ratings.starting_elo,1500);
const byNCAA=new Map(xref.teams.map(t=>[String(t.id),String(t.espn_id)]));
for(const t of ratings.rankings){const id=byNCAA.get(String(t.team_id));if(id)men.state.ratings.set(id,t);}
men.state.ratingsReady=men.state.ratings.size===365;
men.state.preseason=true;
const first=men.modelFor(live);
assert(first&&first.available===false,'preseason cannot invent a favorite');
assert.equal(first.probability,undefined);
assert.match(men.usrsLine(live),/NO POWER EDGE UNTIL VERIFIED FINALS/);
const forecasts=read('data/ncaam-2026-27-upcoming-forecasts.json');
for(const f of forecasts.games)men.state.forecast.set(String(f.id).replace(/^espn:/,''),f);
men.state.forecastDate=forecasts.as_of;
men.state.preseason=false;
assert.equal(men.modelFor(live)?.probability,undefined,'neutral site probability suppressed');
const nonneutral={...live,neutral:false};
assert(Number.isFinite(men.modelFor(nonneutral)?.probability),'same-ID valid dated forecast can display');
const stale={...nonneutral,date:'2027-05-01T14:30:00Z'};
assert.equal(men.modelFor(stale)?.probability,undefined,'stale forecast suppressed');
const wbb=read('data/ncaaw-2026-27-retro-primary.json');
assert.equal(wbb.rankings.length,363);
for(const t of wbb.rankings)women.state.ratings.set(String(t.team_id),t);
women.state.ratingsReady=true;women.state.preseason=true;
const wEvent=women.normalizeEvent({...rawLive,id:'401920983'});
assert(women.modelFor(wEvent)&&women.modelFor(wEvent).probability===undefined);
assert(!women.usrsLine(wEvent).includes('pregame</strong>'),'women cannot inherit men probability');
assert(!css.includes('.cbb-team-identity .mbb-mark::after'),'no extra logo bands');
for(const page of ['nba.html','ncaam.html','college-basketball.html','euroleague.html','nbl.html'])
 assert(fs.readFileSync(path.join(root,page),'utf8').includes('slt-courtside-network.js'),page+' Courtside network install');
console.log('PASS Courtside: live/snapshot separation, away/home, verified notes, gender-isolated Elo, neutral/site/stale model checks, navigation, no logo overlay.');

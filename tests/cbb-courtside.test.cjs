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
assert(brand.includes('THE HARDWOOD')&&brand.includes('slt-network-title'),'Hardwood uses text-only editorial branding');
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
assert.match(men.featuredGame(live),/FEATURED GAME/);
assert.equal((men.featuredGame(live).match(/cbb-game-card/g)||[]).length,1,'featured matchup must use one scorecard');
assert.match(men.scorebug(live),/LIVE/);
assert.match(men.scorebug(live),/cbb-gamefile\.html\?/,'card opens separate Gamefile');
assert(!men.scorebug(live).includes('data-cbb-open'),'game cards never append an inline box');
assert(!men.scorebug(live).includes('cbb-usrs-module'),'full model ratings must not crowd game cards');
assert(!men.scorebug(live).includes('cbb-story-note'),'no repetitive editorial prose under every scorecard');
assert(!js.includes('id="cbb-radar-host"'),'remove decorative zero-value watch dashboard');
assert(js.includes('isGamefile')&&js.includes('data-gamefile-panel'),'Gamefile has its own tabbed route');
assert(!js.includes('data-cbb-close'),'scoreboard no longer creates inline box score');
assert(fs.readFileSync(path.join(root,'cbb-gamefile.html'),'utf8').includes('cbb-gamefile-root'),'dedicated Gamefile HTML exists');
assert(brand.includes('slt-league-image'),'league navigation retains real league marks');
assert(!brand.includes('hardwood-wordmark.svg')&&!brand.includes('slt-hardwood-crest.svg'),'rejected brand graphics are absent');
assert(brand.includes('logo-nba.svg')&&brand.includes('NCAA_logo.svg')&&brand.includes('EuroLeague_logo.svg')&&brand.includes('NBL_Logo.png'),'league logos are used, not fake icons');
assert(brand.split('NCAA_logo.svg').length===3,'men and women use the same authentic NCAA mark');
const brandCSS=fs.readFileSync(path.join(root,'slt-courtside-network.css'),'utf8');
assert(brandCSS.includes('.slt-network-title')&&brandCSS.includes('.slt-league-image'),'typographic masthead and league logos are responsive');
assert(brandCSS.includes('.cbb-gender-bar'),'redundant gender toggle hidden only when Hardwood is available');
assert(!brandCSS.includes('.mbb-mark'),'Hardwood does not add a third ring to team logos');
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
assert(!brandCSS.includes('slt-network-wordmark'),'rejected generated logo CSS removed');
// The Retro clean-slate newspaper must not pretend the first alphabetical teams are leaders.
const mbbHome=fs.readFileSync(path.join(root,'mbb-newspaper.js'),'utf8');
const mbbCSS=fs.readFileSync(path.join(root,'mbb-newspaper.css'),'utf8');
assert(!mbbHome.includes('teams.slice(0,4).map(t=>'), 'preseason hero cannot present first 4 alphabetically');
assert(!mbbHome.includes("League leader by Elo: '+esc(members[0].team)"), 'conference leader must not be the first listed school');
assert(mbbCSS.includes('.hero-facts'), 'homepage uses compact factual editorial figures');
assert(!mbbCSS.includes("content:'USRS PRESEASON · TOP FOUR'"),'no stale Top Four pseudoelement');
assert(mbbHome.includes('Scores, standings and independent ratings'),'homepage has clear news-focused intro');
const helperStart=mbbHome.indexOf('function featuredRatings(){');
const helperEnd=mbbHome.indexOf('function home(){',helperStart);
assert(helperStart>=0&&helperEnd>helperStart, 'preseason editorial helpers are bundled');
const alpha={team:'A School',team_id:'a',elo:1500,rank:1};
const zulu={team:'Z School',team_id:'z',elo:1500,rank:1};
const edition={
  live:false,retroPreseason:true,teams:[alpha,zulu],esc:x=>String(x),number:(x)=>Number(x).toFixed(0),
  teamURL:t=>'team.html?team='+t.team_id,logo:()=>'<i>logo</i>'
};
vm.runInNewContext(mbbHome.slice(helperStart,helperEnd)+
 '\nglobalThis.editorial={featuredRatings,preseasonPowerboard,conferenceLeaderText}',edition);
assert.match(edition.editorial.featuredRatings(),/365/);
assert(!edition.editorial.featuredRatings().includes('A School'), 'all-tied hero cannot arbitrarily name school A');
assert.match(edition.editorial.conferenceLeaderText([alpha,zulu]),/Every team begins at 1500/);
edition.retroPreseason=false;
assert.match(edition.editorial.featuredRatings(),/not currently verified/, 'unavailable rating sources must not invent preseason ties');
assert.match(edition.editorial.conferenceLeaderText([alpha,zulu]),/not verified/, 'conference leaders withheld when rating source fails');
edition.retroPreseason=true;
edition.live=true;edition.teams=[alpha,{...zulu,elo:1560,rank:1}];
const rated=edition.editorial.featuredRatings();
assert(rated.indexOf('Z School')<rated.indexOf('A School'), 'once games exist the higher rated team leads');
assert.match(edition.editorial.conferenceLeaderText(edition.teams),/Z School/);
assert.match(edition.editorial.conferenceLeaderText([alpha,zulu]),/2 schools tied/);
const season0=read('data/ncaam-2026-27-retro-primary.json');
if(season0.games_played===0){
  assert.equal(new Set(season0.rankings.map(x=>x.elo)).size,1,'real preseason rating file is tied');
  assert.equal(season0.rankings[0].elo,1500);
}
console.log('PASS Courtside: live/snapshot separation, away/home, verified notes, gender-isolated Elo, neutral/site/stale model checks, navigation, no logo overlay.');

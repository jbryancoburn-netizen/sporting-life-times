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
// 2027 Bracket Watch: the official 76-team structure, not a two-column 152-row wall.
const bracketJS=fs.readFileSync(path.join(root,'mbb-newspaper.js'),'utf8');
const compareJS=fs.readFileSync(path.join(root,'mbb-selection-comparison.js'),'utf8');
const bracketCSS=fs.readFileSync(path.join(root,'mbb-newspaper.css'),'utf8');
assert(bracketJS.includes('tournament-dek')&&bracketJS.includes('bracket-region-tabs'),'regional brackets precede model analysis');
assert(bracketJS.includes('data-bracket-panel')&&bracketJS.includes('aria-selected'),'four regions are selectable without scrolling through four brackets');
assert(bracketJS.includes('32</b> projected AQs')&&bracketJS.includes('44</b> at-large'),'official field structure is shown');
assert(compareJS.includes("const method=app.querySelector('#method')"),'supplemental model comparison belongs after the field and opening-round bracket');
assert(compareJS.includes('selection-all')&&compareJS.includes('<details'),'full 76-team lists must collapse by default');
assert(compareJS.includes('No verified 2026–27 résumé exists yet'),'preseason poll illustration must not be marketed as a committee forecast');
assert(bracketCSS.includes('.selection-compare-intro')&&bracketCSS.includes('.bracket-grid--selectable'),'bracket UI has mobile rules');
assert(!compareJS.includes('<h3>Committee-style field · 76 teams</h3>'),'remove uncollapsed 76-item committee list');
// CourtCast: only source-reported play events may move the schematic ball.
const courtSource=fs.readFileSync(path.join(root,'cbb-live-court.js'),'utf8');
const courtCSS=fs.readFileSync(path.join(root,'cbb-live-court.css'),'utf8');
const courtFile=fs.readFileSync(path.join(root,'cbb-gamefile.html'),'utf8');
const courtWorld={window:{},setInterval:()=>0,clearInterval:()=>{},requestAnimationFrame:fn=>fn()};
vm.runInNewContext(courtSource,courtWorld,{filename:'cbb-live-court.js'});
const court=courtWorld.window.SLTCourt;
assert(court&&typeof court.parsePlays==='function'&&typeof court.mount==='function');
const playRows=[
 {id:'100',text:'Notre Dame made three point jumper',shootingPlay:true,scoringPlay:true,
  coordinate_x:15,coordinate_y:22,team:{id:'87'},period:{number:1},clock:{displayValue:'12:20'}},
 {id:'101',text:'Villanova defensive rebound',team:{id:'222'},period:{number:1},clock:{displayValue:'12:15'}},
 {id:'102',text:'Villanova turnover',team:{id:'222'},period:{number:1},clock:{displayValue:'12:07'}}
];
assert.equal(court.parsePlays({plays:playRows}).length,3);
assert.equal(court.parsePlays({}).length,0,'no fabricated play data');
assert.equal(court.parsePlays({plays:{items:playRows}}).length,3,'ESPN item container supported');
const fakeGame={id:'401920982',phase:'final',away:{team:{id:'87',abbreviation:'ND'}},
 home:{team:{id:'222',abbreviation:'VILL'}}};
assert(court.location(court.parsePlays({plays:playRows})[0])?.x>50,'only source shot coordinates may generate a point');
assert.equal(court.location(court.parsePlays({plays:playRows})[1]),null,'a rebound cannot have an invented ball coordinate');
assert.equal(court.location(court.parsePlays({plays:playRows})[2]),null,'a turnover cannot have an invented ball coordinate');
assert.equal(court.location(court.parsePlays({plays:[{id:'103',text:'Player substitution',team:{id:'222'}}]})[0]),null,'substitutions never move a ball');
assert.equal(court.location(court.parsePlays({plays:[{id:'104',text:'Made jumper',shootingPlay:true,coordinate_x:-100,coordinate_y:99}]})[0]),null,'invalid coordinates are discarded');
const fakeNode={innerHTML:'',isConnected:true,addEventListener:()=>{},querySelector:()=>null};
court.mount(fakeNode,fakeGame,{plays:playRows});
assert.match(fakeNode.innerHTML,/COURTCAST/);
assert.match(fakeNode.innerHTML,/SOURCE-REPORTED SHOT LOCATIONS/);
assert.match(fakeNode.innerHTML,/slc-shot-made/);
assert(!fakeNode.innerHTML.includes('slc-ball'), 'no fictitious basketball marker is rendered');
assert.match(fakeNode.innerHTML,/Notre Dame Radio Network/);
assert.match(fakeNode.innerHTML,/thevarsitynetwork.com/);
assert(!fakeNode.innerHTML.includes('<audio'), 'do not rebroadcast rights-held radio');
assert.match(fakeNode.innerHTML,/Villanova turnover/);
assert(!fakeNode.innerHTML.includes('actual ball position'));
const missingNode={innerHTML:'',isConnected:true,addEventListener:()=>{},querySelector:()=>null};
court.mount(missingNode,{...fakeGame,id:'401920983'},null);
assert.match(missingNode.innerHTML,/No verified play-by-play/,'missing source shows no invented possessions');
assert.match(missingNode.innerHTML,/NO VERIFIED SHOT LOCATIONS/,'empty court never pretends player or ball tracking');
assert(courtFile.includes('cbb-live-court.js')&&courtFile.includes('cbb-live-court.css'),
 'CourtCast JS and CSS must actually load in the dedicated Gamefile');
assert(js.includes("SLTCourt.mount(document.getElementById('cbb-courtcast-root'),g,raw)"),
 'Gamefile must mount on verified score-and-plays summary, without a separate unverified feed');
assert(courtCSS.includes('prefers-reduced-motion'),'accessible reduced-motion state is required');
assert(!courtSource.includes("function location(play,g)"), 'remove guessed team-side event positions');
assert(!courtCSS.includes('.slc-ball{'), 'CSS for invented moving ball must be eliminated');
console.log('PASS Courtside: live/snapshot separation, away/home, verified notes, gender-isolated Elo, neutral/site/stale model checks, navigation, no logo overlay.');

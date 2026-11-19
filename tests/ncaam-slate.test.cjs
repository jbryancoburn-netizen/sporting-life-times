/* CI: functional college basketball slate, sourced and gender-isolated. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const slate=require('../ncaam-slate.js');
const json=path=>JSON.parse(fs.readFileSync(path,'utf8'));
const html=fs.readFileSync('ncaam-slate.html','utf8');
const css=fs.readFileSync('ncaam-slate.css','utf8');
const script=fs.readFileSync('ncaam-slate.js','utf8');
const scorecardCss=fs.readFileSync('cbb-ledger-scorecard.css','utf8');
const bakedCrestCss=fs.readFileSync('mbb-logo-system.css','utf8');
const logoRenderer=fs.readFileSync('mbb-logo-system.js','utf8');
assert(bakedCrestCss.includes('.mbb-mark.mbb-mark--precomposed>img.mbb-mark__img') &&
 bakedCrestCss.includes('width:100%!important;height:100%!important'),
 'pre-rendered crests must render at 100% of their scorebug frame');
assert(!scorecardCss.includes('.ledger26-card--men .ledger26-crest .mbb-mark>img.mbb-mark__img') &&
 !scorecardCss.includes('.ledger26-crest .mbb-mark>img.mbb-mark__img{width:78%'),
 'the ledger must not shrink baked crests, including Northwestern, on desktop or mobile');
assert(logoRenderer.includes("'77':'assets/cbb-big-ten-1980s/centered/northwestern.png") &&
 logoRenderer.includes("'assets/cbb-embossed-crests/'+id+'.png"),
 'Northwestern must retain its authentic local heritage art inside the baked crest');


const forecastScorebug=fs.readFileSync('cbb-ledger-scorebug.js','utf8');
assert(forecastScorebug.includes('pulseRange(Math.max(maxLead,-minLead))') && forecastScorebug.includes('pulseScale.set(id,scale)'), 'RETRO Pulse must preserve the largest observed lead scale');
assert(forecastScorebug.includes('ledger26-scorebug--pulse'), 'Pulse must occupy full scorebug width without empty status column');
assert(forecastScorebug.includes('ledger26-pulse-compact') && forecastScorebug.includes('ledger26-pulse-expanded') && forecastScorebug.includes('pulseBounds.set(id,{min:bottom,max:top})'), 'Concept A must be compact and Concept B must retain asymmetric expanded lead bounds');
assert(scorecardCss.includes('.ledger26-pulse-expanded-chart{height:258px') && /@media\(max-width:700px\)\s*\{[^@]*?\.ledger26-pulse-compact\s*\{[^}]*grid-template-columns:82px repeat\(2,minmax\(0,1fr\)\)/.test(scorecardCss), 'Desktop must have detailed flow while mobile quick summary stays readable');
assert(forecastScorebug.includes('pulseSegmentMicrograph(model,item)') && forecastScorebug.includes("'H'+xx+' V'+yy"), 'Pulse must show actual step scoring and selectable detailed close-up');
assert(forecastScorebug.includes('data-away-name=') && forecastScorebug.includes('Full game scoring margin.'), 'Pulse must use real team labels rather than home/away');
assert(scorecardCss.includes('.ledger26-pulse-expanded-chart .ledger26-pulse-media-label{display:none}') && scorecardCss.includes('height:258px') && scorecardCss.includes('height:205px'), 'Pulse must use a detailed desktop chart and a label-simplified mobile chart');
assert(forecastScorebug.includes('ledger26-pulse-axis') && forecastScorebug.includes('ledger26-pulse-trace') && forecastScorebug.includes('ledger26-pulse-period-label'), 'Pulse needs readable lead ticks, a stronger trace and clear halftime indicator');
assert(forecastScorebug.includes('data-retro-segment') && forecastScorebug.includes('getImageData('), 'RETRO Pulse segments must be directly clickable while preserving the existing watermark cleanup');
assert(forecastScorebug.includes('const label=(band?') && forecastScorebug.includes('clock:p.clock'), 'real media timeouts must retain their observed clock');
assert(script.includes('gameId:String(g.id)') && script.includes('const convert=t=>({id:String(t.id)'), 'RETRO Pulse must receive exact source game and team IDs');
assert(forecastScorebug.includes('aria-label="Current RETRO ratings and daily movement"') && forecastScorebug.includes('change since the previous daily snapshot, not necessarily attributable to this game'), 'RETRO movement must be labeled as a daily snapshot change, not this game impact');
assert(scorecardCss.includes('.ledger26-team--dark-fill .ledger26-ghost') && scorecardCss.includes('mix-blend-mode:screen'), 'dark school panels need adaptive visible mascot watermarks');
assert(forecastScorebug.includes('cleanWatermark(this)') && forecastScorebug.includes('getImageData(') && forecastScorebug.includes('seen[i]'), 'ring-free mascot watermarks must remove edge-connected opaque boxes without altering foreground crests');
assert(forecastScorebug.includes('readableInk(x.color,phase,outcome)') && scorecardCss.includes('var(--ledger26-readable-ink'), 'each school-colored scorebug must select readable foreground ink');
assert(scorecardCss.includes('.ledger26-scorebug .ledger26-team{\n  overflow:hidden;') && scorecardCss.includes('mix-blend-mode:multiply') && scorecardCss.includes('brightness(.66)'), 'oversized watermark must stay inside its team row and retain dark engraved detail');
assert(forecastScorebug.includes('data-watermark-art') && !forecastScorebug.includes('const safeCrest='), 'large background marks must use original artwork, not a baked circular crest');
const forecastRailCss=scorecardCss.split('/* Shared horizontal pregame intelligence strip.')[1];
assert(forecastRailCss &&
 forecastRailCss.includes('grid-template-columns:repeat(3,minmax(0,1fr))!important') &&
 forecastRailCss.includes('flex-wrap:wrap') &&
 forecastRailCss.includes('overflow-wrap:break-word!important') &&
 forecastRailCss.includes('flex-direction:column!important') &&
 !forecastRailCss.includes('max-height:2.2em;overflow:hidden'),
 'Pregame RETRO forecast values must wrap and remain legible in both horizontal desktop and stacked mobile layouts');
assert(forecastScorebug.includes('RETRO SPREAD') &&
 forecastScorebug.includes('PROJECTED FINAL') &&
 forecastScorebug.includes('ledger26-pregame-inline--prob'),
 'the pregame rail needs independently legible probability, signed spread and projected final');
assert(/href="cbb-ledger-scorecard\.css\?v=[\w-]+"/.test(html) &&
 /src="cbb-ledger-scorebug\.js\?v=[\w-]+"/.test(html),
 'the public ledger must load the current unified scorebug and forecast layout without stale cached assets');

assert(!/draftkings|onlyDraftKings|sportsbook|draftKingsByDate/i.test(script+html+scorecardCss), 'sportsbook lines and lookups must not reappear in the ledger');
assert(script.includes('ledgerScorebug(g)')&&fs.readFileSync('cbb-ledger-scorebug.js','utf8').includes('ledger26-pregame-edge'), 'RETRO margin must remain visible in shared scorebug');
assert(script.includes('data-slt-ledger-press-open')&&script.includes('ledger26-network'), 'press and network must remain in header');
assert(script.includes('broadcastByDate')&&script.includes('verifiedBroadcasts'), 'verified TV lookup must remain connected');
assert(script.includes('cbb-published-networks-2026-27.json')&&script.includes('publishedBroadcasts'),
 'persistent men and women network cache must remain loaded');
for(const id of ['slate-root','sl-prev','sl-next','sl-picker','sl-games','sl-search','sl-filters','sl-more','sl-reload','sl-women','sl-men','sl-count'])
  assert(html.includes('id="'+id+'"'),'missing real control '+id);
assert(html.includes('ncaam-slate.js')&&html.includes('ncaam-slate.css'));
assert(css.includes('@media(max-width:700px)'),'mobile-first responsive layout missing');
assert(css.includes(':is(#sl-games,.sl-games){display:grid;grid-template-columns:repeat(2,minmax(0,1fr))'),
 'two-column Daily Ledger layout missing');
assert(css.includes(':is(#sl-games,.sl-games){grid-template-columns:minmax(0,1fr);gap:10px}'),
 'mobile single-column Daily Ledger layout missing');
assert(html.includes('body class="sl-ledger-page"')&&css.includes('.sl-ledger-page .ledger26-scorebug'),
 'shared, page-scoped scorebug geometry missing');
assert(script.includes('ledger26-card--women')&&script.includes('ledger26-card--men')&&
 !script.includes('ledger26-card--refined')&&!script.includes('ledger26-meta--refined'),
 'men and women must share identical card geometry');
assert(!css.includes('.sl-broadcast-bug')&&!css.includes('.sl-pennant'),
 'retired scorebug and arena skins must not override the active ledger cards');
assert(script.includes('setInterval('),'live refresh missing');
// Source-backed arena records remain available to the Gamefile. The collapsed
// Ledger deliberately uses ledger26-* scorecards, not the retired arena-stage
// layout or pennants.
const arenas=json('data/mbb-arena-registry.json');
assert(arenas.teams&&Object.keys(arenas.teams).length>=300,'verified home-court reference coverage missing');
assert.equal(arenas.teams['2'].home_arena,'Neville Arena');
assert(/^https:\/\//.test(arenas.teams['2'].home_arena_source));
assert(script.includes('data/mbb-arena-registry.json'),'official arena registry not loaded');
assert(script.includes('DOCUMENTED SCHOOL HOME COURT · NOT CONFIRMED FOR THIS GAME'),
 'avoid claiming a team home arena is the site of a neutral or alternate-host game');
assert(script.includes('data/dual-ring-team-palette.json'),'real two-color school palette not loaded');
assert(script.includes('suppressMonogram:true')&&script.includes('ledger26-summary'),
 'each collapsed card must use one consistent expandable shared scorebug');
assert(css.includes('--ledger26-crest-size:68px')&&css.includes('--ledger26-crest-size:48px'),
 'scorecard artwork must scale across desktop and narrow mobile');
assert(script.includes('data/ncaaw-2026-27-teams.json')&&script.includes('womenTeams.get('),
 'women must have a documented school-logo fallback instead of a broken ranking reference');
assert(!script.includes('rankings.get('),'undefined women ranking variable breaks mascot artwork');
assert(!script.includes('CHAMPIONSHIP BANNER'),'editorial pennants cannot claim unverified titles');

assert(script.includes('window.MBBLogos.byESPN'),'official double-ring logo system not used');
assert(script.includes('source_tier')||script.includes('sourceURL'),'sourced exhibitions remain identifiable');
assert(!script.includes('NATIONAL CHAMPIONS')&&!script.includes('CONFERENCE TITLES'),
  'decorative pennants must not invent championship banners');

const cross=json('data/ncaam-2026-27-espn-team-crosswalk.json');
assert.equal(cross.teams.length,365);
const ratings=json('data/ncaam-2026-27-retro-primary.json');
assert.equal(ratings.starting_elo,1500);
assert.equal(ratings.model,'retro-clean-slate');
assert.equal(ratings.rankings.length,365);
const feed=json('data/mbb-live.json'),forecast=json('data/ncaam-2026-27-upcoming-forecasts.json');
const men=slate.normalizeMen(feed,forecast,cross);
const officialOnly=slate.normalizeMen({games:[],ncaa_crosscheck:{day:'2026-11-11',games:[
 {ncaa_id:'6655395',day:'2026-11-11',away_id:'161',home_id:'2837',phase:'upcoming',date:null}
]}},{games:[]},cross);
assert.equal(officialOnly.length,1,'missing grouped ESPN game must remain visible from NCAA');
assert.equal(officialOnly[0].id,'ncaa:6655395');
assert.equal(officialOnly[0].timed,false,'no invented tipoff for NCAA-only game');
assert.equal(officialOnly[0].phase,'upcoming');
assert.equal(slate.gameDetailsHref(officialOnly[0],false),'#');

const officialTV=slate.normalizeMen({
 games:[{id:'401920424',date:'2026-11-08T18:00:00Z',state:'pre',
   teams:[{id:'8',name:'Arkansas Razorbacks'}, {id:'258',name:'Virginia Cavaliers'}]}],
 conference_fixtures:{day:'2026-11-08',games:[
  {team_ids:['8','258'],network_announced:'ESPN',network_conflict:false}
 ]}
},{games:[]},cross);
assert.equal(officialTV[0].broadcast,'ESPN',
 'exact school and date TV announcement must survive an empty scoreboard broadcast');
const placeholderTV=slate.normalizeMen({
 games:[{id:'401920424',date:'2026-11-08T18:00:00Z',state:'pre',
   teams:[{id:'8',name:'Arkansas Razorbacks'}, {id:'258',name:'Virginia Cavaliers'}]}],
 conference_fixtures:{day:'2026-11-08',games:[
  {team_ids:['8','258'],network_announced:'<TBD>',network_conflict:false}
 ]}
},{games:[]},cross);
assert.equal(placeholderTV[0].broadcast,'',
 'unannounced broadcast placeholders must never be displayed as real stations');
const historicalFinals=json('data/mbb-retro-live-finals.json');
const overnightFinal=historicalFinals.games.find(g=>g.date==='2026-11-05');
assert(overnightFinal,'retain the 2026-11-05 verified scoreboard results');
const archivedLedger=slate.normalizeMen({games:[]},{games:[]},cross,{},historicalFinals);
const recovered=archivedLedger.find(g=>g.id===overnightFinal.id.replace(/^espn:/,'')&&g.day===overnightFinal.date);
assert(recovered&&recovered.phase==='final','past-day calendar must display archived final');
assert.equal(recovered.away.score,overnightFinal.away_score,'past-day away score retained');
assert.equal(recovered.home.score,overnightFinal.home_score,'past-day home score retained');
assert.equal(archivedLedger.filter(g=>g.id===recovered.id).length,1,'archived final must not duplicate');
assert(men.length>0,'current men scoreboard missing');
assert(men.every(g=>g.away&&g.home&&g.away.id!==g.home.id),'duplicate or missing teams');
const publishedDay=slate.isoDate(feed.games[0].date);
const dated=men.filter(g=>g.day===publishedDay);
assert(dated.length>0,'day selector must reveal source-published games');
const game=men.find(g=>g.id==='401921422');
if(game){
 assert(game.away.id==='2771'&&game.home.id==='2026',
   'Merrimack away / App State home must not be reversed');
 assert(game.away.name==='Merrimack'&&game.home.name==='App State');
 assert(slate.gameDetailsHref(game,false).includes('401921422'));
}
assert(men.filter(g=>g.phase==='upcoming').every(g=>g.away.score===null&&g.home.score===null),
  'pregame games must not show fabricated scores');
const scheduled=men.filter(g=>g.probability!==null);
assert(scheduled.every(g=>g.phase==='upcoming'),'pre-game forecast cannot become a live score');
const exhibitData=json('data/mbb-exhibition-finals-2026-27.json');
assert.equal(exhibitData.retro_included,false);
const exhibitions=slate.normalizeExhibitions(exhibitData,cross);
assert(exhibitions.length>=100,'sourced exhibition ledger not connected');
assert(exhibitions.every(g=>g.kind==='exhibition'&&g.phase==='final'));
assert(exhibitions.every(g=>!slate.gameDetailsHref(g,false).startsWith('cbb-gamefile.html')),
  'exhibitions must link to source, not a regular-season Gamefile');
assert.equal(slate.selectGames(exhibitions,'2026-10-17','live','',new Set()).length,0);
assert(slate.selectGames(exhibitions,'2026-10-17','exhibition','',new Set()).length>0);
const first=dated[0];
assert(slate.selectGames(men,publishedDay,'all',first.away.name,new Set()).some(g=>g.away.id===first.away.id));
assert(slate.selectGames(men,publishedDay,'favorites','',new Set([first.away.id])).every(g=>g.away.id===first.away.id||g.home.id===first.away.id));
assert(slate.selectGames(men,publishedDay,'all','',new Set()).length>0);
assert.equal(slate.shift('2026-11-02',-1),'2026-11-01');
assert.equal(slate.shift('2026-11-02',1),'2026-11-03');
const wbr=json('data/ncaaw-2026-27-retro-primary.json');
assert.equal(wbr.gender,'women');assert.equal(wbr.starting_elo,1500);
const women=slate.normalizeWomen(json('data/ncaaw-2026-27-games.json'),wbr,cross);
assert(women.length>0,'women edition missing');
assert(women.some(g=>g.day===women[0].day),'women published date must render');
assert(women.every(g=>g.kind!=='exhibition'),'women/men exhibition ledger contamination');
const wfinal=women.find(g=>g.id==='401920983');
if(wfinal){
 assert(wfinal.away.id==='87'&&wfinal.home.id==='222'&&wfinal.away.score===99,
   'women game result identity not preserved');
 assert(slate.gameDetailsHref(wfinal,true).includes('gender=women'));
}
const fixture={id:'4444444',date:'2026-11-02T18:00Z',state:'pre',teams:[
 {id:'2771',name:'Merrimack Warriors',score:'0'},
 {id:'2026',name:'App State Mountaineers',score:'0'}]};
const badForecast={games:[{id:'espn:4444444',date:'2026-11-02',
  away_id:'ncaa:609574',home_id:'ncaa:609673',home_win_probability:.77}]};
const mismatched=slate.normalizeMen({games:[fixture]},badForecast,cross);
assert.equal(mismatched[0].probability,null,'disputed matchup cannot receive a false model forecast');

// The Ledger checks today's scoreboard independently of scheduled JSON publishes.
// Participant IDs, temporal order and official finals remain strict.
assert(script.includes('refreshLive()')&&script.includes('},30000)'),
 'Live Ledger must refresh independently between static publisher runs');
assert(script.includes('Live scores checked')&&script.includes('Published '),
 'Show the separate published snapshot and direct score-check clocks');
const verifiedTeams={teams:[
 {id:'canon-1',espn_id:'2747',name:'Wofford',espn_name:'Wofford Terriers'},
 {id:'canon-2',espn_id:'2633',name:'Tennessee',espn_name:'Tennessee Volunteers'}
]};
const sourceEvent=(awayPoints,homePoints,awayId='2747')=>({
 id:'401906848',date:'2026-11-03T23:00:00Z',
 status:{type:{state:'in',shortDetail:'11:15 - 2nd'}},
 competitions:[{competitors:[
  {homeAway:'away',team:{id:awayId},score:awayPoints},
  {homeAway:'home',team:{id:'2633'},score:homePoints}
 ]}]
});
const reported=slate.liveEvents({events:[sourceEvent('38','44')]},'2026-11-03',verifiedTeams);
assert.equal(reported.length,1,'exact team IDs identify the live fixture');
const oldGame={id:'401906848',day:'2026-11-03',phase:'live',kind:'regular',
 away:{id:'2747',canonical:'canon-1',score:31},
 home:{id:'2633',canonical:'canon-2',score:34}};
const advanced=slate.reconcileLive([oldGame],reported);
assert.equal(advanced[0].away.score,38,'newer live score supersedes published value');
assert.equal(advanced[0].home.score,44,'update both teams from the same event');
const recentClock={...oldGame,scoreObservedAt:100,status:'5:00 - 1ST'};
const staleClock={...oldGame,scoreObservedAt:50,status:'7:00 - 1ST'};
assert.equal(slate.reconcileLive([recentClock],[staleClock])[0].status,recentClock.status,
 'A last-known published clock must not overwrite a more recent direct clock with equal scores');
const correctedFinal={...oldGame,phase:'final',completed:true,away:{...oldGame.away,score:oldGame.away.score-1}};
assert.equal(slate.reconcileLive([oldGame],[correctedFinal])[0].phase,'final',
 'A completed source game can correct a mistaken running score');
const femaleSnapshot=json('data/wbb-live.json');
assert.equal(femaleSnapshot.edition,'women');
assert(Array.isArray(femaleSnapshot.events));
const earlier=slate.liveEvents({events:[sourceEvent('22','30')]},'2026-11-03',verifiedTeams);
assert.equal(slate.reconcileLive([oldGame],earlier)[0].away.score,31,
 'older scores cannot move backwards');
assert.equal(slate.liveEvents({events:[sourceEvent('38','44','999')]},'2026-11-03',verifiedTeams).length,0,
 'unknown team identity cannot enter the Ledger');
assert.equal(slate.liveEvents({events:[sourceEvent('38','44')]},'2026-11-02',verifiedTeams).length,0,
 'live fixtures must match the game day');
assert.equal(slate.reconcileLive([{...oldGame,phase:'final'}],reported)[0].away.score,31,
 'certified finals outrank supplemental scores');

// Retro ratings only change after fully completed source-backed games.
require('../mbb-retro.js');
assert(html.indexOf('src="mbb-retro.js')>0 && html.indexOf('src="mbb-retro.js')<html.indexOf('src="ncaam-slate.js'),
 'retro engine must load before the game slate');
assert(script.includes('RETRO PROVISIONAL') && script.includes('refreshRETRO()'));
const menBase=json('data/ncaam-2026-27-retro-primary.json');
const womenBase=json('data/ncaaw-2026-27-retro-primary.json');
const home=menBase.rankings.find(r=>r.team==='Tennessee');
const away=menBase.rankings.find(r=>r.team==='Wofford');
assert(home && away);
const ended={id:'999999991',day:'2026-11-05',kind:'regular',phase:'final',completed:true,neutral:true,site_verified:false,
 home:{canonical:home.team_id,score:88},away:{canonical:away.team_id,score:70}};
const updated=slate.provisionalRetro(menBase,[ended],globalThis.MBB_RETRO);
assert.equal(updated.pending,1);
assert.equal(updated.rankings.length,365);
assert.notEqual(updated.rankings.find(r=>r.team_id===home.team_id).elo,home.elo);
assert.equal(updated.rankings.find(r=>r.team_id===home.team_id).wins,home.wins+1);
assert.equal(slate.provisionalRetro(menBase,[ended,ended],globalThis.MBB_RETRO).pending,1);
assert.equal(slate.provisionalRetro(menBase,[{...ended,phase:'live'}],globalThis.MBB_RETRO).pending,0);
assert.equal(slate.provisionalRetro(menBase,[{...ended,completed:false}],globalThis.MBB_RETRO).pending,0);
assert.equal(slate.provisionalRetro(menBase,[{...ended,home:{canonical:'unrecognized',score:88}}],globalThis.MBB_RETRO).pending,0);
const old=menBase.events[0];
assert.equal(slate.provisionalRetro(menBase,[{...ended,id:String(old.id).replace(/^espn:/,''),day:old.date,
 home:{canonical:old.home_id,score:old.home_score},away:{canonical:old.away_id,score:old.away_score}}],globalThis.MBB_RETRO).pending,0);
const wHome=womenBase.rankings[0],wAway=womenBase.rankings[1];
const wFinal={...ended,home:{canonical:wHome.team_id,score:77},away:{canonical:wAway.team_id,score:65}};
const wUpdated=slate.provisionalRetro(womenBase,[wFinal],globalThis.MBB_RETRO,true);
assert.equal(wUpdated.pending,1);
assert.equal(wUpdated.rankings.length,363);
assert.notEqual(wUpdated.rankings.find(r=>r.team_id===wHome.team_id).elo,wHome.elo);
console.log('PASS NCAA slate: interactive controls, 365-school identity, sourced scores, 1500 RETRO, men/women separation, search/date, sourced exhibition exclusions.');

// Arena File, box-score provenance and future live-data correctness are release gates.
require('./mbb-arena-insights.test.cjs');

const scorebugVm=require('node:vm');
const scorebugContext={};
scorebugVm.runInNewContext(fs.readFileSync('cbb-ledger-scorebug.js','utf8'),scorebugContext);
const scorebug=scorebugContext.SLTSportsScorebug;
for(const [outcomes,expectedLights,expectedStreak] of [
  [Array(12).fill('W'),5,'W 12'],
  [['W',...Array(8).fill('L')],5,'L 8'],
  [['W','L','W','W'],4,'W 2']
]){
  const rendered=scorebug.render({phase:'final',away:{scouting:{games:outcomes.length,lastFive:outcomes}},home:{}});
  assert.equal((rendered.match(/class="ledger26-form-bulb /g)||[]).length,expectedLights);
  assert.equal(rendered.match(/class="ledger26-streak"[^>]*>([^<]+)/)?.[1],expectedStreak);
}

const verifiedGames=Array.from({length:12},(_,i)=>({
 id:String(i+1),date:'2026-11-'+String(i+1).padStart(2,'0'),away:'A',home:'B',awayScore:80,homeScore:60
}));
const fullForm=scorebug.verifiedFormIndex([...verifiedGames,verifiedGames[0],{...verifiedGames[0],id:'bad',awayScore:60}]);
assert.equal(scorebug.formAt(fullForm,'A','2026-11-12','12','upcoming').games,11);
assert.equal(scorebug.formAt(fullForm,'A','2026-11-12','12','final').games,12);
assert.equal(scorebug.formAt(fullForm,'A','2026-11-04','4','live').games,3);
assert.match(scorebug.render({phase:'final',away:{scouting:{games:1,lastFive:[{result:'W',gameHref:'ncaam-slate.html?gender=women&date=2026-11-04&game=4'}]}},home:{}}),/href="ncaam-slate\.html\?gender=women&amp;date=2026-11-04&amp;game=4"/);

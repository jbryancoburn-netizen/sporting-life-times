'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const arena=require('../mbb-arena-file.js'),insights=require('../mbb-slate-insights.js');
const reg=read('data/mbb-arena-registry.json'),feature=read('data/mbb-arena-features.json');
const cross=read('data/ncaam-2026-27-espn-team-crosswalk.json');
const men=cross.teams;
assert.equal(men.length,365);
assert.equal(Object.keys(reg.teams).length,365);
assert.equal(feature.schema,'slt-arena-file-v1');
assert.equal(Object.keys(feature.features).length,1);
const indiana=men.find(t=>t.espn_id==='84');
const p=arena.compose(indiana,reg,feature);
assert.equal(p.arena,'Simon Skjodt Assembly Hall');
assert.equal(p.city,'Bloomington');
assert.equal(p.capacity,17222);
assert.equal(p.opened,1971);
assert.equal(p.rededicated,'October 14, 2016');
assert.equal(p.photo.author,'Chris Kuga');
assert.equal(p.photo.copyright,'CC BY 2.0');
assert(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(p.photo.source_url));
assert(p.sources.some(s=>s.url.startsWith('https://iuhoosiers.com/')));
const auburn=men.find(t=>t.espn_id==='2'),plain=arena.compose(auburn,reg,feature);
assert.equal(plain.arena,'Neville Arena');
assert.equal(plain.capacity,null,'unsourced arena capacity must never be guessed');
assert.equal(plain.opened,null,'unsourced year must not be supplied');
assert.equal(plain.photo,null,'must not invent an arena photograph');
assert.equal(plain.hasDeepProfile,false);
assert(plain.note.includes('may not be the site'));
assert.equal(men.map(t=>arena.compose(t,reg,feature)).length,365);
assert(arena.optionList(cross,'Indiana').includes('ncaam-arena.html?team=84'));
assert.equal(arena.teamFromParam(cross,new URLSearchParams('team=84')).name,'Indiana');
const slateHTML=fs.readFileSync('ncaam-slate.html','utf8'),slateJS=fs.readFileSync('ncaam-slate.js','utf8');
const teamHTML=fs.readFileSync('ncaam-team.html','utf8');
assert(slateHTML.includes('mbb-slate-insights.js'));
assert(slateHTML.indexOf('mbb-slate-insights.js')<slateHTML.indexOf('ncaam-slate.js'));
assert(teamHTML.includes('mbb-arena-file.js')&&teamHTML.includes('id="af-inline"'));
for(const phrase of ['sl-season-comparison','sl-game-analytics','sl-leading-players',
  'sl-live-desk','ncaam-arena.html?team='])
 assert(slateJS.includes(phrase),'missing functioning storytelling module '+phrase);
const retro=read('data/ncaam-2026-27-retro-primary.json');
assert.equal(retro.starting_elo,1500);
const profiles=insights.seasonProfiles(retro.events);
assert(profiles.size>=2,'season scoring profiles must reflect verified game ledger');
assert([...profiles.values()].every(p=>p.g===p.w+p.l&&p.homeW+p.homeL<=p.g));
const games=read('data/mbb-live.json');
const known=Object.values(games.ncaa_team_boxscores.games).find(b=>b.gender==='men'&&b.espn_id);
assert(known,'missing published men box sample');
const event={id:String(known.espn_id),day:known.day,phase:'final',kind:'regular',
  away:{score:known.away.pts},home:{score:known.home.pts}};
const box=insights.matchBox(event,games,'men');
assert(box&&box.espn_id===known.espn_id,'no box score from mismatched NCAA/ESPN ID');
const metrics=insights.gameNumbers(event,games,'men');
assert(metrics&&metrics.metrics.some(x=>x.label==='FIELD GOAL %'));
assert(metrics.metrics.some(x=>x.label==='GAME OFFRTG'));
assert(metrics.caveat.includes('Estimated possessions'));
assert.equal(insights.gameNumbers({...event,phase:'live'},games,'men'),null,
  'do not present final-only stat boxes as live stats');
assert.equal(insights.gameNumbers({...event,away:{score:event.away.score+1}},games,'men'),null,
  'disputed score may not receive an authoritative stats panel');
const calibration=read('data/ncaam-score-calibration.json');
assert.equal(calibration.status,'HISTORICAL_HOLDOUT_VALIDATED');
const ratings=new Map(retro.rankings.map(r=>[String(r.team_id),r]));
const rr=retro.rankings.slice(0,2);
const pregame={phase:'upcoming',kind:'regular',probability:.51,
 away:{canonical:rr[0].team_id},home:{canonical:rr[1].team_id}};
const projection=insights.projectedScore(pregame,calibration,ratings);
assert(projection&&projection.home!==projection.away,'calibrated game score must have a winner');
assert(projection.caveat.includes('not a game-specific venue'));
assert.equal(insights.projectedScore({...pregame,probability:null},calibration,ratings),null,
 'unmatched forecasts may not be borrowed');
assert.equal(insights.projectedScore({...pregame,phase:'live'},calibration,ratings),null,
 'game-in-progress cannot show projected score');
assert.equal(insights.projectedScore({...pregame,kind:'exhibition'},calibration,ratings),null,
 'exhibitions cannot show RETRO scoring projection');
assert.equal(insights.projectedScore(pregame,{...calibration,status:'NOT_VERIFIED'},ratings),null);
const found=insights.gameLeaders(event,games,'men');
assert(Array.isArray(found),'missing player box should fail closed, not invent leaders');
assert.equal(insights.scoreDelta({id:'1',day:'2026-11-02',away_score:14,home_score:32},
  {id:'1',day:'2026-11-02',phase:'live',away:{score:17},home:{score:34},status:'5:47 1st'}).away,3);
assert.equal(insights.scoreDelta({id:'1',day:'2026-11-02',away_score:14,home_score:32},
  {id:'1',day:'2026-11-02',phase:'live',away:{score:11},home:{score:34}}),null,
  'reverse movement cannot be a source-verified score delta');
assert.equal(insights.scoreDelta({id:'1',day:'2026-11-02',away_score:14,home_score:32},
  {id:'1',day:'2026-11-02',phase:'final',away:{score:17},home:{score:34}}),null,
  'final games must not be called live runs');
console.log('PASS Arena File + insights: 365 home venues, Indiana official source/CC attribution, no invented photos, authenticated box scores, estimated efficiency, truthful live score deltas, no RETRO contamination.');

const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
require('../cbb-ledger-scorebug.js');
const render=globalThis.SLTSportsScorebug.render;
const away={name:'Away & Town',crest:'<img src="away.svg" alt="">',record:'1–0',retro:'RETRO 1510 (#2)',color:'#223344',score:61};
const home={name:'Home',crest:'<img src="home.svg" alt="">',record:'2–0',retro:'RETRO 1530 (#1)',color:'#445566',score:106};
test('one scorebug, away first, home second',()=>{
 const html=render({phase:'final',away,home});
 assert.equal((html.match(/ledger26-scorebug/g)||[]).length,1);
 assert.ok(html.indexOf('Away &amp; Town')<html.indexOf('Home'));
 assert.ok(html.includes('>61</b>')&&html.includes('>106</b>'));
 assert.equal((html.match(/ledger26-team"/g)||[]).length,2);
});
test('review status visible without leaking unconfirmed scores',()=>{
 const html=render({phase:'upcoming',status:'SOURCE CONFLICT',away,home});
 assert.ok(html.includes('SOURCE CONFLICT'));
 assert.ok(!html.includes('>61</b>')&&!html.includes('>106</b>'));
});
test('men and women use the same renderer',()=>{
 for(const path of ['mbb-newspaper.js','college-basketball-gender.js']){
  const source=fs.readFileSync(require('node:path').join(__dirname,'..',path),'utf8');
  assert.match(source,/SLTSportsScorebug\.render\(/);
  assert.doesNotMatch(source,/<(?:div|article) class="score-card/);
 }
});

test('desktop intelligence preserves row order and hides missing data',()=>{
 const html=render({phase:'live',away,home,status:'2nd 4:44'});
 assert.ok(html.indexOf('Away &amp; Town')<html.indexOf('Home'));
 assert.doesNotMatch(html,/ledger26-timeouts|ledger26-possession|ledger26-points--upset|ledger26-team-run/);
});
test('verified live symbols are conditional and never appear in final or pregame',()=>{
 const road={...away,name:'Road',abbreviation:'RD',poll:{ap:20},score:61,timeoutsRemaining:2};
 const host={...home,poll:{ap:4},score:58,timeoutsRemaining:1};
 const data={away:road,home:host,possession:'away',momentum:{kind:'run',text:'RD 10–0 RUN'}};
 const live=render({...data,phase:'live'});
 assert.match(live,/ledger26-points--upset/);
 assert.match(live,/ledger26-possession/);
 assert.match(live,/ledger26-timeouts/);
 assert.equal((live.match(/ledger26-team-run"/g)||[]).length,1);
 const final=render({...data,phase:'final'});
 assert.doesNotMatch(final,/ledger26-possession|ledger26-team-run|ledger26-points--upset|ledger26-timeouts/);
 const upcoming=render({...data,phase:'upcoming',suppressPress:true});
 assert.doesNotMatch(upcoming,/ledger26-possession|ledger26-team-run|ledger26-points--upset|ledger26-timeouts/);
});

test('mobile rules keep compact live symbols and omit extra labels',()=>{
 const stylesheet=fs.readFileSync(require('node:path').join(__dirname,'..','cbb-ledger-scorecard.css'),'utf8');
 assert.match(stylesheet,/\.ledger26-points--upset\{border:2px solid/);
 const mobile=stylesheet.slice(stylesheet.indexOf('/* Compact live scorebug signals'));
 assert.match(mobile,/\.ledger26-timeout-label\{display:none\}/);
 assert.match(mobile,/\.ledger26-timeouts i\{width:4px;height:4px\}/);
 assert.doesNotMatch(mobile,/ledger26-timeouts,.ledger26-possession,.ledger26-team-run\{display:none\}/);
});

test('pregame scouting uses verified samples and is absent after tipoff',()=>{
 const info={games:3,pointsFor:82.4,pointsAgainst:69.1,lastFive:['W','L','W']};
 const a={...away,scouting:info},h={...home,scouting:info};
 const game={away:a,home:h,rivalry:{name:'Regional rivalry',seasonH2H:{away:1,home:0}},suppressPress:true};
 const pre=render({...game,phase:'upcoming'});
 assert.match(pre,/82.4 PPG/);
 assert.match(pre,/69.1 allowed/);
 assert.match(pre,/2026–27 H2H 1–0/);
 assert.equal((pre.match(/ledger26-form-w/g)||[]).length,4);
 for(const phase of ['live','final']){
  const out=render({...game,phase});
  assert.doesNotMatch(out,/ledger26-scout|ledger26-rivalry|82.4 PPG|2026–27 H2H/);
 }
});

test('pregame shows only one compact RETRO forecast',()=>{
 const projection=render({phase:'upcoming',away,home,suppressPress:true,forecast:{
  team:'Home',probability:0.72,margin:5.5,projectedAwayScore:72,projectedHomeScore:78
 }});
 assert.match(projection,/72%/);
 assert.match(projection,/−5\.5/);
 assert.match(projection,/RETRO FORECAST/);
 assert.doesNotMatch(projection,/PROJECTED FINAL|72–78|WIN CHANCE|PROJECTED SPREAD/);
 assert.equal((projection.match(/ledger26-pregame-prob/g)||[]).length,1);
 for(const phase of ['live','final']){
  const out=render({phase,away,home,suppressPress:true,forecast:{
   team:'Home',probability:0.72,margin:5.5,projectedAwayScore:72,projectedHomeScore:78
  }});
  assert.doesNotMatch(out,/RETRO FORECAST|PROJECTED FINAL/);
 }
});
test('pregame verified form has compact streak and disappears at tipoff',()=>{
 const a={...away,scouting:{games:5,pointsFor:80,pointsAgainst:65,lastFive:['L','W','W','W','W']}};
 assert.match(render({phase:'upcoming',away:a,home,suppressPress:true}),/W4/);
 assert.doesNotMatch(render({phase:'live',away:a,home,suppressPress:true}),/ledger26-streak/);
});

test('ledger cards have a single pregame forecast presentation',()=>{
 const slate=fs.readFileSync(require('node:path').join(__dirname,'..','ncaam-slate.js'),'utf8');
 const receipt=fs.readFileSync(require('node:path').join(__dirname,'..','cbb-forecast-receipt.js'),'utf8');
 assert.doesNotMatch(slate,/RETRO EXPECTED SCORE|ledgerScorebug\(g\)\+scoreNote|\+when\+retro\+right/);
 assert.match(receipt,/set\(summary,status==='upcoming'\?'':markup\)/);
 assert.match(receipt,/set\(summary,status==='upcoming'\?'':receipt\('women'/);
});

test('pregame favorite and probability share one row, margin and label share another',()=>{
 const output=render({phase:'upcoming',away,home,suppressPress:true,forecast:{team:'Home',probability:.84,margin:12.5}});
 assert.match(output,/ledger26-pregame-inline--prob/);
 assert.match(output,/ledger26-pregame-inline--margin/);
 assert.match(output,/<strong class="ledger26-pregame-edge">−12\.5<\/strong>\s*<span class="ledger26-pregame-caption">RETRO MARGIN<\/span>/);
 assert.doesNotMatch(output,/PROJECTED FINAL|PROJECTED SPREAD|WIN CHANCE/);
 assert.doesNotMatch(render({phase:'final',away,home,suppressPress:true}),/ledger26-pregame-inline/);
});

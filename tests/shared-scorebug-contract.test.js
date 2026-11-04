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

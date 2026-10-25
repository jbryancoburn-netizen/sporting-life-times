/* Newspaper structure regression tests; run with node --test tests/*.test.cjs */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const pages=fs.readFileSync('edition-pages.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const desks=fs.readFileSync('department-stories.js','utf8');
const app=fs.readFileSync('app.js','utf8');
test('every edition section is defined in the newspaper HTML',()=>{
 const block=pages.match(/const editions=\[([\s\S]*?)\];/);
 assert.ok(block,'edition configuration exists');
 const ids=[...block[1].matchAll(/ids:\[([^\]]+)\]/g)].flatMap(m=>[...m[1].matchAll(/'([^']+)'/g)].map(x=>x[1]));
 assert.ok(ids.length>=14,'expected full newspaper section inventory');
 assert.equal(new Set(ids).size,ids.length,'duplicate edition section');
 for(const id of ids)assert.match(html,new RegExp('id=["\\\']'+id+'["\\\']'),'missing section '+id);
});
test('football department does not include UFL and explicitly excludes UFL stories',()=>{
 assert.match(desks,/'pro-football':/);
 assert.match(desks,/id!=='pro-football'\|\|!/);
 assert.match(desks,/ufl/);
 assert.doesNotMatch(html,/NFL\s*[·|/]\s*CFL\s*[·|/]\s*UFL/i);
});
test('shared scoreboard renderer is reused by newspaper sections',()=>{
 assert.match(app,/function registerGames\(/);
 assert.match(app,/function teamRows\(/);
 assert.ok((app.match(/registerGames\(/g)||[]).length>=2,'register renderer should be reused');
});

test('mastheads have no nested home links',()=>{
 for(const name of ['nba.html','forecast-desk.html','sports.html','epl.html','match-center.html']){
  const page=fs.readFileSync(name,'utf8');
  assert.doesNotMatch(page,/<a\b[^>]*>\s*<a\b/i,name+' has invalid nested anchors');
  assert.match(page,name==='nba.html'?/<a href="index.html" class="nba-publication-title">/:/<a class="newspaper-wordmark" href="index.html"/,name+' missing home link');
 }
});

test('all primary newspaper pages share the exact front-page masthead and design layer',()=>{
 const targets=['digital-edition.html','epl-club.html','epl-elo.html','epl.html','forecast-desk.html','match-center.html','nba.html','sports.html','team.html'];
 for(const name of targets){
  const page=fs.readFileSync(name,'utf8');
  assert.match(page,/<body class="edition-interior(?: [^"]+)?">/,name+' missing shared edition scope');
  assert.match(page,/edition-design\.css\?v=[a-z0-9-]+/,name+' missing newspaper style');
  assert.match(page,name==='nba.html'?/class="nba-publication-title">The Sporting Life &amp; Times/:/The Sporting Life <span class="newspaper-wordmark-amp">&amp;<\/span> Times/,name+' missing front-page masthead');
  assert.match(page,/aria-label="Main navigation"/,name+' missing common navigation');
 }
});
test('front page reserves additional space for sourced stories',()=>{
 assert.match(html,/id="front-more-stories"/);
 assert.match(app,/slice\(8,20\)/);
});

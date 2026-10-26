/* Newspaper structure regression tests — accept either the original paged edition
   or the intentional sports-desk home page. Check the MBB-style EPL shell directly. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const pages=fs.readFileSync('edition-pages.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const desks=fs.readFileSync('department-stories.js','utf8');
const app=fs.readFileSync('app.js','utf8');
const sportsFront=/id="league-search"/.test(html)&&/THE SPORTS DESKS/.test(html);
test('edition registry is consistent with the active newspaper home page',()=>{
 const block=pages.match(/const editions=\[([\s\S]*?)\];/);
 assert.ok(block,'edition configuration exists');
 const ids=[...block[1].matchAll(/ids:\[([^\]]+)\]/g)].flatMap(m=>[...m[1].matchAll(/'([^']+)'/g)].map(x=>x[1]));
 assert.ok(ids.length>=14,'expected full newspaper edition registry');
 assert.equal(new Set(ids).size,ids.length,'duplicate edition section');
 if(sportsFront){
  assert.match(html,/class="hub league-hub"/);
  assert.match(html,/id="league-search"/);
  assert.ok((html.match(/class="league-directory-section"/g)||[]).length>=10,'sport categories missing');
  assert.ok((html.match(/class="league-directory-link"/g)||[]).length>=35,'league desks missing');
  for(const href of [...html.matchAll(/class="league-directory-link" href="([^"]+)"/g)].map(x=>x[1]))assert.ok(fs.existsSync(href),'missing linked league desk '+href);
 }else for(const id of ids)assert.match(html,new RegExp('id=["\\\']'+id+'["\\\']'),'missing section '+id);
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
test('mastheads have one valid home link on each primary page',()=>{
 for(const name of ['nba.html','forecast-desk.html','sports.html','epl.html','match-center.html']){
  const page=fs.readFileSync(name,'utf8');
  assert.doesNotMatch(page,/<a\b[^>]*>\s*<a\b/i,name+' has invalid nested anchors');
  const rx=name==='nba.html'?/<a href="index.html" class="nba-publication-title">/:name==='epl.html'?/<div class="slt-masthead"><a href="index.html">The Sporting Life &amp; Times<\/a>/:/<a class="newspaper-wordmark" href="index.html"/;
  assert.match(page,rx,name+' missing home link');
 }
});
test('primary newspaper pages keep edition identity and navigation',()=>{
 const targets=['digital-edition.html','epl-club.html','epl-elo.html','epl.html','forecast-desk.html','match-center.html','nba.html','sports.html','team.html'];
 for(const name of targets){
  const page=fs.readFileSync(name,'utf8');
  assert.match(page,/<body class="edition-interior(?: [^"]+)?">/,name+' missing shared edition scope');
  assert.match(page,/edition-design\.css\?v=[a-z0-9-]+/,name+' missing newspaper style');
  const title=name==='nba.html'?/class="nba-publication-title">The Sporting Life &amp; Times/:name==='epl.html'?/class="slt-masthead"><a href="index.html">The Sporting Life &amp; Times<\/a>/:/The Sporting Life <span class="newspaper-wordmark-amp">&amp;<\/span> Times/;
  assert.match(page,title,name+' missing front-page masthead');
  assert.match(page,name==='epl.html'?/aria-label="Premier League navigation"/:/aria-label="Main navigation"/,name+' missing editorial navigation');
 }
});
test('home page retains its intended reader pathway',()=>{
 if(sportsFront){
  assert.match(html,/id="league-search"/);
  assert.match(html,/href="epl.html"/);
  assert.match(html,/href="college-basketball.html"/);
 }else{
  assert.match(html,/id="front-more-stories"/);
  assert.match(app,/slice\(8,20\)/);
 }
});
test('Premier League follows the MBB edition structure and preserves its verified desks',()=>{
 const page=fs.readFileSync('epl.html','utf8');
 assert.match(page,/class="edition-interior slt-epl-mbb"/);
 assert.match(page,/epl-mbb\.css/);
 const required=['epl-hero-clubs','epl-score-rail','epl-table-board','epl-power-board','epl-independent-news','epl-race-watch','epl-player-leaders','epl-featured','forecast-grid','epl-club-directory','epl-season-archive'];
 for(const id of required)assert.match(page,new RegExp('id="'+id+'"'),'missing EPL desk '+id);
 assert.match(page,/class="slt-columns"/);
 assert.ok((page.match(/class="slt-column"/g)||[]).length===3,'expected the three MBB editorial columns');
 const visual=fs.readFileSync('epl-visual-desk.js','utf8');
 for(const id of ['epl-table-board','epl-power-board','epl-score-rail','epl-club-directory'])assert.ok(visual.includes(id),'EPL visual data feed not wired into '+id);
});

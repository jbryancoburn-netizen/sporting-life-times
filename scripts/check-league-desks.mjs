import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const read=p=>fs.readFileSync(p,'utf8');
const index=read('sports.html');
const js=read('league-desks.js');
const css=read('league-desk.css');
assert(index.includes('id="league-search"'),'directory search missing');
assert(css.includes('@media(max-width:650px)'),'mobile layout missing');
const found=[...index.matchAll(/class="league-directory-link" href="([^"]+\.html)"/g)].map(m=>m[1]);
assert.equal(new Set(found).size,found.length,'duplicate desk links');
assert(found.length>=35,'the broader sports directory is incomplete');
const basketball=['nba.html','euroleague.html','nbl.html','bbl.html'];
const pro=index.match(/<h2>Professional Basketball<\/h2>([\s\S]*?)<\/section>/)?.[1]||'';
const proLinks=[...pro.matchAll(/href="([^"]+\.html)"/g)].map(m=>m[1]);
assert.deepEqual(proLinks,basketball,'professional basketball must list exactly the four approved desks');
for(const page of found){
 assert(fs.existsSync(page),'missing dedicated page: '+page);
 const html=read(page);
 assert(html.includes('THE SPORTING LIFE')||html.includes('The Sporting Life'),'masthead missing: '+page);
 assert(html.includes('sports.html'),'return navigation missing: '+page);
 if(!['nba.html','epl.html'].includes(page)){
  for(const id of ['league-news-grid','league-standings-table','league-final-lines','league-result-ledger','league-upcoming-games','league-snapshot'])assert(html.includes('id="'+id+'"'),id+' missing from '+page);
  assert(html.includes('league-desks.js'),'shared data loader missing: '+page);
 }
}
for(const page of ['euroleague.html','nbl.html','college-basketball.html','nfl.html','mlb.html','nhl.html','champions-league.html'])assert(found.includes(page),'important league absent: '+page);
const scores=JSON.parse(read('multi_scoreboards.json'));for(const l of scores.leagues){
 const escaped=JSON.stringify(l.league).slice(1,-1);
 assert(js.includes(escaped),'published scoreboard league not mapped to desk: '+l.league);
}
for(const p of ['league-desks.js']){const check=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});assert.equal(check.status,0,p+' syntax invalid: '+check.stderr)}
console.log('PASS: '+found.length+' unique league desks, navigation, page sections, scoreboard mapping, mobile CSS, and shared JS syntax');

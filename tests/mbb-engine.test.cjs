const assert=require('node:assert/strict');
const fs=require('node:fs');
const E=require('../mbb-engine.js');
const teams=JSON.parse(fs.readFileSync(__dirname+'/../data/ncaam-2026-27-preseason-player-quality-live.json')).rankings;
const f=E.field(teams);
assert.equal(f.selected.length,76);assert.equal(new Set(f.selected.map(t=>t.team_id)).size,76);
assert.equal(f.auto.length,32);assert.equal(f.at.length,44);assert.equal(f.opening.length,12);
assert.equal(f.opening.filter(x=>x.bid==='AQ').length,6);
const slots=Object.values(f.bracket).flatMap(Object.values);
assert.equal(slots.length,64);assert.equal(slots.flatMap(s=>s.teams).length,76);
assert.equal(new Set(slots.flatMap(s=>s.teams.map(t=>t.team_id))).size,76);
for(const r of Object.values(f.bracket)){assert.equal(Object.keys(r).length,16);for(const [a,b] of E.pairs){assert.equal(r[a].site?.city,r[b].site?.city);}}
for(const s of slots){assert(s.site,'every slot has a venue');if(s.teams.some(t=>/Brigham Young|^BYU$/.test(t.team)))assert.equal(s.site.fri,false,'BYU cannot play Sunday');}
for(const o of f.opening)assert.equal(o.teams.length,2);
const [a,b]=teams;const result={home:a.team_id,away:b.team_id,home_score:80,away_score:70,site:'neutral'};
const resumes=E.resume([a,b],[result]);assert.equal(resumes[0].resume.w,1);assert.equal(resumes[1].resume.l,1);assert.equal(resumes[0].resume.netGames,0);assert.equal(resumes[0].resume.road,0);
// Published neutral-site finals must be counted once, never as road wins.
const published={season:'2026-27',model:'retro-clean-slate',games_played:1,events:[{
 id:'espn:401920982',date:'2026-11-01',home_id:a.team_id,away_id:b.team_id,
 home_score:72,away_score:74,neutral:true,site_verified:true
}]};
const verified=E.verifiedGames(published,{season:'2026-27',games:[]});
assert.equal(verified.length,1,'the RETRO result cannot vanish when the second ledger is empty');
const neutral=E.resume([a,b],verified);
assert.equal(neutral[1].resume.w,1);
assert.equal(neutral[1].resume.road,0,'neutral-site victories are not road wins');
assert.equal(E.verifiedGames({...published,events:[...published.events,...published.events],games_played:2},{games:[]}).length,1,'duplicate finals must not replay');
assert.equal(E.verifiedGames({...published,events:[{...published.events[0],home_score:null}]},{games:[]}).length,0,'unscored games must not affect resumes');
assert.equal(E.resume([a,b],[{...verified[0],away_score:undefined}])[0].resume.n,0,'scheduled games cannot count as losses');
const newsCode=fs.readFileSync(__dirname+'/../mbb-newspaper.js','utf8');
const comparisonCode=fs.readFileSync(__dirname+'/../mbb-selection-comparison.js','utf8');
assert(newsCode.includes('games=MBBEngine.verifiedGames(next,ledger)'));
assert.match(newsCode,/mbb:ratings-updated/);
assert.match(comparisonCode,/mbb:ratings-updated/);
console.log('PASS: 76 unique entrants, 32 AQ, 44 at-large, 12 opening games, 64 slots, venue paths, BYU and résumé accounting.');
console.log('Placement review:',f.violations);

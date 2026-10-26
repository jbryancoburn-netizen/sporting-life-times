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
console.log('PASS: 76 unique entrants, 32 AQ, 44 at-large, 12 opening games, 64 slots, venue paths, BYU and résumé accounting.');
console.log('Placement review:',f.violations);

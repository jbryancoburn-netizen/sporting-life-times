'use strict';
// Run directly: node tests/retro-men-only-integration.test.cjs
// Scope: men's Division I RETRO only; does not inspect NBA or women's pages.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const engine=require('../retro-forecast-engine.js');
for(const [page,consumer] of [
 ['ncaam-elo.html','mbb-elo-primary.js'],
 ['ncaam-predictor.html','ncaam-score-model.js'],
 ['ncaam-slate.html','ncaam-slate.js']
]){
 const html=read(page);
 const source=html.indexOf('retro-forecast-engine.js');
 const dependent=html.indexOf(consumer);
 assert.ok(source>=0&&dependent>source,page+' must load RETRO engine before '+consumer);
}
assert.match(read('mbb-elo-primary.js'),/RETROForecast\.predict\(A,B/);
assert.match(read('ncaam-score-model.js'),/RETROForecast\?\.predict\(home,away/);
assert.match(read('ncaam-slate.js'),/RETROForecast\.predict\(home,away/);
assert.match(read('ncaam-forecast-engine.js'),/RETROForecast\.probability\(a,b,'neutral'\)/);
for(const eloGap of [-300,-100,0,100,300]){
 const a={elo:1500+eloGap},b={elo:1500};
 const n=engine.predict(a,b,{site:'neutral'});
 const h=engine.predict(a,b,{site:'home'});
 const v=engine.predict(a,b,{site:'away'});
 assert.ok(n.homeProbability>=0&&n.homeProbability<=1);
 assert.ok(Math.abs(n.homeProbability+n.awayProbability-1)<1e-12);
 assert.ok(h.homeProbability>n.homeProbability&&n.homeProbability>v.homeProbability);
 assert.ok(Math.abs(n.homeProbability-engine.predict(b,a,{site:'neutral'}).awayProbability)<1e-12);
}
console.log('PASS: men-only RETRO probability and static page integrations');

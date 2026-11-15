'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const insight=require('../mbb-slate-insights.js');
const slate=require('../ncaam-slate.js');
const data=p=>JSON.parse(fs.readFileSync(p,'utf8'));

test('the score gap ALWAYS agrees with the displayed margin even with half-point source spreads',()=>{
 const a={g:3,pf:317,pa:219},h={g:3,pf:267,pa:244};
 for(const m of [-21.5,-9,-7.5,-3,-1.5,-.5,0,.5,1.5,3,7.5,9,21.5]){
  const p=insight.forecastScorePair(m,a,h,72.74794);
  assert(p&&Number.isSafeInteger(p.home)&&Number.isSafeInteger(p.away));
  assert.equal(p.home-p.away,p.displayHomeMargin,'score and margin disagree: '+m);
  assert.equal(Math.sign(p.displayHomeMargin),Math.sign(m),'wrong projected winner: '+m);
  assert(Math.abs(p.displayHomeMargin-m)<=.5,'rounded projected margin drifts: '+m);
  assert.equal(p.home+p.away,p.projectedTotal);
 }
});
test('verified team scoring rates can produce meaningfully different game totals',()=>{
 const high={g:3,pf:318,pa:246},fastOpponent={g:4,pf:352,pa:327};
 const low={g:3,pf:177,pa:162},slowOpponent={g:4,pf:236,pa:208};
 const highPair=insight.forecastScorePair(3,high,fastOpponent,72.74794);
 const lowPair=insight.forecastScorePair(3,low,slowOpponent,72.74794);
 assert(highPair.projectedTotal-lowPair.projectedTotal>=20,'the forecast must not regress to virtually identical totals');
 assert.equal(highPair.home-highPair.away,3);
 assert.equal(lowPair.home-lowPair.away,3);
});
test('the 2026–27 source-backed season profiles connect to scheduled games without guessing play counts',()=>{
 const season=data('data/ncaam-2026-27-retro-primary.json');
 const games=slate.normalizeMen(data('data/mbb-live.json'),data('data/ncaam-2026-27-upcoming-forecasts.json'),
  data('data/ncaam-2026-27-espn-team-crosswalk.json'));
 const rates=insight.seasonProfiles(season.events),mean=data('data/ncaam-score-calibration.json').parameters.mean_team_points;
 const fixtures=games.filter(g=>g.phase==='upcoming'&&Number.isFinite(g.projectedHomeMargin)&&
  g.away.canonical&&g.home.canonical);
 assert(fixtures.length>0,'no centrally published scheduled RETRO forecasts');
 for(const g of fixtures){
  const proj=insight.forecastScorePair(g.projectedHomeMargin,
   rates.get(String(g.away.canonical)),rates.get(String(g.home.canonical)),mean);
  assert(proj&&proj.away>=0&&proj.home>=0,'missing fixture projected scores: '+g.id);
  assert.equal(proj.home-proj.away,proj.displayHomeMargin,'unmatched score gap: '+g.id);
 }
 const text=fs.readFileSync('ncaam-slate.js','utf8');
 assert(text.includes('insight?.forecastScorePair('));
 assert(!text.includes('const weight=n/(n+5)'),'over-shrunk identical totals returned');
 assert(text.includes('margin:aligned?Math.abs(aligned.displayHomeMargin)'));
});

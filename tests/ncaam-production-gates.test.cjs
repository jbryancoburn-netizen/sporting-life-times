const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const updater=fs.readFileSync('scripts/update_ncaam_2027.py','utf8');
const page=fs.readFileSync('ncaam-elo-page.js','utf8');
test('NCAA current-season updater enforces complete membership and source integrity',()=>{
 assert.match(updater,/len\(current\)!=365/);
 assert.match(updater,/Duplicate\/missing contest ID/);
 assert.match(updater,/future-dated result/);
 assert.match(updater,/NCAA Elo conservation failure/);
});
test('NCAA page keeps scoring-quality research unapproved and a validated baseline',()=>{
 assert.match(page,/production_elo_approved!==false/);
 assert.match(page,/preseason_asof_certified!==false/);
 assert.match(page,/SHADOW_ONLY_DO_NOT_PROMOTE/);
 assert.match(page,/const available=\{baseline\}/);
 assert.match(page,/if\(current\?\.games_played>0\)available\.current=current/);
});
test('NCAA page communicates uncertain roster timing and experimental status',()=>{
 const html=fs.readFileSync('ncaam-elo.html','utf8');
 assert.match(html,/Historical first-day rosters have not been verified/);
 assert.match(html,/improvement does not certify an opening-day adjustment/);
 assert.match(html,/Players lacking sufficient evidence are not assigned synthetic value/);
});
test('Historical opponent backtest reports a real full-coverage two-track fallback',()=>{
 const code=fs.readFileSync('scripts/backtest_ncaam_opponent_quality.py','utf8');
 assert.match(code,/coverage_fallback=True/);
 assert.match(code,/step\(plain,h,a,hs,aws\)/);
 assert.match(code,/holdout_all_games_enhanced_with_fallback/);
 assert.match(code,/fallback_all_windows_improve_both_metrics/);
});

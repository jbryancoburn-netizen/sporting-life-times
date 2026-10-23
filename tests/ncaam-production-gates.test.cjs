const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const updater=fs.readFileSync('scripts/update_ncaam_2027.py','utf8');
const page=fs.readFileSync('ncaam-elo-page.js','utf8');
test('Python updater contains no literal escaped newlines in source logic',()=>{
 assert.ok(!updater.includes('approved=False\\n'));
 assert.ok(updater.includes('candidate.get("identity_verified") is True'));
 assert.ok(updater.includes('candidate.get("preseason_information_integrity_verified") is True'));
 assert.ok(updater.includes('candidate.get("production_elo_approved") is True'));
});
test('NCAA page excludes unapproved shadow and preserves baseline',()=>{
 assert.ok(!page.includes('const rosterAuditPassed=roster?.audit?.release_approved===true;\\n'));
 assert.ok(page.includes('roster?.audit?.release_approved===true'));
 assert.ok(page.includes('const available={baseline}'));
});

test('NCAA page explains that published baseline is not the unapproved roster shadow',()=>{
 const html=fs.readFileSync('ncaam-elo.html','utf8');
 assert.match(html,/Player-based adjustments are experimental and are not included in the official ratings/);
 assert.match(html,/historical roster timing and cross-provider identities are not verified/);
});
test('Historical opponent backtest reports a real full-coverage two-track fallback',()=>{
 const code=fs.readFileSync('scripts/backtest_ncaam_opponent_quality.py','utf8');
 assert.match(code,/coverage_fallback=True/);
 assert.match(code,/step\(plain,h,a,hs,aws\)/);
 assert.match(code,/holdout_all_games_enhanced_with_fallback/);
 assert.match(code,/fallback_all_windows_improve_both_metrics/);
});

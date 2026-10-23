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

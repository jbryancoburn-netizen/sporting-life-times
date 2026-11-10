'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('wbb-game-results.js','utf8');
const window={};vm.runInNewContext(code,{window,Date,Map,Set,Number,String,Array});
const {merge,scoreFor}=window.WBBGameResults;
const g={id:'401920983',date:'2026-11-01T17:00Z',home_id:'222',away_id:'87',
  site:'neutral',opponent_id:'222',opponent:'Villanova Wildcats',completed:false};
const final={id:'401920983',date:'2026-11-01T17:00Z',home_id:'222',away_id:'87',
  home_score:75,away_score:99,status:'final',score_evidence:'espn_final_ncaa_pending'};
const ledger={season:'2026-27',games:[final]};
test('neutral-site game final arrives on women’s team schedule with correct W/L and provenance',()=>{
  const away=merge([g],ledger,'87');
  assert.equal(away.matched,1);
  assert.equal(away.games[0].completed,true);
  assert.equal(scoreFor(away.games[0],'87').value,'W 99–75');
  assert.match(scoreFor(away.games[0],'87').detail,/NCAA check pending/);
  const home=merge([{...g,opponent_id:'87'}],ledger,'222');
  assert.equal(scoreFor(home.games[0],'222').value,'L 75–99');
  assert.equal(g.completed,false,'master schedule is never mutated');
});
test('swapped non-neutral site identity keeps correct result while requiring site review',()=>{
  const game={...g,site:'away'};
  const reversed={...final,home_id:'87',away_id:'222',home_score:99,away_score:75};
  const result=merge([game],{season:'2026-27',games:[reversed]},'87');
  assert.equal(result.matched,1);
  assert.equal(scoreFor(result.games[0],'87').value,'W 99–75');
  assert.match(scoreFor(result.games[0],'87').detail,/site disputed/);
});
test('ledger cannot silently attach a final to a different opponent',()=>{
  const result=merge([{...g,opponent_id:'999'}],ledger,'87');
  assert.equal(result.matched,0);
  assert.deepEqual(Array.from(result.conflicts),['401920983']);
  assert.equal(scoreFor(result.games[0],'87').value,'Review');
});

test('neutral-site reversed home designations orient scores to each actual school',()=>{
  const swapped={...final,home_id:'87',away_id:'222',home_score:99,away_score:75,neutral:true};
  const away=merge([g],{season:'2026-27',games:[swapped]},'87');
  const home=merge([{...g,opponent_id:'87'}],{season:'2026-27',games:[swapped]},'222');
  assert.equal(away.matched,1);
  assert.equal(home.matched,1);
  assert.equal(scoreFor(away.games[0],'87').value,'W 99–75');
  assert.equal(scoreFor(home.games[0],'222').value,'L 75–99');
});

test('only the women’s 2026–27 season is accepted',()=>{
  const result=merge([g],{season:'2025-26',games:[final]},'87');
  assert.equal(result.matched,0);
  assert.equal(scoreFor(result.games[0],'87').value,'—');
});
test('duplicate source IDs and malformed scores fail closed',()=>{
  const duplicate=merge([g],{season:'2026-27',games:[final,{...final,home_score:71}]},'87');
  assert.equal(duplicate.matched,0);
  const broken=merge([g],{season:'2026-27',games:[{...final,home_score:'75-76'}]},'87');
  assert.equal(broken.matched,0);
});
test('an event more than 48 hours away is never attached solely by ID',()=>{
  const shifted=merge([g],{season:'2026-27',games:[{...final,date:'2027-01-01T17:00Z'}]},'87');
  assert.equal(shifted.matched,0);
});
test('NCAA-origin corroboration source is preserved without leaking current men’s data',()=>{
  const result=merge([g],{season:'2026-27',games:[{...final,score_evidence:'espn_and_ncaa_origin'}]},'87');
  assert.match(scoreFor(result.games[0],'87').detail,/NCAA-origin confirmed/);
});

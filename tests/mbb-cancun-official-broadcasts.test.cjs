const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('Four official 2026 Cancun Challenge broadcasts match exact 2026-27 schedules',()=>{
 const proof=JSON.parse(fs.readFileSync('data/mbb-20261101-cancun-verified-broadcasts.json','utf8'));
 assert.equal(proof.broadcast_fields_added,4);
 assert.equal(proof.records.length,4);
 for(const item of proof.records){
  const data=JSON.parse(fs.readFileSync('data/mbb-schedules-2026-27/'+item.school_id+'.json','utf8'));
  const match=data.events.filter(e=>e.id===item.event_id&&e.date.slice(0,10)===item.date);
  assert.equal(match.length,1,'No exact fixture '+item.event_id);
  const game=match[0],comp=game.competitions[0],ids=comp.competitors.map(x=>String(x.team?.id));
  assert(ids.includes(item.school_id)&&ids.includes(item.opponent_id));
  assert.equal(game.neutralSite,true);
  assert.equal(comp.venue.arenaName,'Hard Rock Hotel Riviera Maya Convention Center');
  assert.equal(comp.broadcasts.length,1);
  assert.deepEqual(comp.broadcasts[0].names,['FloCollege']);
  assert.equal(comp.broadcasts[0].source_url,proof.source);
  assert.equal(game.broadcast_source_url,proof.source);
 }
});
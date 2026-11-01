const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const report=JSON.parse(fs.readFileSync('data/mbb-20261101-official-tournament-arena-batch.json','utf8'));
test('28 newly corrected tournament arena fields preserve exact opponents and existing IDs',()=>{
 assert.equal(report.season,'2026-27');
 assert.equal(report.changed_schedule_records,28);
 const seen=new Set(),loaded=new Map(),schoolIds=new Set();
 for(const group of report.groups){
  assert(/^https:\/\//.test(group.source));
  for(const item of group.records){
   const key=item.school_id+'|'+item.event_id;
   assert(!seen.has(key),'same schedule record must not appear twice: '+key);
   seen.add(key);schoolIds.add(item.school_id);
   if(!loaded.has(item.school_id))
    loaded.set(item.school_id,JSON.parse(fs.readFileSync('data/mbb-schedules-2026-27/'+item.school_id+'.json','utf8')));
   const file=loaded.get(item.school_id);
   const events=file.events.filter(e=>e.id===item.event_id);
   assert.equal(events.length,1,'original ID not preserved: '+key);
   const e=events[0],comp=e.competitions?.[0],v=comp?.venue;
   assert.equal(e.date.slice(0,10),item.date,key+' date');
   assert.equal(e.neutralSite,true,key+' should be a confirmed neutral game');
   const teams=comp.competitors.map(t=>String(t.team?.id));
   assert(teams.includes(item.school_id),'own team ID missing: '+key);
   assert(teams.includes(item.opponent_id),'specific opposing ID missing: '+key);
   assert.equal(v.arenaName,group.arena,key+' venue');
   assert.equal(v.arena_source_url,group.source,key+' official source');
   assert(v.arenaName_verified_via,'source classification absent: '+key);
  }
 }
 assert.equal(seen.size,28);
 assert.equal(schoolIds.size,report.distinct_school_files);
});
test('published 2026-27 baseline is described as historical, not a current perfect audit',()=>{
 assert.equal(report.baseline_2026_11_01.school_files,365);
 assert.equal(report.baseline_2026_11_01.missing_arena_fields,313);
 assert.match(report.note,/not a new all-365-site rescan/);
});
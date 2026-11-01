const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const load=id=>JSON.parse(fs.readFileSync('data/mbb-schedules-2026-27/'+id+'.json','utf8'));
const cases=[
 ['103','school-103-2026-11-26-7','2116','State Farm Field House',33],
 ['103','school-103-2026-11-27-8','2132','State Farm Field House',33],
 ['2116','school-2116-2026-11-26-24','103','State Farm Field House',27],
 ['2132','cross-school-2132-2026-11-27_103','103','State Farm Field House',35]
];
test('2026 ESPN Events Invitational preserves exact fixtures and official venue on both sides',()=>{
 const source='https://bceagles.com/news/2026/8/6/fields-revealed-for-mens-basketball-2026-espn-events-invitational-at-walt-disney-world-resort';
 for(const [school,id,opp,arena,count] of cases){
  const file=load(school);
  assert.equal(file.events.length,count,'no games dropped: '+school);
  const matches=file.events.filter(x=>x.id===id);
  assert.equal(matches.length,1,'unique preserved game ID '+id);
  const e=matches[0],c=e.competitions[0];
  assert.equal(e.neutralSite,true,id+' must be neutral');
  assert(c.competitors.some(t=>String(t.team?.id)===school));
  assert(c.competitors.some(t=>String(t.team?.id)===opp),'correct opposing school '+id);
  assert.equal(c.venue.arenaName,arena);
  assert.equal(c.venue.arena_source_url,source);
  assert.equal(c.venue.official_school_city,'Kissimmee, Fla.');
 }
});
test('Harvard visits the actual Division III University of Chicago, not Chicago State',()=>{
 const file=load('108');
 assert.equal(file.events.length,30,'preserve Harvard schedule count');
 const event=file.events.find(x=>x.id==='school-108-2026-11-08-15');
 assert(event&&event.date.startsWith('2026-11-08'));
 assert.equal(event.name,'University of Chicago');
 assert.equal(event.competitions[0].competitors.length,2);
 const visitor=event.competitions[0].competitors.find(x=>x.team.id==='108');
 const host=event.competitions[0].competitors.find(x=>x!==visitor);
 assert.equal(visitor.homeAway,'away');assert.equal(host.homeAway,'home');
 assert.equal(host.team.displayName,'University of Chicago Maroons');
 assert.equal(host.team.id,'','must not borrow Chicago State D-I ID');
 assert.equal(host.team.logo,'','must not borrow Chicago State crest');
 assert.equal(event.competitions[0].venue.arenaName,'Ratner Athletic Center');
 assert.equal(event.official_school_time,'2:00 PM ET');
 assert.match(event.opponent_identity_source_url,/athletics\.uchicago\.edu/);
});
test('official evidence ledger tracks every actual edited record',()=>{
 const report=JSON.parse(fs.readFileSync('data/mbb-20261101-verified-calendar-repairs.json','utf8'));
 assert.equal(report.changes.length,5);
 assert.equal(report.arena_fields_added,5);
 assert.equal(report.misidentified_opponents_corrected,1);
 assert.equal(report.preserved_game_ids,true);
});
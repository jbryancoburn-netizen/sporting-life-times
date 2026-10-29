#!/usr/bin/env node
'use strict';
// Execute the exact poll renderer against the published AP/Coaches Top 25.
// Catch missing badges caused by name aliases or future school renamings.
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const source=fs.readFileSync('mbb-newspaper.js','utf8');
const line=source.split('\n').find(s=>s.startsWith("function poll(which='ap')"));
assert(line,'College basketball poll renderer not found');
const polls=read('data/ncaam-2026-27-national-polls.json');
const teams=read('data/ncaam-2026-27-retro-primary.json').rankings;
const cross=read('data/ncaam-2026-27-espn-team-crosswalk.json');
const registry=read('data/mbb-logo-registry.json').teams;
const logged=[];
const context={
 polls,teams,cross,
 esc:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
 url:u=>u,
 empty:s=>s,
 name:t=>{
  const c=cross.teams.find(x=>x.id===t.team_id);
  assert(c,'Missing school crosswalk: '+t.team);
  const logo=registry[String(c.espn_id)];
  assert(logo?.canonical_id===t.team_id,'Logo belongs to another school: '+t.team);
  logged.push({id:t.team_id,name:t.team,image:logo.logo_url});
  return '<span class="team-name"><img data-team-id="'+t.team_id+'" src="'+logo.logo_url+'"></span>';
 }
};
vm.runInNewContext(line+'\nthis.renderPoll=poll;',context);
for(const [kind,listing] of Object.entries(polls.polls)){
 logged.length=0;
 const html=context.renderPoll(kind);
 assert.equal((html.match(/class="rank-row"/g)||[]).length,listing.rankings.length,'Poll rendered wrong row count: '+kind);
 assert.equal(logged.length,listing.rankings.length,kind+' has poll rows without real team badges');
 assert.equal(listing.rankings.length,25,kind+' should have 25 teams');
 for(const [label,id] of [['UConn','ncaa:609549'],['BYU','ncaa:609638']]){
  assert(html.includes('data-team-id="'+id+'"'),kind+' missing '+label+' team badge');
  assert(logged.some(x=>x.id===id),kind+' '+label+' mapped to wrong school');
 }
 console.log('PASS '+kind.toUpperCase()+': '+logged.length+'/25 verified logo matches, including UConn and BYU');
}
